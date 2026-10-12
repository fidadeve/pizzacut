import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db.js';
import { computeCart, computeTotals, validatePromo, loadProduct } from '../pricing.js';
import { getSettings, publicSettings } from '../settings.js';
import { trackingStages, syncStatus, statusLabel } from '../tracking.js';
import { wrap, uid, now, HttpError, parseJson } from '../util.js';

export const ordersRouter = Router();

const phoneRegex = /^[+()\-.\s\d]{7,18}$/;

const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2, 'Enter the name for this order.'),
    phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number.'),
    email: z.string().trim().email('Enter a valid email.').or(z.literal('')).optional(),
  }),
  fulfilment: z.enum(['delivery', 'pickup'], { message: 'Choose delivery or pickup.' }),
  address: z.object({
    label: z.string().trim().max(30).optional().or(z.literal('')),
    line1: z.string().trim().min(3, 'Enter your street address.'),
    line2: z.string().trim().max(120).optional().or(z.literal('')),
    city: z.string().trim().min(2, 'Enter your city.'),
    zip: z.string().trim().min(3, 'Enter your postal code.'),
  }).nullish(),
  paymentMethod: z.string().min(1, 'Choose a payment method.'),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
  promoCode: z.string().trim().max(20).optional(),
});

function ownsOrder(order, req) {
  if (req.user) return order.user_id === req.user.id;
  return order.session_token === req.sessionToken;
}

function findOrder(req) {
  const order = get('SELECT * FROM orders WHERE id = ? OR number = ?', req.params.id, String(req.params.id).toUpperCase());
  if (!order || !ownsOrder(order, req)) throw new HttpError(404, 'We could not find that order.');
  return order;
}

export function orderPayload(order, settings = getSettings()) {
  const items = all('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid', order.id).map(i => ({
    id: i.id,
    productId: i.product_id,
    name: i.name,
    image: i.image,
    size: i.size,
    crust: i.crust,
    toppings: parseJson(i.toppings, []),
    extraCheese: !!i.extra_cheese,
    isVeg: !!i.is_veg,
    qty: i.qty,
    unitPriceCents: i.unit_price_cents,
    lineTotalCents: i.line_total_cents,
  }));

  const stages = trackingStages(order.fulfilment);
  const done = order.status === 'delivered';
  const currentIdx = order.status === 'cancelled'
    ? -1
    : done ? stages.length
    : Math.max(0, stages.findIndex(s => s.key === order.status));
  const tracking = {
    stages: stages.map((s, idx) => ({
      key: s.key,
      label: s.label,
      state: order.status === 'cancelled' ? 'pending' : idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'pending',
    })),
    current: order.status,
    cancelled: order.status === 'cancelled',
  };

  const etaMinutes = order.fulfilment === 'pickup' ? settings.eta_pickup_minutes : settings.eta_delivery_minutes;
  const etaAt = order.created_at + etaMinutes * 60_000;

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: statusLabel(order),
    fulfilment: order.fulfilment,
    customer: { name: order.customer_name, phone: order.phone, email: order.email },
    address: parseJson(order.address, null),
    notes: order.notes,
    items,
    totals: {
      subtotalCents: order.subtotal_cents,
      discountCents: order.discount_cents,
      deliveryCents: order.delivery_cents,
      taxCents: order.tax_cents,
      totalCents: order.total_cents,
    },
    promoCode: order.promo_code,
    paymentMethod: order.payment_method,
    createdAt: order.created_at,
    statusUpdatedAt: order.status_updated_at,
    etaAt,
    etaMinutes: Math.max(0, Math.ceil((etaAt - Date.now()) / 60000)),
    autoAdvance: !!settings.auto_advance && order.status !== 'delivered' && order.status !== 'cancelled',
    tracking,
  };
}

ordersRouter.post('/', wrap(async (req, res) => {
  const body = orderSchema.parse(req.body);
  const settings = getSettings();

  if (body.fulfilment === 'delivery' && !body.address) {
    throw new HttpError(400, 'A delivery address is required.');
  }
  const method = publicSettings(settings).paymentMethods.find(m => m.id === body.paymentMethod);
  if (!method) throw new HttpError(400, 'That payment method does not exist.');
  if (!method.enabled) throw new HttpError(400, `${method.label} is not available right now. Please choose another method.`);

  const cart = computeCart(req.cartId);
  if (!cart.items.length) throw new HttpError(400, 'Your cart is empty.');
  for (const item of cart.items) {
    if (!item.product.available) throw new HttpError(400, `"${item.name}" is no longer available.`);
  }

  let promo = null;
  let discountCents = 0;
  const promoCode = (body.promoCode ?? cart.promo?.code ?? '').trim();
  if (promoCode) {
    const applied = validatePromo(promoCode, cart.subtotalCents);
    promo = applied.promo;
    discountCents = applied.discountCents;
  }

  const totals = computeTotals({
    subtotalCents: cart.subtotalCents,
    discountCents,
    fulfilment: body.fulfilment,
    settings,
  });

  const id = uid();
  const ts = now();
  const count = get('SELECT COUNT(*) c FROM orders').c;
  const number = `PC-${10001 + count}`;
  const address = body.fulfilment === 'delivery' ? {
    label: body.address.label || 'Home',
    line1: body.address.line1,
    line2: body.address.line2 || '',
    city: body.address.city,
    zip: body.address.zip,
  } : null;

  run(`INSERT INTO orders (id, number, user_id, session_token, customer_name, phone, email, fulfilment, address, notes,
       subtotal_cents, discount_cents, delivery_cents, tax_cents, total_cents, promo_code, payment_method, status, status_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)`,
    id, number, req.user?.id ?? null, req.sessionToken ?? null,
    body.customer.name, body.customer.phone, body.customer.email || null,
    body.fulfilment, address ? JSON.stringify(address) : null, body.notes || null,
    totals.subtotalCents, totals.discountCents, totals.deliveryCents, totals.taxCents, totals.totalCents,
    promo?.code ?? null, body.paymentMethod, ts, ts, ts);

  for (const item of cart.items) {
    run(`INSERT INTO order_items (id, order_id, product_id, name, image, size, crust, toppings, extra_cheese, is_veg, qty, unit_price_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uid(), id, item.product.id, item.name, item.product.image, item.size, item.crust,
      JSON.stringify(item.toppings.map(t => t.name)), item.extraCheese ? 1 : 0,
      item.product.isVeg ? 1 : 0, item.qty, item.unitPriceCents, item.lineTotalCents);
  }

  run('DELETE FROM cart_items WHERE cart_id = ?', req.cartId);
  run('UPDATE carts SET promo_code = NULL, updated_at = ? WHERE id = ?', ts, req.cartId);

  const order = get('SELECT * FROM orders WHERE id = ?', id);
  res.status(201).json({ order: orderPayload(order, settings) });
}));

ordersRouter.get('/', wrap(async (req, res) => {
  const settings = getSettings();
  const rows = req.user
    ? all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', req.user.id)
    : all('SELECT * FROM orders WHERE session_token = ? ORDER BY created_at DESC', req.sessionToken);
  res.json({ orders: rows.map(o => orderPayload(syncStatus(o, settings), settings)) });
}));

ordersRouter.get('/:id', wrap(async (req, res) => {
  const settings = getSettings();
  const order = syncStatus(findOrder(req), settings);
  res.json({ order: orderPayload(order, settings) });
}));
