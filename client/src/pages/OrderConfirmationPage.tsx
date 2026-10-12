import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useSettings } from '../lib/settings';
import type { Order } from '../lib/types';
import { money, timeUntil } from '../lib/format';
import { ErrorState, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';

export function OrderConfirmationPage() {
  const { id = '' } = useParams();
  const { settings } = useSettings();
  const { data, loading, error, retry } = useFetch(() => api.get<{ order: Order }>(`/orders/${encodeURIComponent(id)}`), [id]);
  const order = data?.order;
  const sym = settings.currencySymbol;

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10">
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto mt-5 h-8 w-64" />
        <Skeleton className="mt-6 h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-8">
        <ErrorState message={error ?? 'We could not find that order.'} onRetry={error ? retry : undefined} />
        <div className="flex justify-center gap-2 pb-8">
          <Link to="/orders" className="btn btn-outline btn-sm">My orders</Link>
          <Link to="/" className="btn btn-dark btn-sm">Back home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-8">
      <div className="animate-pop-in flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-brand">
          <Icon name="check" className="h-10 w-10" strokeWidth={2.6} />
        </span>
        <h1 className="mt-4 text-3xl text-ink">Order confirmed!</h1>
        <p className="mt-1 max-w-sm text-[14px] font-semibold text-muted">
          Our kitchen has accepted order <span className="font-extrabold text-charcoal">{order.number}</span>. Here's what happens next.
        </p>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center gap-3 bg-charcoal p-4 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><Icon name="clock" className="h-6 w-6 text-brand" /></span>
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-white/60">
              {order.fulfilment === 'pickup' ? 'Ready for pickup in' : 'Estimated delivery in'}
            </p>
            <p className="font-display text-xl leading-tight">{timeUntil(order.etaAt)}</p>
          </div>
          <Link to={`/orders/${order.id}/track`} className="btn btn-primary btn-sm ml-auto">Track</Link>
        </div>

        <div className="p-4">
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
            {order.totals.discountCents > 0 && (
              <div className="flex justify-between text-brand"><dt>Discount ({order.promoCode})</dt><dd>−{money(order.totals.discountCents, sym)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-muted">{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{order.totals.deliveryCents === 0 ? <span className="text-brand">Free</span> : money(order.totals.deliveryCents, sym)}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-base font-extrabold">Total paid on {order.paymentMethod === 'cod' ? 'delivery' : 'payment'}</dt><dd className="font-display text-xl text-brand">{money(order.totals.totalCents, sym)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="card mt-4 p-4 text-[13px] font-semibold text-muted">
        <p className="flex items-start gap-2">
          <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {order.fulfilment === 'pickup'
            ? <>Pickup from {settings.address}</>
            : <>Delivering to {order.address?.line1}, {order.address?.city} {order.address?.zip}</>}
        </p>
        <p className="mt-2 flex items-start gap-2">
          <Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          Questions? Call us at <a className="font-extrabold text-brand hover:underline" href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}>{settings.phone}</a> with order number {order.number}.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link to={`/orders/${order.id}/track`} className="btn btn-primary flex-1">Track my order</Link>
        <Link to="/menu" className="btn btn-outline flex-1">Order more food</Link>
      </div>
    </div>
  );
}
