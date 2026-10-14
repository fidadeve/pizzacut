import { Hono } from 'hono';
import { z } from 'zod';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { all, get, run } from '../db.js';
import {
  verifyPassword, createSession, destroySession,
  SESSION_COOKIE, sessionCookieOptions, requireRider,
} from '../auth.js';
import {
  logHistory, notify, unreadCount, listNotifications, markNotificationsRead, assignedOrderPayload,
} from '../delivery.js';
import { statusLabel, FULL_LABELS } from '../tracking.js';
import { HttpError, now, parseJson, readJson } from '../util.js';

export const rider = new Hono();

const loginSchema = z.object({
  username: z.string().trim().min(3, 'Enter your login ID.').max(24),
  password: z.string().min(1, 'Enter your password.').max(128),
});

/** Rider login with username (admin-issued login ID) + password. */
rider.post('/login', async (c) => {
  const { username, password } = loginSchema.parse(await readJson(c));
  const uname = username.toLowerCase();
  const syntheticEmail = `rider+${uname.replace(/[^a-z0-9]+/g, '.')}@pizzacut.internal`;
  const user = await get(
    'SELECT * FROM users WHERE (email = ? OR email = ?) AND role = ?',
    uname.includes('@') ? uname.toLowerCase() : syntheticEmail, syntheticEmail, 'rider',
  );
  // Same generic error for unknown user and wrong password (no user enumeration).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid login ID or password.');
  }
  const profile = await get('SELECT * FROM riders WHERE user_id = ?', user.id);
  if (!profile) throw new HttpError(403, 'No rider profile found for this account.');
  if (profile.status === 'suspended') throw new HttpError(403, 'Your rider account is suspended. Contact the PizzaCut team.');
  if (profile.status !== 'active') throw new HttpError(403, 'Your rider account is inactive. Contact the PizzaCut team to be re-activated.');

  const token = await createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions);

  await run('UPDATE riders SET updated_at = ? WHERE id = ?', now(), profile.id);
  return c.json({
    rider: {
      id: profile.id, userId: user.id, username: profile.username, name: user.name,
      phone: profile.phone ?? user.phone, vehicle: profile.vehicle, photo: profile.photo,
      status: profile.status, availability: profile.availability,
    },
  });
});

/** Everything below requires an authenticated, active rider. */
rider.use('/*', (c, next) => (c.req.path.endsWith('/login') ? next() : requireRider(c, next)));

function riderOrderPayload(order, riderRow, assignment, items) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: statusLabel(order),
    customer: { name: order.customer_name, phone: order.phone },
    address: parseJson(order.address, null),
    deliveryLocation: order.delivery_lat != null && order.delivery_lng != null
      ? { lat: order.delivery_lat, lng: order.delivery_lng, accuracy: order.delivery_accuracy, landmark: order.landmark }
      : null,
    notes: order.notes,
    items,
    totals: {
      subtotalCents: order.subtotal_cents,
      discountCents: order.discount_cents,
      deliveryCents: order.delivery_cents,
      taxCents: order.tax_cents,
      totalCents: order.total_cents,
    },
    paymentMethod: order.payment_method,
    createdAt: order.created_at,
    assignmentTime: assignment?.created_at ?? order.status_updated_at,
    statusUpdatedAt: order.status_updated_at,
  };
}

// Items are fetched separately so payloads stay small.
async function loadItems(orderId) {
  const rows = await all('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid', orderId);
  return rows.map(i => ({
    name: i.name, size: i.size, crust: i.crust,
    toppings: parseJson(i.toppings, []), extraCheese: !!i.extra_cheese,
    isVeg: !!i.is_veg, qty: i.qty, unitPriceCents: i.unit_price_cents, lineTotalCents: i.line_total_cents,
  }));
}

rider.get('/me', async (c) => {
  const ctx = c.get('ctx');
  const r = ctx.rider;
  const user = ctx.user;
  return c.json({
    rider: {
      id: r.id, userId: user.id, username: r.username, name: user.name,
      phone: r.phone ?? user.phone, vehicle: r.vehicle, photo: r.photo,
      status: r.status, availability: r.availability,
    },
  });
});

rider.post('/logout', async (c) => {
  const ctx = c.get('ctx');
  if (ctx?.sessionToken) await destroySession(ctx.sessionToken);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

/** Dashboard counters for the rider home screen. */
rider.get('/dashboard', async (c) => {
  const ctx = c.get('ctx');
  const r = ctx.rider;
  const count = async (statuses) => {
    const placeholders = statuses.map(() => '?').join(',');
    const row = await get(
      `SELECT COUNT(*) c FROM orders WHERE assigned_rider_id = ? AND status IN (${placeholders})`,
      r.id, ...statuses,
    );
    return row.c;
  };
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const newOrders = await count(['assigned']);
  const active = await count(['accepted', 'picked_up', 'out_for_delivery']);
  const deliveredTodayRow = await get(
    'SELECT COUNT(*) c FROM orders WHERE assigned_rider_id = ? AND status = ? AND delivered_at >= ?',
    r.id, 'delivered', dayStart.getTime(),
  );
  const totalAssignedRow = await get('SELECT COUNT(*) c FROM orders WHERE assigned_rider_id = ?', r.id);

  const newest = await get(
    `SELECT * FROM orders WHERE assigned_rider_id = ? AND status IN ('accepted','picked_up','out_for_delivery')
     ORDER BY status_updated_at DESC LIMIT 1`, r.id,
  );
  let activeOrder = null;
  if (newest) {
    const assignment = await get(
      'SELECT * FROM rider_assignments WHERE order_id = ? AND rider_id = ? ORDER BY created_at DESC LIMIT 1',
      newest.id, r.id,
    );
    activeOrder = riderOrderPayload(newest, r, assignment, await loadItems(newest.id));
  }

  return c.json({
    rider: {
      id: r.id, username: r.username, name: ctx.user.name,
      phone: r.phone ?? ctx.user.phone, vehicle: r.vehicle, photo: r.photo,
      status: r.status, availability: r.availability,
    },
    counts: {
      newOrders,
      activeDeliveries: active,
      deliveredToday: deliveredTodayRow.c,
      totalAssigned: totalAssignedRow.c,
    },
    activeOrder,
    unreadNotifications: await unreadCount('rider', ctx.user.id),
  });
});

const availabilitySchema = z.object({ online: z.boolean() });

/** Availability control — only allowed on an active account with no in-flight delivery. */
rider.patch('/availability', async (c) => {
  const ctx = c.get('ctx');
  const { online } = availabilitySchema.parse(await readJson(c));
  const availability = online ? 'online' : 'offline';
  await run('UPDATE riders SET availability = ?, updated_at = ? WHERE id = ?', availability, now(), ctx.rider.id);
  return c.json({ ok: true, availability });
});

/** All orders ever assigned to this rider (history + current). */
rider.get('/orders', async (c) => {
  const ctx = c.get('ctx');
  const rows = await all(
    'SELECT * FROM orders WHERE assigned_rider_id = ? ORDER BY created_at DESC LIMIT 200', ctx.rider.id,
  );
  const out = [];
  for (const o of rows) {
    const assignment = await get(
      'SELECT * FROM rider_assignments WHERE order_id = ? AND rider_id = ? ORDER BY created_at DESC LIMIT 1',
      o.id, ctx.rider.id,
    );
    out.push(riderOrderPayload(o, ctx.rider, assignment, await loadItems(o.id)));
  }
  return c.json({ orders: out });
});

/** Complete details of one assigned order — blocked for other riders' orders. */
rider.get('/orders/:id', async (c) => {
  const ctx = c.get('ctx');
  const bundle = await assignedOrderPayload(c.req.param('id'), ctx.user.id);
  if (!bundle) throw new HttpError(404, 'That order is not assigned to you.');
  return c.json({ order: riderOrderPayload(bundle.order, bundle.rider, bundle.assignment, await loadItems(bundle.order.id)) });
});

/** Rider accepts a delivery (assigned → accepted). */
rider.post('/orders/:id/accept', async (c) => {
  const ctx = c.get('ctx');
  const bundle = await assignedOrderPayload(c.req.param('id'), ctx.user.id);
  if (!bundle) throw new HttpError(404, 'That order is not assigned to you.');
  const o = bundle.order;
  if (o.status !== 'assigned') throw new HttpError(400, `This delivery is already ${FULL_LABELS[o.status] ?? o.status}.`);
  const ts = now();
  await run('UPDATE orders SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?', 'accepted', ts, ts, o.id);
  await logHistory(o.id, {
    from: 'assigned', to: 'accepted', kind: 'status',
    actor: { role: 'rider', id: ctx.user.id, name: ctx.user.name },
    note: `Accepted by rider ${ctx.rider.username}`,
  });
  await notify({
    role: 'admin', orderId: o.id, type: 'status',
    title: `Rider accepted ${o.number}`,
    body: `${ctx.user.name} accepted the delivery.`,
  });
  return c.json({ ok: true, status: 'accepted' });
});

const statusSchema = z.object({
  status: z.enum(['picked_up', 'out_for_delivery', 'delivered', 'delivery_failed']),
  note: z.string().trim().max(300).optional(),
});

/** Rider delivery status transitions (picked_up → out_for_delivery → delivered/failed). */
rider.post('/orders/:id/status', async (c) => {
  const ctx = c.get('ctx');
  const bundle = await assignedOrderPayload(c.req.param('id'), ctx.user.id);
  if (!bundle) throw new HttpError(404, 'That order is not assigned to you.');
  const o = bundle.order;
  const { status, note } = statusSchema.parse(await readJson(c));

  const allowedFrom = {
    picked_up: ['accepted', 'preparing', 'ready_for_pickup'],
    out_for_delivery: ['picked_up', 'delivery_failed'],
    delivered: ['out_for_delivery', 'delivery_failed'],
    delivery_failed: ['out_for_delivery'],
  }[status] ?? [];
  if (!allowedFrom.includes(o.status)) {
    throw new HttpError(400, `Cannot move this delivery from ${FULL_LABELS[o.status] ?? o.status} to ${FULL_LABELS[status] ?? status}.`);
  }
  if (status === 'delivery_failed' && !note) {
    throw new HttpError(400, 'Please describe what went wrong so the store can help.');
  }

  const ts = now();
  await run(
    'UPDATE orders SET status = ?, status_updated_at = ?, delivered_at = ?, updated_at = ? WHERE id = ?',
    status, ts, status === 'delivered' ? ts : o.delivered_at, ts, o.id,
  );
  await logHistory(o.id, {
    from: o.status, to: status, kind: 'status',
    actor: { role: 'rider', id: ctx.user.id, name: ctx.user.name },
    note: note ?? null,
  });
  await notify({
    role: 'admin', orderId: o.id, type: 'status',
    title: `${o.number} is now ${FULL_LABELS[status] ?? status}`,
    body: `Updated by ${ctx.user.name}${note ? ` — ${note}` : ''}`,
  });
  if (status === 'delivered') {
    await run('UPDATE riders SET availability = ?, updated_at = ? WHERE id = ?', 'online', now(), ctx.rider.id);
  }
  return c.json({ ok: true, status });
});

const issueSchema = z.object({ reason: z.string().trim().min(5, 'Describe the problem.').max(300) });

/** Report a delivery problem without changing the order status. */
rider.post('/orders/:id/issue', async (c) => {
  const ctx = c.get('ctx');
  const bundle = await assignedOrderPayload(c.req.param('id'), ctx.user.id);
  if (!bundle) throw new HttpError(404, 'That order is not assigned to you.');
  const { reason } = issueSchema.parse(await readJson(c));
  await logHistory(bundle.order.id, {
    from: bundle.order.status, to: bundle.order.status, kind: 'issue',
    actor: { role: 'rider', id: ctx.user.id, name: ctx.user.name }, note: reason,
  });
  await notify({
    role: 'admin', orderId: bundle.order.id, type: 'issue',
    title: `Problem reported on ${bundle.order.number}`,
    body: `${ctx.user.name}: ${reason}`,
  });
  return c.json({ ok: true });
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
});

/** Live rider location — only recorded while an active delivery is in progress. */
rider.post('/location', async (c) => {
  const ctx = c.get('ctx');
  const { lat, lng, accuracy } = locationSchema.parse(await readJson(c));
  const inflight = await get(
    `SELECT COUNT(*) c FROM orders WHERE assigned_rider_id = ? AND status IN ('accepted','picked_up','out_for_delivery')`,
    ctx.rider.id,
  );
  const ts = now();
  const last = await get('SELECT updated_at FROM rider_locations WHERE rider_id = ?', ctx.rider.id);
  // Battery/traffic throttle: ignore updates under 5s apart.
  if (last && ts - last.updated_at < 5000) return c.json({ ok: true, recorded: false });
  if (!inflight.c) {
    // Off-duty/no active delivery → refresh presence timestamp only, no location retained.
    if (last) await run('DELETE FROM rider_locations WHERE rider_id = ?', ctx.rider.id);
    return c.json({ ok: true, recorded: false, reason: 'no_active_delivery' });
  }
  await run(
    `INSERT INTO rider_locations (rider_id, lat, lng, accuracy, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(rider_id) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy, updated_at = excluded.updated_at`,
    ctx.rider.id, lat, lng, accuracy ?? null, ts,
  );
  return c.json({ ok: true, recorded: true });
});

rider.get('/notifications', async (c) => {
  const ctx = c.get('ctx');
  return c.json({
    notifications: await listNotifications('rider', ctx.user.id),
    unread: await unreadCount('rider', ctx.user.id),
  });
});

rider.post('/notifications/read', async (c) => {
  const ctx = c.get('ctx');
  await markNotificationsRead('rider', ctx.user.id);
  return c.json({ ok: true });
});
