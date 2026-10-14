import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useSettings } from '../../lib/settings';
import type { HistoryEntry, Order, RiderLiveLocation } from '../../lib/types';
import { formatDate, money, timeAgo } from '../../lib/format';
import { Spinner } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { mapsPinLink, coordLink } from '../../components/LocationMap';
import { LiveDeliveryMapBoundary as LiveDeliveryMap } from '../../components/LiveMap';
import { AssignRiderSheet } from './AssignRiderSheet';

const HISTORY_ICONS: Record<string, IconName> = {
  status: 'checkCircle', assignment: 'bike', issue: 'info',
};

interface FullOrder {
  order: Order;
  history: HistoryEntry[];
  assignments: { id: string; riderId: string; riderName: string; riderUsername: string; assignedBy: string; unassignedAt: number | null; createdAt: number }[];
}

export function AdminOrderDetailPanel({ orderId, onAssigned }: {
  orderId: string; onAssigned?: () => void;
}) {
  const { settings } = useSettings();
  const sym = settings.currencySymbol;
  const { data, loading, error, retry } = useFetch(() => api.get<FullOrder>(`/admin/orders/${orderId}/full`), [orderId]);
  const [assignOpen, setAssignOpen] = useState(false);

  // Live rider feed: poll only while an assigned delivery is actually moving.
  const loadedOrder = data?.order;
  const liveActive = !!loadedOrder && !!loadedOrder.rider
    && ['assigned', 'accepted', 'picked_up', 'out_for_delivery'].includes(loadedOrder.status);
  const live = useFetch<RiderLiveLocation>(
    () => api.get<RiderLiveLocation>(`/admin/orders/${orderId}/location`),
    [orderId], liveActive,
  );
  const refetchLive = live.retry;
  useEffect(() => {
    if (!liveActive) return;
    const timer = setInterval(() => { void refetchLive(); }, 5_000);
    return () => clearInterval(timer);
  }, [liveActive, refetchLive]);
  if (loading) return <div className="flex justify-center py-6 text-brand"><Spinner className="h-6 w-6" /></div>;
  if (error || !data) return <p className="text-[13px] font-bold text-brand">{error ?? 'Could not load order details.'}</p>;

  const order = data.order;
  // Only delivery orders that can still move forward are assignable.
  const assignable = order.fulfilment === 'delivery' && !['delivered', 'cancelled'].includes(order.status);

  return (
    <div className="space-y-4">
      {/* Items + payment */}
      <ul className="space-y-2">
        {order.items.map(item => (
          <li key={item.id} className="flex items-center gap-3 text-[13px]">
            <img src={item.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-extrabold text-ink">{item.qty} × {item.name}</span>
              <span className="block truncate text-[11.5px] font-semibold text-muted">
                {[item.size, item.crust, ...item.toppings, item.extraCheese ? 'Extra cheese' : null].filter(Boolean).join(' · ') || 'As served'}
              </span>
            </span>
            <span className="font-bold">{money(item.lineTotalCents, sym)}</span>
          </li>
        ))}
      </ul>
      <div className="divider space-y-1.5 pt-3 text-[13px] font-bold">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{money(order.totals.subtotalCents, sym)}</span></div>
        {order.totals.discountCents > 0 && <div className="flex justify-between text-brand"><span>Discount {order.promoCode ? `(${order.promoCode})` : ''}</span><span>−{money(order.totals.discountCents, sym)}</span></div>}
        <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{order.totals.deliveryCents ? money(order.totals.deliveryCents, sym) : 'Free'}</span></div>
        <div className="flex justify-between"><span className="text-muted">Tax</span><span>{money(order.totals.taxCents, sym)}</span></div>
        <div className="flex justify-between text-[14px]"><span>Total · {settings.paymentMethods.find(m => m.id === order.paymentMethod)?.label ?? order.paymentMethod}</span><span className="text-brand">{money(order.totals.totalCents, sym)}</span></div>
      </div>

      {/* Customer + address */}
      <div className="space-y-1.5 text-[13px] font-semibold text-muted">
        <p><Icon name="user" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />{order.customer.name} · <a className="font-extrabold text-brand hover:underline" href={`tel:${order.customer.phone.replace(/[^+\d]/g, '')}`}>{order.customer.phone}</a></p>
        {order.address && <p><Icon name="pin" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city} {order.address.zip}</p>}
        {order.notes && <p><Icon name="edit" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />“{order.notes}”</p>}
      </div>

      {/* Delivery location — exact stored pin + live rider when moving */}
      {order.deliveryLocation ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-extrabold text-ink">{liveActive ? 'Live delivery map' : 'Delivery pin'}</p>
            <div className="flex gap-2 text-[11.5px] font-extrabold">
              <a href={mapsPinLink(order.deliveryLocation.lat, order.deliveryLocation.lng)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-brand px-3 py-1.5 text-white hover:opacity-90">
                <Icon name="pin" className="mr-1 inline h-3.5 w-3.5" />Open in Maps
              </a>
              <a href={coordLink(order.deliveryLocation.lat, order.deliveryLocation.lng)} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1.5 text-charcoal hover:bg-surface">Coordinates</a>
            </div>
          </div>
          <LiveDeliveryMap
            rider={live.data?.location ?? null}
            destination={order.deliveryLocation}
            riderLabel={order.rider?.name ?? 'Rider'}
            destinationLabel="Customer"
            live={!!live.data?.location}
            className="h-64"
            footer={live.data?.location
              ? `${order.rider?.name ?? 'Rider'} updated ${timeAgo(live.data.location.updatedAt)} · ±${Math.round(live.data.location.accuracy ?? 0)} m`
              : liveActive
                ? 'No fresh GPS from the rider yet — it appears the moment they ping.'
                : undefined}
          />
          {order.deliveryLocation.accuracy != null && (
            <p className="mt-1 text-[11.5px] font-bold text-muted">GPS accuracy ±{Math.round(order.deliveryLocation.accuracy)} m at capture{order.deliveryLocation.landmark ? ` · landmark: ${order.deliveryLocation.landmark}` : ''}</p>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-4 text-[12.5px] font-semibold text-muted">
          {order.fulfilment === 'pickup' ? 'Pickup order — no delivery pin needed.' : 'No delivery pin was captured for this order.'}
        </p>
      )}

      {/* Rider row */}
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="bike" className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-extrabold text-ink">{order.rider ? order.rider.name : 'No rider assigned'}</p>
          {order.rider && <p className="truncate text-[11.5px] font-bold text-muted">{order.rider.phone ?? '—'} · {order.rider.vehicle || 'vehicle not set'}</p>}
        </div>
        {order.rider?.phone && (
          <a href={`tel:${order.rider.phone.replace(/[^+\d]/g, '')}`} className="rounded-full border border-line px-3 py-1.5 text-[12px] font-extrabold text-charcoal hover:bg-surface">Call</a>
        )}
      </div>

      {/* History timeline */}
      <div>
        <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-muted">Full timeline</p>
        <ol className="space-y-2">
          {data.history.map(h => (
            <li key={h.id} className="flex items-start gap-2.5 text-[12.5px]">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface">
                <Icon name={HISTORY_ICONS[h.kind] ?? 'clock'} className={`h-3.5 w-3.5 ${h.kind === 'issue' ? 'text-brand' : 'text-charcoal'}`} />
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-ink">{h.label}{h.note ? ` — ${h.note}` : ''}</p>
                <p className="text-[11.5px] font-semibold text-muted">{formatDate(h.createdAt)} · {h.actorRole}{h.actorName ? ` (${h.actorName})` : ''}{h.from && h.to !== h.from ? ` · ${h.from} → ${h.to}` : ''}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Assign / reassign */}
      {assignable && (
        <div className="mt-1">
          {assignOpen && (
            <AssignRiderSheet orderId={order.id} orderNumber={order.number} onClose={() => setAssignOpen(false)} onAssigned={() => { void retry(); onAssigned?.(); }} />
          )}
          <button onClick={() => setAssignOpen(true)} className="btn btn-primary w-full justify-center">
            <Icon name="bike" className="h-4 w-4" /> {order.rider ? 'Reassign rider' : 'Assign rider'}
          </button>
        </div>
      )}
    </div>
  );
}
