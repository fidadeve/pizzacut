import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useSettings } from '../../lib/settings';
import { money, formatDate } from '../../lib/format';
import { ErrorState, Skeleton } from '../../components/ui';
import { Icon } from '../../components/icons';

export function AdminOverview() {
  const { settings } = useSettings();
  const sym = settings.currencySymbol;
  const { data, loading, error, retry } = useFetch(() => api.get<{ overview: Record<string, unknown> }>('/admin/overview'), []);

  if (loading) return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (error || !data) return <ErrorState message={error ?? 'Could not load the dashboard.'} onRetry={retry} />;

  const o = data.overview as {
    todayOrders: number; todayRevenueCents: number; avgOrderCents: number; openOrders: number;
    totalOrders: number; totalRevenueCents: number;
    byStatus: Record<string, number>;
    last7: { day: string; orders: number; revenue: number }[];
    topProducts: { name: string; qty: number; revenue: number }[];
    recent: { id: string; number: string; customer: string; totalCents: number; status: string; fulfilment: string; createdAt: number; itemCount: number }[];
  };

  const maxRevenue = Math.max(1, ...o.last7.map(d => d.revenue));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Orders today', value: String(o.todayOrders), icon: 'receipt' as const },
          { label: 'Revenue today', value: money(o.todayRevenueCents, sym), icon: 'cash' as const },
          { label: 'Open orders', value: String(o.openOrders), icon: 'flame' as const },
          { label: 'Avg order', value: money(o.avgOrderCents, sym), icon: 'sparkle' as const },
        ].map(card => (
          <div key={card.label} className="card p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name={card.icon} className="h-4.5 w-4.5" /></span>
            <p className="mt-3 font-display text-2xl text-ink">{card.value}</p>
            <p className="text-[12px] font-bold text-muted">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="text-base text-ink">Last 7 days</h2>
          <div className="mt-4 flex h-40 items-end gap-2">
            {o.last7.length === 0 && <p className="self-center text-[13px] font-semibold text-muted">No sales yet — orders will chart here.</p>}
            {o.last7.map(day => (
              <div key={day.day} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10.5px] font-extrabold text-charcoal opacity-0 transition-opacity group-hover:opacity-100">{money(day.revenue, sym)}</span>
                <div className="mx-auto w-full max-w-12 rounded-t-lg bg-brand transition-all hover:bg-brand-dark" style={{ height: `${Math.max(6, (day.revenue / maxRevenue) * 120)}px` }} />
                <span className="text-[10.5px] font-bold text-muted">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-base text-ink">Top products</h2>
          <ul className="mt-3 space-y-2.5">
            {o.topProducts.length === 0 && <p className="text-[13px] font-semibold text-muted">Nothing sold yet.</p>}
            {o.topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 text-[13px]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charcoal font-display text-[12px] text-white">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-extrabold text-ink">{p.name}</span>
                <span className="shrink-0 font-bold text-muted">{p.qty} sold</span>
                <span className="shrink-0 font-display text-brand">{money(p.revenue, sym)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base text-ink">Recent orders</h2>
          <Link to="/admin/orders" className="text-[13px] font-extrabold text-brand hover:underline">Manage all →</Link>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {o.recent.length === 0 && <li className="py-3 text-[13px] font-semibold text-muted">No orders yet.</li>}
          {o.recent.map(order => (
            <li key={order.id} className="flex items-center gap-3 py-2.5 text-[13px]">
              <span className="min-w-0">
                <span className="block font-extrabold text-ink">{order.number} · {order.customer}</span>
                <span className="block text-[11.5px] font-bold text-muted">{formatDate(order.createdAt)} · {order.itemCount} items · {order.fulfilment}</span>
              </span>
              <span className="ml-auto shrink-0 font-display text-brand">{money(order.totalCents, sym)}</span>
              <span className={`pill-badge shrink-0 ${order.status === 'delivered' ? 'bg-charcoal text-white' : order.status === 'cancelled' ? 'bg-surface text-muted' : 'bg-brand-soft text-brand'}`}>{order.status.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
