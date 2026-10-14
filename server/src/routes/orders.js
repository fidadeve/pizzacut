import { Hono } from 'hono';
import { z } from 'zod';
import { all, get, run } from '../db.js';
import { computeCart, computeTotals, validatePromo } from '../pricing.js';
import { getSettings, publicSettings } from '../settings.js';
import { trackingStages, syncStatus, statusLabel } from '../tracking.js';
import { logHistory, notify, ACTIVE_DELIVERY_STATUSES } from '../delivery.js';
import { uid, now, HttpError, parseJson, readJson } from '../util.js';

export const orders = new Hono();

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
  // Confirmed device location — mandatory for delivery orders.
  location: z.object({
    lat: z.number().min(-90, 'Invalid latitude.').max(90, 'Invalid latitude.'),
    lng: z.number().min(-180, 'Invalid longitude.').max(180, 'Invalid longitude.'),
    accuracy: z.number().min(0).max(100000).nullable().optional(),
  }).nullish(),
  landmark: z.string().trim().max(120).optional().or(z.literal('')),
  paymentMethod: z.string().min(1, 'Choose a payment method.'),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
  promoCode: z.string().trim().max(20).optional(),
});

function ownsOrder(order, ctx) {
  if (ctx.user) return order.user_id === ctx.user.id;
  return order.session_token === ctx.sessionToken;
}

async function findOrder(ctx, id) {
  const order = await get('SELECT * FROM orders WHERE id = ? OR number = ?', id, String(id).toUpperCase());
  if (!order || !ownsOrder(order, ctx)) throw new HttpError(404, 'We could not find that order.');
  return order;
}

export async function orderPayload(order, settings) {
  const st = settings ?? await getSettings();
  let rider = null;
  if (order.assigned_rider_id) {
    const r = await get(
      `SELECT r.id, r.username, r.vehicle, u.name, u.phone FROM riders r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
      order.assigned_rider_id,
    );
    if (r) rider = { id: r.id, username: r.username, name: r.name, phone: r.phone ?? r.rider_phone, vehicle: r.vehicle };
  }
  const rows = await all('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid', order.id);
  const items = rows.map(i => ({
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

  const etaMinutes = order.fulfilment === 'pickup' ? st.eta_pickup_minutes : st.eta_delivery_minutes;
  const etaAt = order.created_at + etaMinutes * 60_000;

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: statusLabel(order),
    fulfilment: order.fulfilment,
    customer: { name: order.customer_name, phone: order.phone, email: order.email },
    address: parseJson(order.address, null),
    deliveryLocation: order.delivery_lat != null && order.delivery_lng != null ? {
      lat: order.delivery_lat, lng: order.delivery_lng,
      accuracy: order.delivery_accuracy, landmark: order.landmark,
    } : null,
    rider,
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
    autoAdvance: !!st.auto_advance && order.status !== 'delivered' && order.status !== 'cancelled',
    tracking,
  };
}

orders.post('/', async (c) => {
  const ctx = c.get('ctx');
  const body = orderSchema.parse(await readJson(c));
  const settings = await getSettings();

  if (body.fulfilment === 'delivery' && !body.address) {
    throw new HttpError(400, 'A delivery address is required.');
  }
  // Location is confirmed by the customer in the browser, never trusted blindly:
  // the server re-applies range checks and refuses orders without coordinates.
  if (body.fulfilment === 'delivery' && !(body.location && Number.isFinite(body.location.lat) && Number.isFinite(body.location.lng))) {
    throw new HttpError(400, 'A confirmed delivery location is required. Please enable location and try again.');
  }
  if (body.fulfilment === 'pickup' && !body.address) {
    // Pickup orders don't need a customer address; keep the address null.
  }
  const method = (await publicSettings(settings)).paymentMethods.find(m => m.id === body.paymentMethod);
  if (!method) throw new HttpError(400, 'That payment method does not exist.');
  if (!method.enabled) throw new HttpError(400, `${method.label} is not available right now. Please choose another method.`);

  const cartState = await computeCart(ctx.cartId);
  if (!cartState.items.length) throw new HttpError(400, 'Your cart is empty.');
  for (const item of cartState.items) {
    if (!item.product.available) throw new HttpError(400, `"${item.name}" is no longer available.`);
  }

  let promo = null;
  let discountCents = 0;
  const promoCode = (body.promoCode ?? cartState.promo?.code ?? '').trim();
  if (promoCode) {
    const applied = await validatePromo(promoCode, cartState.subtotalCents);
    promo = applied.promo;
    discountCents = applied.discountCents;
  }

  const totals = await computeTotals({
    subtotalCents: cartState.subtotalCents,
    discountCents,
    fulfilment: body.fulfilment,
    settings,
  });

  const id = uid();
  const ts = now();
  const count = await get('SELECT COUNT(*) c FROM orders');
  const number = `PC-${10001 + count.c}`;
  const address = body.fulfilment === 'delivery' ? {
    label: body.address.label || 'Home',
    line1: body.address.line1,
    line2: body.address.line2 || '',
    city: body.address.city,
    zip: body.address.zip,
  } : null;

  await run(`INSERT INTO orders (id, number, user_id, session_token, customer_name, phone, email, fulfilment, address, notes,
       delivery_lat, delivery_lng, delivery_accuracy, landmark,
       subtotal_cents, discount_cents, delivery_cents, tax_cents, total_cents, promo_code, payment_method, status, status_updated_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)`,
    id, number, ctx.user?.id ?? null, ctx.sessionToken ?? null,
    body.customer.name, body.customer.phone, body.customer.email || null,
    body.fulfilment, address ? JSON.stringify(address) : null, body.notes || null,
    body.fulfilment === 'delivery' ? body.location.lat : null,
    body.fulfilment === 'delivery' ? body.location.lng : null,
    body.fulfilment === 'delivery' ? (body.location.accuracy ?? null) : null,
    body.landmark || null,
    totals.subtotalCents, totals.discountCents, totals.deliveryCents, totals.taxCents, totals.totalCents,
    promo?.code ?? null, body.paymentMethod, ts, ts, ts);

  for (const item of cartState.items) {
    await run(`INSERT INTO order_items (id, order_id, product_id, name, image, size, crust, toppings, extra_cheese, is_veg, qty, unit_price_cents, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uid(), id, item.product.id, item.name, item.product.image, item.size, item.crust,
      JSON.stringify(item.toppings.map(t => t.name)), item.extraCheese ? 1 : 0,
      item.product.isVeg ? 1 : 0, item.qty, item.unitPriceCents, item.lineTotalCents);
  }

  await run('DELETE FROM cart_items WHERE cart_id = ?', ctx.cartId);
  await run('UPDATE carts SET promo_code = NULL, updated_at = ? WHERE id = ?', ts, ctx.cartId);

  // Auditable creation + immediate admin-panel notification.
  await logHistory(id, {
    to: 'received', actor: { role: 'customer', id: ctx.user?.id ?? null, name: body.customer.name },
    note: body.fulfilment === 'delivery' ? `Delivery order placed (${body.location.lat.toFixed(4)}, ${body.location.lng.toFixed(4)})` : 'Pickup order placed',
  });
  await notify({
    role: 'admin', orderId: id, type: 'new_order',
    title: `New order ${number}`,
    body: `${body.customer.name} · ${body.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} · $${(totals.totalCents / 100).toFixed(2)}`,
  });

  const order = await get('SELECT * FROM orders WHERE id = ?', id);
  return c.json({ order: await orderPayload(order, settings) }, 201);
});

orders.get('/', async (c) => {
  const ctx = c.get('ctx');
  const settings = await getSettings();
  const rows = ctx.user
    ? await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', ctx.user.id)
    : await all('SELECT * FROM orders WHERE session_token = ? ORDER BY created_at DESC', ctx.sessionToken);
  const out = [];
  for (const o of rows) out.push(await orderPayload(await syncStatus(o, settings), settings));
  return c.json({ orders: out });
});

orders.get('/:id', async (c) => {
  const settings = await getSettings();
  const order = await syncStatus(await findOrder(c.get('ctx'), c.req.param('id')), settings);
  return c.json({ order: await orderPayload(order, settings) });
});

/**
 * Live rider position for the customer's "Your Rider" map.
 * Owner-only (guest sessions included) and only while an assigned delivery is
 * actually in flight — a delivered/cancelled order leaks nothing.
 */
orders.get('/:id/rider-location', async (c) => {
  const order = await findOrder(c.get('ctx'), c.req.param('id'));
  const active = !!order.assigned_rider_id && ACTIVE_DELIVERY_STATUSES.includes(order.status);
  if (!active) return c.json({ active: false, status: order.status, rider: null, location: null });

  const r = await get(
    `SELECT r.id, r.username, r.vehicle, u.name, u.phone
     FROM riders r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
    order.assigned_rider_id,
  );
  const loc = await get('SELECT lat, lng, accuracy, updated_at FROM rider_locations WHERE rider_id = ?', order.assigned_rider_id);
  return c.json({
    active: true,
    status: order.status,
    rider: r ? { id: r.id, name: r.name, username: r.username, phone: r.phone, vehicle: r.vehicle } : null,
    // No fresh ping (> 60s old) → treat as offline so the map never shows a stale rider.
    location: loc && now() - loc.updated_at <= 60_000
      ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, updatedAt: loc.updated_at }
      : null,
  });
});
