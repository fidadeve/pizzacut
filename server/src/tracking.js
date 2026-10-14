import { all, get, run } from './db.js';

/** Every order status in lifecycle order (delivery). */
export const ALL_STATUSES = [
  'received', 'confirmed', 'assigned', 'accepted', 'preparing',
  'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered',
  'delivery_failed', 'cancelled',
];

/** Admin/kitchen may move orders only along these transitions. */
export const VALID_TRANSITIONS = {
  received: ['confirmed', 'cancelled'],
  confirmed: ['assigned', 'preparing', 'cancelled'],
  assigned: ['accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'cancelled'],
  accepted: ['preparing', 'ready_for_pickup', 'picked_up', 'cancelled'],
  preparing: ['ready_for_pickup', 'picked_up', 'cancelled'],
  ready_for_pickup: ['picked_up', 'out_for_delivery', 'cancelled'],
  picked_up: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'delivery_failed', 'cancelled'],
  delivered: [],
  delivery_failed: ['out_for_delivery', 'delivered', 'cancelled'],
  cancelled: [],
};

export const FULL_LABELS = {
  received: 'Order Received',
  confirmed: 'Order Confirmed',
  assigned: 'Rider Assigned',
  accepted: 'Delivery Accepted',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery Failed',
  cancelled: 'Order Cancelled',
};

export function trackingStages(fulfilment) {
  if (fulfilment === 'pickup') {
    return [
      { key: 'received', label: 'Order Received' },
      { key: 'confirmed', label: 'Order Confirmed' },
      { key: 'preparing', label: 'Preparing Your Pizza' },
      { key: 'ready_for_pickup', label: 'Ready for Pickup' },
      { key: 'delivered', label: 'Picked Up' },
    ];
  }
  // Customer-visible delivery stages. Intermediate kitchen/rider statuses
  // (accepted, preparing, ready_for_pickup, picked_up) fold into their slot.
  return [
    { key: 'received', label: 'Order Received' },
    { key: 'confirmed', label: 'Order Confirmed' },
    { key: 'assigned', label: 'Rider Assigned' },
    { key: 'out_for_delivery', label: 'On the Way' },
    { key: 'delivered', label: 'Delivered' },
  ];
}

const DELIVERY_STAGE_ALIAS = {
  accepted: 'assigned',
  preparing: 'out_for_delivery',
  ready_for_pickup: 'out_for_delivery',
  picked_up: 'out_for_delivery',
  out_for_delivery: 'out_for_delivery',
};

function stageIndexFor(order) {
  const stages = trackingStages(order.fulfilment);
  const status = order.status;
  if (status === 'cancelled' || status === 'delivery_failed') return -1;
  if (status === 'delivered') return stages.length;
  const visible = DELIVERY_STAGE_ALIAS[status] ?? status;
  const idx = stages.findIndex(s => s.key === visible);
  return idx >= 0 ? idx : 0;
}

// Seconds the order waits in each status before moving on (demo kitchen
// auto-advance for unassigned orders). Rider-managed orders never auto-advance.
const WAITS = [30, 60, 90, 120];

export async function syncStatus(order, settings) {
  const done = ['delivered', 'cancelled', 'delivery_failed'].includes(order.status);
  if (done || order.assigned_rider_id) return order; // rider/admin drive these
  if (!settings.auto_advance) return order;
  const seq = order.fulfilment === 'pickup'
    ? ['received', 'confirmed', 'preparing', 'ready_for_pickup', 'delivered']
    : ['received', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
  const idx = seq.indexOf(order.status);
  if (idx < 0) return order;
  const waitSec = WAITS[idx];
  if (waitSec == null) return order;
  if (Date.now() - order.status_updated_at < waitSec * 1000) return order;
  const ts = Date.now();
  await run('UPDATE orders SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?',
    seq[idx + 1], ts, ts, order.id);
  return get('SELECT * FROM orders WHERE id = ?', order.id);
}

export function statusLabel(order) {
  if (order.fulfilment !== 'delivery') {
    const stage = trackingStages(order.fulfilment).find(s => s.key === order.status);
    if (stage) return stage.label;
    return order.status === 'cancelled' ? 'Order Cancelled' : FULL_LABELS[order.status] ?? order.status;
  }
  return FULL_LABELS[order.status] ?? order.status;
}

/** Coarse customer-facing stage computation for tracking UI. */
export function deliveryTracking(order) {
  const stages = trackingStages(order.fulfilment);
  if (order.fulfilment === 'pickup') {
    const currentIdx = order.status === 'cancelled' ? -1
      : order.status === 'delivered' ? stages.length
      : Math.max(0, stages.findIndex(s => s.key === order.status));
    return stages.map((s, idx) => ({
      key: s.key, label: s.label,
      state: order.status === 'cancelled' ? 'pending' : idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'pending',
    }));
  }
  const currentIdx = stageIndexFor(order);
  return stages.map((s, idx) => ({
    key: s.key, label: s.label,
    state: order.status === 'cancelled' || order.status === 'delivery_failed' ? 'pending'
      : idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'pending',
  }));
}
