import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useSettings } from '../../lib/settings';
import { useToast } from '../../lib/toast';
import type { Order, OrderStatus } from '../../lib/types';
import { formatDate, money } from '../../lib/format';
import { ErrorState, Skeleton } from '../../components/ui';
import { Icon } from '../../components/icons';

interface OrderRow { id: string; number: string; customer: string; phone: string; totalCents: number; status: string; fulfilment: 'delivery' | 'pickup'; createdAt: number; itemCount: number; }

const STATUS_LABELS: Record<string, string> = {
  received: 'Received', confirmed: 'Confirmed', preparing: 'Preparing',
  out_for_delivery: 'Out for delivery', ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered', cancelled: 'Cancelled', all: 'All',
};

const NEXT_ACTIONS: Record<string, OrderStatus[]> = {
  received: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'ready_for_pickup', 'delivered'],
  out_for_delivery: ['delivered'],
  ready_for_pickup: ['delivered'],
  delivered: [],
  cancelled: [],
};

function pillCls(status: string) {
  if (status === 'delivered') return 'bg-charcoal text-white';
  if (status === 'cancelled') return 'bg-surface text-muted';
  if (status === 'out_for_delivery' || status === 'ready_for_pickup') return 'bg-brand text-white';
  return 'bg-brand-soft text-brand';
}

export function AdminOrders() {
  const { settings } = useSettings();
  const { push } = useToast();
  const sym = settings.currencySymbol;
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const query = `?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, loading, error, retry } = useFetch(() => api.get<{ orders: OrderRow[]; statuses: string[] }>(`/admin/orders${query}`), [query]);
  const detail = useFetch(() => (expanded ? api.get<{ order: Order }>(`/admin/orders/${expanded}`) : Promise.resolve(null)), [expanded], !!expanded);

  const setStatusFor = async (orderId: string, next: OrderStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/admin/orders/${orderId}`, { status: next });
      push(`Order marked ${STATUS_LABELS[next].toLowerCase()}`);
      void detail.retry();
      void retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update the order', 'error');
    } finally { setUpdating(false); }
  };

  const statuses = data?.statuses ?? ['received', 'confirmed', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled'];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl text-ink">Orders</h1>
        <div className="relative ml-auto w-full sm:w-64">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)} className="field h-10 min-h-10 rounded-full pl-9 text-[13px]"
            placeholder="Search number, name, phone" aria-label="Search orders" />
        </div>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {['all', ...statuses].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`chip border ${status === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal hover:border-charcoal/30'}`}>
            {STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : data?.orders.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13.5px] font-semibold text-muted">No orders match this filter.</p>
        ) : (
          data!.orders.map(row => {
            const open = expanded === row.id;
            const order = detail.data?.order;
            return (
              <article key={row.id} className="card overflow-hidden">
                <button onClick={() => setExpanded(open ? null : row.id)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-extrabold text-ink">{row.number} · {row.customer}</p>
                    <p className="text-[12px] font-bold text-muted">{formatDate(row.createdAt)} · {row.itemCount} items · {row.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="font-display text-lg text-brand">{money(row.totalCents, sym)}</span>
                    <span className={`pill-badge ${pillCls(row.status)}`}>{STATUS_LABELS[row.status] ?? row.status}</span>
                    <Icon name="chevronDown" className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-line bg-surface/60 p-4">
                    {!detail.loading && order && order.id === row.id ? (
                      <>
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
                        <div className="divider mt-3 space-y-1.5 pt-3 text-[12.5px] font-semibold text-muted">
                          <p><Icon name="user" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />{order.customer.name} · {order.customer.phone}</p>
                          {order.address && <p><Icon name="pin" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city} {order.address.zip}</p>}
                          <p><Icon name="cash" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />{settings.paymentMethods.find(m => m.id === order.paymentMethod)?.label ?? order.paymentMethod} · total {money(order.totals.totalCents, sym)}{order.promoCode ? ` · promo ${order.promoCode}` : ''}</p>
                          {order.notes && <p><Icon name="edit" className="mr-1.5 inline h-3.5 w-3.5 text-brand" />“{order.notes}”</p>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {NEXT_ACTIONS[order.status].filter(next =>
                            !(order.fulfilment === 'pickup' && next === 'out_for_delivery') &&
                            !(order.fulfilment === 'delivery' && next === 'ready_for_pickup')).map(next => (
                            <button key={next} disabled={updating} onClick={() => void setStatusFor(row.id, next)}
                              className={`btn btn-sm ${next === 'cancelled' ? 'btn-outline text-brand' : 'btn-primary'}`}>
                              Mark {STATUS_LABELS[next]}
                            </button>
                          ))}
                          {NEXT_ACTIONS[order.status].length === 0 && (
                            <p className="text-[12.5px] font-bold text-muted">No further actions for this order.</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-center py-6 text-brand"><span className="h-6 w-6 animate-spin rounded-full border-[3px] border-brand border-t-transparent" /></div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
