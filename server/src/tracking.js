import { get, run } from './db.js';

export function trackingStages(fulfilment) {
  const pickup = fulfilment === 'pickup';
  return [
    { key: 'received', label: 'Order Received' },
    { key: 'confirmed', label: 'Order Confirmed' },
    { key: 'preparing', label: 'Preparing Your Pizza' },
    { key: pickup ? 'ready_for_pickup' : 'out_for_delivery', label: pickup ? 'Ready for Pickup' : 'Out for Delivery' },
    { key: 'delivered', label: pickup ? 'Picked Up' : 'Delivered' },
  ];
}

// Seconds the order waits in each status before moving on (demo kitchen auto-advance).
const WAITS = [30, 60, 90, 120];

export function syncStatus(order, settings) {
  if (order.status === 'delivered' || order.status === 'cancelled') return order;
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
  run('UPDATE orders SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?',
    seq[idx + 1], ts, ts, order.id);
  return get('SELECT * FROM orders WHERE id = ?', order.id);
}

export function statusLabel(order) {
  const stage = trackingStages(order.fulfilment).find(s => s.key === order.status);
  if (stage) return stage.label;
  return order.status === 'cancelled' ? 'Order Cancelled' : order.status;
}
