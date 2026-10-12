import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../db.js';
import { computeCart, validatePromo, loadProduct, loadProductOptions, priceItem } from '../pricing.js';
import { wrap, uid, now, HttpError } from '../util.js';

export const cartRouter = Router();

const itemSchema = z.object({
  productId: z.string().min(1, 'Missing product.'),
  size: z.string().max(30).nullish(),
  crust: z.string().max(40).nullish(),
  toppingIds: z.array(z.string()).max(8).optional(),
  extraCheese: z.boolean().optional(),
  qty: z.number().int().min(1).max(20).optional(),
});

cartRouter.get('/', wrap(async (req, res) => {
  res.json({ cart: computeCart(req.cartId) });
}));

cartRouter.post('/items', wrap(async (req, res) => {
  const body = itemSchema.parse(req.body);
  const product = loadProduct(body.productId);
  if (!product || !product.available) throw new HttpError(404, 'This item is currently unavailable.');
  const options = loadProductOptions(product.id);
  const priced = priceItem({ product, options, selection: body });
  run(`INSERT INTO cart_items (id, cart_id, product_id, size, crust, toppings, extra_cheese, qty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uid(), req.cartId, product.id,
    priced.detail.sizeKey, priced.detail.crust,
    JSON.stringify(priced.detail.toppings.map(t => t.id)),
    priced.detail.extraCheese ? 1 : 0, priced.qty, now());
  run('UPDATE carts SET updated_at = ? WHERE id = ?', now(), req.cartId);
  res.status(201).json({ cart: computeCart(req.cartId) });
}));

const patchSchema = z.object({
  qty: z.number().int().min(1).max(20).optional(),
  size: z.string().max(30).nullish(),
  crust: z.string().max(40).nullish(),
  toppingIds: z.array(z.string()).max(8).optional(),
  extraCheese: z.boolean().optional(),
});

cartRouter.patch('/items/:id', wrap(async (req, res) => {
  const row = get('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?', req.params.id, req.cartId);
  if (!row) throw new HttpError(404, 'That cart item no longer exists.');
  const body = patchSchema.parse(req.body);
  const product = loadProduct(row.product_id);
  const options = loadProductOptions(row.product_id);
  const selection = {
    size: body.size !== undefined ? body.size : row.size,
    crust: body.crust !== undefined ? body.crust : row.crust,
    toppingIds: body.toppingIds ?? JSON.parse(row.toppings || '[]'),
    extraCheese: body.extraCheese ?? !!row.extra_cheese,
    qty: body.qty ?? row.qty,
  };
  const priced = priceItem({ product, options, selection });
  run(`UPDATE cart_items SET size = ?, crust = ?, toppings = ?, extra_cheese = ?, qty = ? WHERE id = ?`,
    priced.detail.sizeKey, priced.detail.crust,
    JSON.stringify(priced.detail.toppings.map(t => t.id)),
    priced.detail.extraCheese ? 1 : 0, priced.qty, row.id);
  run('UPDATE carts SET updated_at = ? WHERE id = ?', now(), req.cartId);
  res.json({ cart: computeCart(req.cartId) });
}));

cartRouter.delete('/items/:id', wrap(async (req, res) => {
  run('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', req.params.id, req.cartId);
  res.json({ cart: computeCart(req.cartId) });
}));

cartRouter.post('/clear', wrap(async (req, res) => {
  run('DELETE FROM cart_items WHERE cart_id = ?', req.cartId);
  run('UPDATE carts SET promo_code = NULL WHERE id = ?', req.cartId);
  res.json({ cart: computeCart(req.cartId) });
}));

cartRouter.post('/promo', wrap(async (req, res) => {
  const code = String(req.body?.code ?? '');
  const cart = computeCart(req.cartId);
  const { promo } = validatePromo(code, cart.subtotalCents);
  run('UPDATE carts SET promo_code = ? WHERE id = ?', promo.code, req.cartId);
  res.json({ cart: computeCart(req.cartId) });
}));

cartRouter.delete('/promo', wrap(async (req, res) => {
  run('UPDATE carts SET promo_code = NULL WHERE id = ?', req.cartId);
  res.json({ cart: computeCart(req.cartId) });
}));
