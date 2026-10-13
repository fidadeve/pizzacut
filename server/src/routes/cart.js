import { Hono } from 'hono';
import { z } from 'zod';
import { get, run } from '../db.js';
import { computeCart, validatePromo, loadProduct, loadProductOptions, priceItem } from '../pricing.js';
import { uid, now, HttpError, readJson } from '../util.js';

export const cart = new Hono();

const itemSchema = z.object({
  productId: z.string().min(1, 'Missing product.'),
  size: z.string().max(30).nullish(),
  crust: z.string().max(40).nullish(),
  toppingIds: z.array(z.string()).max(8).optional(),
  extraCheese: z.boolean().optional(),
  qty: z.number().int().min(1).max(20).optional(),
});

cart.get('/', async (c) => c.json({ cart: await computeCart(c.get('ctx').cartId) }));

cart.post('/items', async (c) => {
  const ctx = c.get('ctx');
  const body = itemSchema.parse(await readJson(c));
  const product = await loadProduct(body.productId);
  if (!product || !product.available) throw new HttpError(404, 'This item is currently unavailable.');
  const options = await loadProductOptions(product.id);
  const priced = await priceItem({ product, options, selection: body });
  await run(`INSERT INTO cart_items (id, cart_id, product_id, size, crust, toppings, extra_cheese, qty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uid(), ctx.cartId, product.id,
    priced.detail.sizeKey, priced.detail.crust,
    JSON.stringify(priced.detail.toppings.map(t => t.id)),
    priced.detail.extraCheese ? 1 : 0, priced.qty, now());
  await run('UPDATE carts SET updated_at = ? WHERE id = ?', now(), ctx.cartId);
  return c.json({ cart: await computeCart(ctx.cartId) }, 201);
});

const patchSchema = z.object({
  qty: z.number().int().min(1).max(20).optional(),
  size: z.string().max(30).nullish(),
  crust: z.string().max(40).nullish(),
  toppingIds: z.array(z.string()).max(8).optional(),
  extraCheese: z.boolean().optional(),
});

cart.patch('/items/:id', async (c) => {
  const ctx = c.get('ctx');
  const itemId = c.req.param('id');
  const row = await get('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?', itemId, ctx.cartId);
  if (!row) throw new HttpError(404, 'That cart item no longer exists.');
  const body = patchSchema.parse(await readJson(c));
  const product = await loadProduct(row.product_id);
  const options = await loadProductOptions(row.product_id);
  const selection = {
    size: body.size !== undefined ? body.size : row.size,
    crust: body.crust !== undefined ? body.crust : row.crust,
    toppingIds: body.toppingIds ?? JSON.parse(row.toppings || '[]'),
    extraCheese: body.extraCheese ?? !!row.extra_cheese,
    qty: body.qty ?? row.qty,
  };
  const priced = await priceItem({ product, options, selection });
  await run(`UPDATE cart_items SET size = ?, crust = ?, toppings = ?, extra_cheese = ?, qty = ? WHERE id = ?`,
    priced.detail.sizeKey, priced.detail.crust,
    JSON.stringify(priced.detail.toppings.map(t => t.id)),
    priced.detail.extraCheese ? 1 : 0, priced.qty, row.id);
  await run('UPDATE carts SET updated_at = ? WHERE id = ?', now(), ctx.cartId);
  return c.json({ cart: await computeCart(ctx.cartId) });
});

cart.delete('/items/:id', async (c) => {
  const ctx = c.get('ctx');
  await run('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', c.req.param('id'), ctx.cartId);
  return c.json({ cart: await computeCart(ctx.cartId) });
});

cart.post('/clear', async (c) => {
  const ctx = c.get('ctx');
  await run('DELETE FROM cart_items WHERE cart_id = ?', ctx.cartId);
  await run('UPDATE carts SET promo_code = NULL WHERE id = ?', ctx.cartId);
  return c.json({ cart: await computeCart(ctx.cartId) });
});

cart.post('/promo', async (c) => {
  const ctx = c.get('ctx');
  const body = await readJson(c).catch(() => ({}));
  const code = String(body?.code ?? '');
  const cartState = await computeCart(ctx.cartId);
  const { promo } = await validatePromo(code, cartState.subtotalCents);
  await run('UPDATE carts SET promo_code = ? WHERE id = ?', promo.code, ctx.cartId);
  return c.json({ cart: await computeCart(ctx.cartId) });
});

cart.delete('/promo', async (c) => {
  const ctx = c.get('ctx');
  await run('UPDATE carts SET promo_code = NULL WHERE id = ?', ctx.cartId);
  return c.json({ cart: await computeCart(ctx.cartId) });
});
