import { all, get, run } from './db.js';
import { uid, now, HttpError } from './util.js';
import { FULL_LABELS } from './tracking.js';

export const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'out_for_delivery'];

/** Append an order-history row. actor = { role, id?, name? }. */
export async function logHistory(orderId, { from = null, to = 'none', kind = 'status', actor, note = null }) {
  await run(
    `INSERT INTO order_history (id, order_id, from_status, to_status, kind, actor_role, actor_id, actor_name, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uid(), orderId, from, to, kind, actor.role, actor.id ?? null, actor.name ?? null, note, now(),
  );
}

export async function getHistory(orderId) {
  const rows = await all('SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at, rowid', orderId);
  return rows.map(h => ({
    id: h.id,
    orderId: h.order_id,
    from: h.from_status,
    to: h.to_status,
    kind: h.kind,
    actorRole: h.actor_role,
    actorId: h.actor_id,
    actorName: h.actor_name,
    note: h.note,
    label: FULL_LABELS[h.to_status] ?? (h.kind === 'status' ? h.to_status : h.kind.replace(/_/g, ' ')),
    createdAt: h.created_at,
  }));
}

/** Insert an in-app notification for one recipient (role + optional user id). */
export async function notify({ role, userId = null, orderId = null, type, title, body = '' }) {
  await run(
    `INSERT INTO notifications (id, recipient_role, recipient_user_id, order_id, type, title, body, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    uid(), role, userId, orderId, type, title, body, now(),
  );
}

export async function unreadCount(role, userId = null) {
  const row = await get(
    'SELECT COUNT(*) c FROM notifications WHERE recipient_role = ? AND read = 0 AND (recipient_user_id IS NULL OR recipient_user_id = ?)',
    role, userId,
  );
  return row.c;
}

export async function listNotifications(role, userId = null, limit = 50) {
  const rows = await all(
    `SELECT * FROM notifications WHERE recipient_role = ? AND (recipient_user_id IS NULL OR recipient_user_id = ?)
     ORDER BY created_at DESC LIMIT ?`, role, userId, limit,
  );
  return rows.map(n => ({
    id: n.id, orderId: n.order_id, type: n.type, title: n.title, body: n.body,
    read: !!n.read, createdAt: n.created_at,
  }));
}

export async function markNotificationsRead(role, userId = null) {
  await run(
    'UPDATE notifications SET read = 1 WHERE recipient_role = ? AND read = 0 AND (recipient_user_id IS NULL OR recipient_user_id = ?)',
    role, userId,
  );
}

/**
 * Assign (or reassign) a delivery order to a rider. Preserves assignment
 * history; one active assignment per order at a time.
 */
export async function assignOrder(order, rider, adminCtx) {
  if (order.fulfilment !== 'delivery') throw new HttpError(400, 'Only delivery orders can have riders.');
  if (rider.status !== 'active') throw new HttpError(400, 'That rider account is not active.');
  if (order.status === 'delivered' || order.status === 'cancelled') {
    throw new HttpError(400, 'This order is closed and cannot be assigned.');
  }
  if (order.assigned_rider_id === rider.id) throw new HttpError(409, 'This order is already assigned to that rider.');

  const ts = now();
  const prevFrom = order.status;
  // Close any previous active assignment (reassignment keeps it in history).
  await run('UPDATE rider_assignments SET unassigned_at = ? WHERE order_id = ? AND unassigned_at IS NULL', ts, order.id);
  await run('INSERT INTO rider_assignments (id, order_id, rider_id, assigned_by, unassigned_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
    uid(), order.id, rider.id, adminCtx.id, ts);

  const toStatus = order.status === 'received' ? 'assigned' : order.status;
  await run('UPDATE orders SET assigned_rider_id = ?, status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?',
    rider.id, toStatus, ts, ts, order.id);

  await logHistory(order.id, {
    from: prevFrom, to: toStatus, kind: 'assignment',
    actor: { role: 'admin', id: adminCtx.id, name: adminCtx.name },
    note: `Assigned to ${rider.username} (${rider.rider_name ?? 'rider'})`,
  });
  await notify({
    role: 'rider', userId: rider.user_id, orderId: order.id, type: 'assignment',
    title: `New delivery assigned: ${order.number}`,
    body: 'Open the rider portal to review details and accept the delivery.',
  });
  return toStatus;
}

/** Rider-visible order projection. Never includes other riders' orders. */
export async function assignedOrderPayload(orderId, riderUserId) {
  const rider = await get('SELECT id, user_id, username, phone AS rider_phone FROM riders WHERE user_id = ?', riderUserId);
  if (!rider) return null;
  const row = await get(
    'SELECT * FROM orders WHERE id = ? OR number = ? LIMIT 1',
    orderId, String(orderId).toUpperCase(),
  );
  if (!row || row.assigned_rider_id !== rider.id) return null;
  const assignment = await get(
    'SELECT * FROM rider_assignments WHERE order_id = ? AND rider_id = ? ORDER BY created_at DESC LIMIT 1',
    row.id, rider.id,
  );
  return { order: row, rider, assignment };
}
