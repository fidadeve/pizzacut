import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useSettings } from '../../lib/settings';
import { useToast } from '../../lib/toast';
import type { DeliveryOps } from '../../lib/types';
import { formatDate, money } from '../../lib/format';
import { ErrorState, Skeleton } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { AssignRiderSheet } from './AssignRiderSheet';

const STATUS_PILL: Record<string, string> = {
  delivered: 'bg-charcoal text-white',
  cancelled: 'bg-surface text-muted',
  out_for_delivery: 'bg-brand text-white',
  delivery_failed: 'bg-brand text-white',
};
const pill = (s: string) => STATUS_PILL[s] ?? 'bg-brand-soft text-brand';

const RIDE_STATUS_LABELS: Record<string, string> = {
  received: 'Received', confirmed: 'Confirmed', assigned: 'Assigned', accepted: 'Accepted',
  preparing: 'Preparing', ready_for_pickup: 'Ready for pickup', picked_up: 'Picked up',
  out_for_delivery: 'Out for delivery', delivered: 'Delivered', delivery_failed: 'Failed', cancelled: 'Cancelled',
};

export function AdminDeliveryOps() {
  const { settings } = useSettings();
  const { push } = useToast();
  const sym = settings.currencySymbol;
  const [status, setStatus] = useState('all');
  const [rider, setRider] = useState('');
  const [date, setDate] = useState('');
  const [assignFor, setAssignFor] = useState<{ id: string; number: string } | null>(null);

  const query = `?status=${status}&rider=${rider}${date ? `&date=${date}` : ''}`;
  const { data, loading, error, retry } = useFetch(() => api.get<DeliveryOps>(`/admin/delivery/ops${query}`), [query]);
  const ops = data;
  const riders = ops?.riders ?? [];

  const onAssigned = () => { push('Rider assigned — the rider portal will show this order'); void retry(); };

  // Cancellation from the ops screen flows through the transition-validated endpoint.
  const cancelOrder = async (id: string) => {
    try {
      await api.patch(`/admin/orders/${id}`, { status: 'cancelled', note: 'Cancelled from delivery ops' });
      push('Order cancelled');
      void retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Cancel failed', 'error');
    }
  };

  const summaryCards: [string, number | undefined, IconName][] = [
    ['Active deliveries', ops?.summary.activeDeliveries, 'bike'],
    ['Unassigned', ops?.summary.unassignedDelivery, 'warn'],
    ['Completed today', ops?.summary.completedToday, 'checkCircle'],
    ['Failed', ops?.summary.failedActive, 'close'],
    ['Issues today', ops?.summary.issuesOpen, 'info'],
  ];

  return (
    <div>
      <h1 className="text-2xl text-ink">Delivery operations</h1>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {summaryCards.map(([label, val, icon]) => (
          <div key={label} className="card p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted"><Icon name={icon} className="h-3.5 w-3.5 text-brand" />{label}</p>
            <p className="mt-0.5 font-display text-xl text-ink">{val ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        <select value={rider} onChange={e => setRider(e.target.value)} className="field h-9 min-h-9 py-0 text-[13px]" aria-label="Filter by rider">
          <option value="">All riders</option>
          <option value="unassigned">Unassigned orders</option>
          {riders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="field h-9 min-h-9 py-0 text-[13px]" aria-label="Filter by date" />
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {['all', ...(ops?.statuses ?? [])].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`chip border ${status === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal hover:border-charcoal/30'}`}>
            {s === 'all' ? 'All' : RIDE_STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {/* Rider availability strip */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {riders.map(r => (
          <div key={r.id} className="chip border border-line bg-white">
            <span className={`inline-block h-2 w-2 rounded-full ${r.status === 'active' ? (r.availability === 'online' ? 'bg-emerald-500' : 'bg-muted/50') : 'bg-brand'}`} />
            {r.name} · {r.activeDeliveries} active
          </div>
        ))}
      </div>

      {/* Orders */}
      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (ops?.orders.length ?? 0) === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13.5px] font-semibold text-muted">No deliveries match this filter.</p>
        ) : (
          ops!.orders.map(o => (
            <article key={o.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-extrabold text-ink">{o.number} · {o.customer}</p>
                <p className="truncate text-[12px] font-bold text-muted">
                  {formatDate(o.createdAt)} · {o.itemCount} items · {money(o.totalCents, sym)}
                  {o.hasLocation ? ' · 📍 pin saved' : ' · no pin'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`pill-badge ${pill(o.status)}`}>{RIDE_STATUS_LABELS[o.status] ?? o.status}</span>
                <span className="pill-badge bg-white text-charcoal border border-line">
                  {o.assignedRiderId ? `🛵 ${o.riderName ?? 'rider'}` : (o.fulfilment === 'delivery' ? 'Unassigned' : 'Pickup')}
                </span>
                {o.fulfilment === 'delivery' && ['received', 'confirmed', 'assigned', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivery_failed'].includes(o.status) && (
                  <button onClick={() => setAssignFor({ id: o.id, number: o.number })} className="btn btn-primary btn-sm">
                    <Icon name="bike" className="h-4 w-4" /> {o.assignedRiderId ? 'Reassign' : 'Assign rider'}
                  </button>
                )}
                {!['delivered', 'cancelled'].includes(o.status) && (
                  <button onClick={() => void cancelOrder(o.id)} className="btn btn-outline btn-sm text-brand">Cancel</button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {assignFor && (
        <AssignRiderSheet
          orderId={assignFor.id}
          orderNumber={assignFor.number}
          onClose={() => setAssignFor(null)}
          onAssigned={onAssigned}
        />
      )}
    </div>
  );
}
