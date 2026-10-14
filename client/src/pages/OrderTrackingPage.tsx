import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useSettings } from '../lib/settings';
import type { Order, OrderStatus } from '../lib/types';
import { formatDate, money, timeAgo, timeUntil } from '../lib/format';
import { LocationMapEmbed, mapsNavLink } from '../components/LocationMap';
import { LiveDeliveryMapBoundary as LiveDeliveryMap } from '../components/LiveMap';
import type { RiderLiveLocation } from '../lib/types';
import { ErrorState, Skeleton } from '../components/ui';
import { Icon, type IconName } from '../components/icons';

const STAGE_ICONS: Record<string, IconName> = {
  received: 'receipt', confirmed: 'checkCircle', preparing: 'flame',
  out_for_delivery: 'bike', ready_for_pickup: 'bag', delivered: 'checkCircle',
};

function statusPill(status: OrderStatus) {
  switch (status) {
    case 'delivered': return { label: 'Delivered', cls: 'bg-charcoal text-white' };
    case 'cancelled': return { label: 'Cancelled', cls: 'bg-surface text-muted' };
    case 'out_for_delivery':
    case 'ready_for_pickup': return { label: 'On the way', cls: 'bg-brand text-white' };
    default: return { label: 'In progress', cls: 'bg-brand-soft text-brand' };
  }
}

export function OrderTrackingPage() {
  const { id = '' } = useParams();
  const { settings } = useSettings();
  const { data, loading, error, retry } = useFetch(
    () => api.get<{ order: Order }>(`/orders/${encodeURIComponent(id)}`), [id],
  );
  const order = data?.order;

  // Real-time rider position — poll only while an assigned delivery is in flight.
  const liveActive = !!order && order.fulfilment === 'delivery' && !!order.rider
    && ['assigned', 'accepted', 'picked_up', 'out_for_delivery'].includes(order.status);
  const live = useFetch<RiderLiveLocation>(
    () => api.get<RiderLiveLocation>(`/orders/${encodeURIComponent(id)}/rider-location`),
    [id], liveActive,
  );
  const liveData = live.data;

  // Poll the live rider feed faster than the general order refresh.
  const refetchLive = live.retry;
  useEffect(() => {
    if (!liveActive) return;
    const timer = setInterval(() => { void refetchLive(); }, 5_000);
    return () => clearInterval(timer);
  }, [liveActive, refetchLive]);

  // Poll while the kitchen is still moving the order forward.
  useEffect(() => {
    if (!order?.autoAdvance) return;
    const timer = setInterval(() => { void retry(); }, 10_000);
    return () => clearInterval(timer);
  }, [order?.autoAdvance, retry]);

  if (loading && !order) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="mt-4 h-80 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-6">
        <ErrorState message={error ?? 'We could not find that order.'} onRetry={error ? retry : undefined} />
        <div className="pb-8 text-center"><Link to="/orders" className="btn btn-outline btn-sm">My orders</Link></div>
      </div>
    );
  }

  const sym = settings.currencySymbol;
  const pill = statusPill(order.status);

  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] leading-tight text-ink">Track order</h1>
          <p className="text-[13px] font-bold text-muted">{order.number} · {formatDate(order.createdAt)}</p>
        </div>
        <span className={`pill-badge ${pill.cls}`}>{pill.label}</span>
      </div>

      {/* Status hero */}
      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center gap-3 bg-charcoal p-5 text-white">
          <span className="animate-pulse-dot flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand">
            <Icon name={order.status === 'delivered' ? 'check' : STAGE_ICONS[order.status] ?? 'clock'} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-white/60">Current status</p>
            <p className="truncate font-display text-xl leading-tight">{order.statusLabel}</p>
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-white/60">ETA</p>
            <p className="font-display text-lg leading-tight text-brand">
              {order.status === 'delivered' ? 'Done' : timeUntil(order.etaAt)}
            </p>
          </div>
        </div>

        {/* Stepper */}
        <ol className="p-5">
          {order.tracking.stages.map((stage, i) => {
            const isLast = i === order.tracking.stages.length - 1;
            const done = stage.state === 'done';
            const current = stage.state === 'current';
            return (
              <li key={stage.key} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done ? 'border-brand bg-brand text-white'
                    : current ? 'animate-pulse-dot border-brand bg-white text-brand'
                    : 'border-line bg-white text-muted'}`}>
                    <Icon name={done ? 'check' : STAGE_ICONS[stage.key] ?? 'clock'} className="h-4.5 w-4.5" />
                  </span>
                  {!isLast && <span className={`my-1 w-0.5 flex-1 min-h-6 ${done ? 'bg-brand' : 'bg-line'}`} />}
                </div>
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                  <p className={`text-[14.5px] font-extrabold ${done || current ? 'text-ink' : 'text-muted'}`}>{stage.label}</p>
                  {current && !order.tracking.cancelled && (
                    <p className="text-[12.5px] font-bold text-brand">
                      {order.status === 'delivered' ? 'Completed' : 'Happening now'}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {order.tracking.cancelled && (
          <p className="mx-5 mb-5 rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand">
            This order was cancelled. Call us if you need a hand.
          </p>
        )}
      </div>

      {/* Rider card — only once the admin assigns someone */}
      {order.rider && (
        <div className="card mt-4 overflow-hidden">
          <div className="p-4 pb-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base text-ink">Your Rider</h2>
              {liveActive && (
                <span className={`pill-badge ${liveData?.location ? 'bg-brand text-white' : 'bg-surface text-muted'}`}>
                  {liveData?.location ? 'Live' : 'Tracking on'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                <Icon name="bike" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-extrabold text-ink">{order.rider.name}</p>
                <p className="truncate text-[12px] font-semibold text-muted">{order.rider.username} · PizzaCut rider</p>
              </div>
              {order.rider.phone && (
                <a href={`tel:${order.rider.phone.replace(/[^+\d]/g, '')}`} className="btn btn-outline btn-sm ml-auto shrink-0">
                  <Icon name="phone" className="h-4 w-4" /> Call rider
                </a>
              )}
            </div>
          </div>

          {/* Real-time "Your Rider" map */}
          {liveActive && order.deliveryLocation && (
            <div className="px-4 pb-4">
              <LiveDeliveryMap
                rider={liveData?.location ?? null}
                destination={order.deliveryLocation}
                riderLabel="Your rider"
                destinationLabel="You"
                live={!!liveData?.location}
                className="h-56"
                footer={liveData?.location
                  ? `Rider location updated ${timeAgo(liveData.location.updatedAt)} · accuracy ±${Math.round(liveData.location.accuracy ?? 0)} m`
                  : 'Waiting for your rider’s location… it appears as soon as they start moving.'}
              />
            </div>
          )}
        </div>
      )}

      {/* Confirmed delivery pin + navigation */}
      {order.fulfilment === 'delivery' && order.deliveryLocation && (
        <div className="card mt-4 space-y-2 p-4">
          <h2 className="text-base text-ink">Delivery pin</h2>
          {/* Live map above already renders this pin — skip the duplicate embed. */}
          {!liveActive && (
            <LocationMapEmbed lat={order.deliveryLocation.lat} lng={order.deliveryLocation.lng} label="Your delivery" />
          )}
          {order.deliveryLocation.landmark && (
            <p className="text-[12.5px] font-semibold text-muted">Landmark: {order.deliveryLocation.landmark}</p>
          )}
          {order.status === 'out_for_delivery' && (
            <a href={mapsNavLink(order.deliveryLocation.lat, order.deliveryLocation.lng)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm w-full justify-center">
              <Icon name="pin" className="h-4 w-4" /> Open my address in Maps
            </a>
          )}
        </div>
      )}

      {/* Order summary */}
      <div className="card mt-4 p-4">
        <h2 className="mb-3 text-base text-ink">Order summary</h2>
        <ul className="space-y-2.5">
          {order.items.map(item => (
            <li key={item.id} className="flex items-center gap-3">
              <img src={item.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-extrabold text-ink">{item.qty} × {item.name}</p>
                <p className="truncate text-[11.5px] font-semibold text-muted">
                  {[item.size, item.crust, ...item.toppings, item.extraCheese ? 'Extra cheese' : null].filter(Boolean).join(' · ') || 'As served'}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-bold">{money(item.lineTotalCents, sym)}</span>
            </li>
          ))}
        </ul>
        <dl className="divider mt-4 space-y-2 pt-3 text-[13.5px] font-bold">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(order.totals.subtotalCents, sym)}</dd></div>
          {order.totals.discountCents > 0 && <div className="flex justify-between text-brand"><dt>Discount ({order.promoCode})</dt><dd>−{money(order.totals.discountCents, sym)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{order.totals.deliveryCents === 0 ? <span className="text-brand">Free</span> : money(order.totals.deliveryCents, sym)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Taxes</dt><dd>{money(order.totals.taxCents, sym)}</dd></div>
          <div className="flex items-baseline justify-between pt-1"><dt className="text-base font-extrabold">Total</dt><dd className="font-display text-xl text-brand">{money(order.totals.totalCents, sym)}</dd></div>
        </dl>
      </div>

      {/* Details */}
      <div className="card mt-4 space-y-3 p-4 text-[13px] font-semibold text-muted">
        <p className="flex items-start gap-2"><Icon name="user" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {order.customer.name} · {order.customer.phone}</p>
        <p className="flex items-start gap-2"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {order.fulfilment === 'pickup'
            ? <>Pickup at {settings.address}</>
            : <>{order.address?.line1}{order.address?.line2 ? `, ${order.address.line2}` : ''}, {order.address?.city} {order.address?.zip}</>}
        </p>
        <p className="flex items-start gap-2"><Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {settings.hours}</p>
        {order.notes && <p className="flex items-start gap-2"><Icon name="edit" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />“{order.notes}”</p>}
        <p className="rounded-2xl bg-surface p-3 text-[12px] font-semibold">
          Status updates come straight from the kitchen. Need help?{' '}
          <a className="font-extrabold text-brand hover:underline" href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}>Call {settings.phone}</a>.
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <Link to="/orders" className="btn btn-outline flex-1">All orders</Link>
        <Link to="/menu" className="btn btn-dark flex-1">Order again</Link>
      </div>
    </div>
  );
}
