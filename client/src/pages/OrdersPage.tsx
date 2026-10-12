import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useSettings } from '../lib/settings';
import type { Order, OrderStatus } from '../lib/types';
import { formatDate, money } from '../lib/format';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';

function pill(status: OrderStatus) {
  switch (status) {
    case 'delivered': return { label: 'Delivered', cls: 'bg-charcoal text-white' };
    case 'cancelled': return { label: 'Cancelled', cls: 'bg-surface text-muted' };
    case 'out_for_delivery':
    case 'ready_for_pickup': return { label: 'On the way', cls: 'bg-brand text-white' };
    default: return { label: 'In progress', cls: 'bg-brand-soft text-brand' };
  }
}

export function OrdersPage() {
  const { settings } = useSettings();
  const { data, loading, error, retry } = useFetch(() => api.get<{ orders: Order[] }>('/orders'), []);
  const orders = data?.orders ?? [];
  const sym = settings.currencySymbol;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
      <h1 className="text-[26px] text-ink sm:text-3xl">My orders</h1>
      <p className="mt-0.5 text-[13px] font-semibold text-muted">Every order you place on this device or account.</p>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : orders.length === 0 ? (
          <EmptyState icon="receipt" title="No orders yet"
            body="When you order, every pizza's journey shows up here with live status."
            action={<Link to="/menu" className="btn btn-primary btn-sm">Start your first order</Link>} />
        ) : (
          orders.map(order => {
            const p = pill(order.status);
            const active = order.status !== 'delivered' && order.status !== 'cancelled';
            return (
              <article key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold text-ink">{order.number}</p>
                    <p className="text-[12px] font-bold text-muted">{formatDate(order.createdAt)} · {order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                  </div>
                  <span className={`pill-badge shrink-0 ${p.cls}`}>{p.label}</span>
                </div>
                <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-muted">
                  {order.items.map(i => `${i.qty}× ${i.name}`).join(', ')}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-display text-[19px] text-brand">{money(order.totals.totalCents, sym)}</span>
                  <div className="flex gap-2">
                    {active && (
                      <Link to={`/orders/${order.id}/track`} className="btn btn-primary btn-sm">
                        <Icon name="bike" className="h-4 w-4" /> Track
                      </Link>
                    )}
                    <Link to={`/orders/${order.id}/track`} className="btn btn-outline btn-sm">Details</Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
