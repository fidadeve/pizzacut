import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { AppNotification, RiderDashboard, RiderMe, RiderOrder } from '../../lib/types';
import { formatDate, money } from '../../lib/format';
import { useSettings } from '../../lib/settings';
import { useToast } from '../../lib/toast';
import { LogoMark } from '../../components/Logo';
import { Icon, type IconName } from '../../components/icons';
import { ErrorState, Sheet, Spinner } from '../../components/ui';
import { LocationMapEmbed, mapsNavLink, mapsPinLink } from '../../components/LocationMap';
import { LiveDeliveryMapBoundary as LiveDeliveryMap } from '../../components/LiveMap';

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  assigned: { label: 'New — needs review', cls: 'bg-brand text-white' },
  accepted: { label: 'Accepted · preparing', cls: 'bg-charcoal text-white' },
  preparing: { label: 'Kitchen preparing', cls: 'bg-charcoal text-white' },
  ready_for_pickup: { label: 'Ready for pickup', cls: 'bg-charcoal text-white' },
  picked_up: { label: 'Picked up', cls: 'bg-brand text-white' },
  out_for_delivery: { label: 'Out for delivery', cls: 'bg-brand text-white' },
  delivered: { label: 'Delivered', cls: 'bg-surface text-muted' },
  delivery_failed: { label: 'Failed', cls: 'bg-brand-soft text-brand' },
  cancelled: { label: 'Cancelled', cls: 'bg-surface text-muted' },
};

function RiderLogin({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post<RiderMe>('/rider/login', { username: username.trim(), password });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-charcoal px-4">
      <form onSubmit={e => void submit(e)} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-pop">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="h-16 w-16" />
          <h1 className="mt-3 text-2xl text-ink">Rider portal</h1>
          <p className="mt-1 text-[13px] font-semibold text-muted">Sign in with the login ID from your manager.</p>
        </div>
        <div className="mt-5 space-y-3">
          <label><span className="label">Login ID (username)</span>
            <input className="field" value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" maxLength={24} required /></label>
          <label><span className="label">Password</span>
            <div className="relative">
              <input className="field pr-16" type={show ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-surface px-3 py-1.5 text-[11px] font-extrabold text-charcoal">
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
        </div>
        {error && <p className="mt-3 rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary mt-4 w-full">
          {busy ? <><Spinner className="h-5 w-5" /> Signing in…</> : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-[12px] font-semibold text-muted">
          Forgot your password? Your manager can reset it from the admin panel.
        </p>
        <p className="mt-1 text-center text-[11px] font-bold text-white/0">ø</p>
      </form>
      <p className="mt-6 text-[12px] font-semibold text-white/60">Developed by Syed Fida Ullah · <a href="tel:03326972158" className="text-brand font-extrabold hover:underline">03326972158</a></p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? { label: status, cls: 'bg-brand-soft text-brand' };
  return <span className={`pill-badge ${s.cls}`}>{s.label}</span>;
}

function OrderDetailsSheet({ order, onClose, riderPos }: {
  order: RiderOrder | null; onClose: () => void; riderPos?: { lat: number; lng: number } | null;
}) {
  const { settings } = useSettings();
  const sym = settings.currencySymbol;
  return (
    <Sheet open={!!order} onClose={onClose} title={order ? `Order ${order.number}` : ''}>
      {order && (
        <div className="space-y-4 pb-4">
          <div className="flex items-center justify-between">
            <StatusPill status={order.status} />
            <span className="font-display text-lg text-brand">{money(order.totals.totalCents, sym)} · {settings.paymentMethods.find(m => m.id === order.paymentMethod)?.label ?? order.paymentMethod}</span>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white"><Icon name="user" className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold text-ink">{order.customer.name}</p>
              <p className="text-[12px] font-semibold text-muted">Assigned {formatDate(order.assignmentTime)}</p>
            </div>
            <a href={`tel:${order.customer.phone.replace(/[^+\d]/g, '')}`} className="btn btn-primary btn-sm ml-auto shrink-0"><Icon name="phone" className="h-4 w-4" /> Call</a>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-muted">Delivery address</p>
            <p className="text-[13.5px] font-bold text-ink">
              {order.address ? `${order.address.line1}${order.address.line2 ? `, ${order.address.line2}` : ''}, ${order.address.city} ${order.address.zip}` : 'Stored pin location'}
            </p>
            {order.deliveryLocation?.landmark && <p className="text-[12px] font-semibold text-muted">Landmark: {order.deliveryLocation.landmark}</p>}
          </div>

          {order.deliveryLocation && (
            <>
              <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-muted">Your customer</p>
              <LiveDeliveryMap
                rider={riderPos ?? null}
                destination={order.deliveryLocation}
                riderLabel="You"
                destinationLabel="Your customer"
                live={!!riderPos}
                className="h-48"
                footer={`${order.customer.name} · ${order.deliveryLocation.landmark ?? 'pin on map'}`}
              />
              <div className="grid grid-cols-2 gap-2">
                <a href={mapsNavLink(order.deliveryLocation.lat, order.deliveryLocation.lng)} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm justify-center">
                  <Icon name="pin" className="h-4 w-4" /> Start navigation
                </a>
                <a href={mapsPinLink(order.deliveryLocation.lat, order.deliveryLocation.lng)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm justify-center">Open in Maps</a>
              </div>
            </>
          )}

          <div>
            <p className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-muted">Items</p>
            <ul className="space-y-1.5 text-[13px] font-bold">
              {order.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 rounded-xl bg-surface px-3 py-2">
                  <span className="min-w-0 truncate">{it.qty} × {it.name}{it.size ? ` · ${it.size.split(' · ')[0]}` : ''}</span>
                  <span className="shrink-0">{money(it.lineTotalCents, sym)}</span>
                </li>
              ))}
            </ul>
          </div>

          {order.notes && (
            <div className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand">
              <Icon name="edit" className="mr-1.5 inline h-4 w-4" />Special instructions: “{order.notes}”
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function IssueSheet({ order, onClose }: { order: RiderOrder | null; onClose: () => void }) {
  const { push } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!order || reason.trim().length < 5) return;
    setBusy(true);
    try {
      await api.post(`/rider/orders/${order.id}/issue`, { reason: reason.trim() });
      push('Problem reported — the store has been notified');
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not report the issue', 'error');
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!order} onClose={onClose} title="Report a delivery problem"
      footer={<button disabled={busy || reason.trim().length < 5} onClick={() => void submit()} className="btn btn-primary w-full justify-center">
        {busy ? <><Spinner className="h-5 w-5" /> Sending…</> : 'Report problem'}
      </button>}>
      <div className="pb-4">
        <p className="text-[13px] font-semibold text-muted">Tell the store what went wrong with {order?.number}. Nothing is charged or reopened automatically — a staff member will follow up.</p>
        <textarea className="field mt-3 min-h-28 py-3" value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
          placeholder="e.g. Customer not answering the door / wrong address pin / gate locked…" />
      </div>
    </Sheet>
  );
}

function OrderCard({ order, onOpen, onAction, onIssue, showLiveMap = false, riderPos = null }: {
  order: RiderOrder; onOpen: () => void; onAction: (kind: 'accept' | 'picked_up' | 'out_for_delivery' | 'delivered') => void; onIssue: () => void; showLiveMap?: boolean; riderPos?: { lat: number; lng: number } | null;
}) {
  const loc = order.deliveryLocation;
  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="bag" className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-extrabold text-ink">{order.number} · {order.customer.name}</p>
          <p className="truncate text-[12px] font-bold text-muted">{order.items.length} item{order.items.length === 1 ? '' : 's'} · assigned {formatDate(order.assignmentTime)}</p>
        </div>
        <div className="ml-auto shrink-0"><StatusPill status={order.status} /></div>
      </div>

      {loc && showLiveMap && (
        <div className="px-4 pb-3">
          <LiveDeliveryMap
            rider={riderPos}
            destination={loc}
            riderLabel="You"
            destinationLabel="Your customer"
            live={!!riderPos}
            className="h-44"
            footer={`Navigate to ${order.customer.name}${loc.landmark ? ` · ${loc.landmark}` : ''}`}
          />
        </div>
      )}
      {loc && !showLiveMap && (
        <div className="px-4 pb-3">
          <LocationMapEmbed lat={loc.lat} lng={loc.lng} label="Delivery" />
        </div>
      )}

      <div className="space-y-1 px-4 pb-3 text-[13px] font-bold text-ink">
        <p className="flex items-start gap-2"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          {order.address ? `${order.address.line1}, ${order.address.city} ${order.address.zip}` : 'See map pin'}{loc?.landmark ? ` · ${loc.landmark}` : ''}</p>
        <p className="flex items-center gap-2"><Icon name="phone" className="h-4 w-4 shrink-0 text-brand" />
          <a href={`tel:${order.customer.phone.replace(/[^+\d]/g, '')}`} className="font-extrabold text-brand hover:underline">{order.customer.phone}</a></p>
        <p><Icon name="cash" className="mr-2 inline h-4 w-4 text-brand" />{money(order.totals.totalCents, '$')} · {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod}</p>
      </div>

      {(order.status === 'picked_up' || order.status === 'out_for_delivery') && loc && (
        <div className="px-4 pb-3">
          <a href={mapsNavLink(loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer" className="btn btn-dark btn-sm w-full justify-center">
            <Icon name="pin" className="h-4 w-4" /> Open navigation to {order.status === 'out_for_delivery' ? 'customer' : 'pickup'}
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line bg-surface/60 p-4">
        <button onClick={onOpen} className="btn btn-outline btn-sm"><Icon name="info" className="h-4 w-4" /> Details</button>
        {order.status === 'assigned' && (
          <button onClick={() => onAction('accept')} className="btn btn-primary btn-sm"><Icon name="check" className="h-4 w-4" /> Accept delivery</button>
        )}
        {['accepted', 'preparing', 'ready_for_pickup'].includes(order.status) && (
          <button onClick={() => onAction('picked_up')} className="btn btn-primary btn-sm"><Icon name="bag" className="h-4 w-4" /> Confirm pickup</button>
        )}
        {order.status === 'picked_up' && (
          <button onClick={() => onAction('out_for_delivery')} className="btn btn-primary btn-sm"><Icon name="bike" className="h-4 w-4" /> Out for delivery</button>
        )}
        {order.status === 'out_for_delivery' && (
          <button onClick={() => onAction('delivered')} className="btn btn-primary btn-sm"><Icon name="checkCircle" className="h-4 w-4" /> Mark as delivered</button>
        )}
        {!['delivered', 'cancelled'].includes(order.status) && (
          <button onClick={onIssue} className="btn btn-outline btn-sm text-brand"><Icon name="close" className="h-4 w-4" /> Problem</button>
        )}
      </div>
    </article>
  );
}

export function RiderApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const dash = useFetch(() => (authed ? api.get<RiderDashboard>('/rider/dashboard') : Promise.resolve(null)), [authed], authed === true);
  const history = useFetch(() => (authed ? api.get<{ orders: RiderOrder[] }>('/rider/orders') : Promise.resolve(null)), [authed], authed === true);
  const notifs = useFetch(() => (authed ? api.get<{ notifications: AppNotification[]; unread: number }>('/rider/notifications') : Promise.resolve(null)), [authed], authed === true);
  const { push } = useToast();
  const [tab, setTab] = useState<'home' | 'history' | 'notifications'>('home');
  const [detail, setDetail] = useState<RiderOrder | null>(null);
  const [issueFor, setIssueFor] = useState<RiderOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Rider's own live GPS dot (same watch that feeds the server's rider_locations).
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);

  // Session probe on mount (invalid id/type is caught by the fetch hook).
  useEffect(() => {
    void (async () => {
      try { await api.get<RiderMe>('/rider/me'); setAuthed(true); }
      catch { setAuthed(false); }
    })();
  }, []);

  const refreshAll = useCallback(() => { void (async () => { await Promise.all([dash.retry(), history.retry(), notifs.retry()]); })(); }, [dash, history, notifs]);

  // Live GPS share: only while a delivery is actively in flight (server also
  // refuses to store anything without one, and throttles to 5s per ping).
  const hasActiveDelivery = !!(dash.data?.activeOrder
    && ['accepted', 'picked_up', 'out_for_delivery'].includes(dash.data.activeOrder.status));
  useEffect(() => {
    if (!authed || !hasActiveDelivery || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setRiderPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        void api.post('/rider/location', {
          lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy,
        }).catch(() => { /* offline/permission — dashboard keeps working */ });
      },
      () => { /* permission denied or GPS off — no location shared */ },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [authed, hasActiveDelivery]);

  const act = async (order: RiderOrder, kind: 'accept' | 'picked_up' | 'out_for_delivery' | 'delivered') => {
    setBusyId(order.id);
    try {
      if (kind === 'accept') await api.post(`/rider/orders/${order.id}/accept`);
      else await api.post(`/rider/orders/${order.id}/status`, { status: kind });
      push(kind === 'accept' ? 'Delivery accepted' : kind === 'delivered' ? `${order.number} marked delivered 🎉` : 'Status updated');
      refreshAll();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Action failed. Try again.', 'error');
    } finally { setBusyId(null); }
  };

  const toggleAvailability = async () => {
    const r = dash.data?.rider;
    if (!r) return;
    try { await api.patch('/rider/availability', { online: r.availability !== 'online' }); refreshAll(); }
    catch (err) { push(err instanceof Error ? err.message : 'Update failed', 'error'); }
  };

  const logout = async () => {
    await api.post('/rider/logout');
    setAuthed(false);
    setTab('home');
  };

  if (authed === null) {
    return <div className="flex min-h-dvh items-center justify-center bg-charcoal text-brand"><Spinner className="h-8 w-8" /></div>;
  }
  if (!authed) return <RiderLogin onDone={() => { setAuthed(true); }} />;

  const d = dash.data;
  const r = d?.rider;
  const cardIcon: Record<string, IconName> = { newOrders: 'bell', activeDeliveries: 'bike', deliveredToday: 'checkCircle', totalAssigned: 'receipt' };
  const counts: [string, number | undefined, string][] = [
    ['New assigned', d?.counts.newOrders, 'newOrders'],
    ['Active', d?.counts.activeDeliveries, 'activeDeliveries'],
    ['Done today', d?.counts.deliveredToday, 'deliveredToday'],
    ['Total', d?.counts.totalAssigned, 'totalAssigned'],
  ];

  return (
    <div className="min-h-dvh bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <LogoMark className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-ink">{r?.name}</p>
            <p className="truncate text-[11.5px] font-bold text-muted">{r?.vehicle || 'Rider'} · <span className={r?.availability === 'online' ? 'text-emerald-600' : 'text-muted'}>{r?.availability}</span></p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => void toggleAvailability()}
              className={`rounded-full px-3 py-2 text-[12px] font-extrabold transition-colors ${r?.availability === 'online' ? 'bg-emerald-600 text-white' : 'bg-surface text-charcoal hover:bg-line'}`}>
              {r?.availability === 'online' ? 'Online' : 'Go online'}
            </button>
            <button onClick={() => void logout()} aria-label="Log out" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-charcoal hover:bg-line">
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-lg gap-1 overflow-x-auto px-4 pb-2" aria-label="Rider sections">
          {([['home', 'Home', 'grid'], ['history', 'History', 'receipt'], ['notifications', `Notifs${(notifs.data?.unread ?? 0) > 0 ? ` (${notifs.data?.unread})` : ''}`, 'bell']] as const).map(([key, label, icon]) => (
            <button key={key} onClick={() => setTab(key)} aria-pressed={tab === key}
              className={`chip border ${tab === key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal hover:border-charcoal/30'}`}>
              <Icon name={icon} className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4 pb-16">
        {dash.loading && !d ? (
          <div className="flex justify-center py-20 text-brand"><Spinner className="h-8 w-8" /></div>
        ) : dash.error ? (
          <ErrorState message={dash.error} onRetry={dash.retry} />
        ) : tab === 'home' && (
          <>
            {/* Counter tiles */}
            <div className="grid grid-cols-4 gap-2">
              {counts.map(([label, val, key]) => (
                <div key={key} className="rounded-2xl bg-white p-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <Icon name={cardIcon[key]} className="mx-auto h-4 w-4 text-brand" />
                  <p className="mt-1 font-display text-lg leading-none text-ink">{val ?? '—'}</p>
                  <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
                </div>
              ))}
            </div>

            {/* Active delivery */}
            {d?.activeOrder && (
              <section className="mt-4">
                <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-muted">Active delivery</h2>
                <OrderCard order={d.activeOrder} showLiveMap riderPos={riderPos} onOpen={() => setDetail(d.activeOrder!)} onAction={k => void act(d.activeOrder!, k)} onIssue={() => setIssueFor(d.activeOrder!)} />
              </section>
            )}

            {/* New assigned */}
            <section className="mt-4">
              <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-muted">Assigned to you</h2>
              {(history.data?.orders ?? []).filter(o => ['assigned', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivery_failed'].includes(o.status)).length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13px] font-semibold text-muted">
                  Nothing assigned right now. Stay online — the admin assigns new deliveries here.
                </p>
              ) : (
                <div className="space-y-3">
                  {(history.data?.orders ?? []).filter(o => ['assigned', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivery_failed'].includes(o.status))
                    .map(o => <OrderCard key={o.id} order={o} onOpen={() => setDetail(o)} onAction={k => void act(o, k)} onIssue={() => setIssueFor(o)} />)}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'history' && (
          <section>
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-muted">Delivered orders</h2>
            {(history.data?.orders ?? []).filter(o => o.status === 'delivered').length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13px] font-semibold text-muted">No completed deliveries yet.</p>
            ) : (
              <div className="space-y-2.5">
                {(history.data?.orders ?? []).filter(o => o.status === 'delivered').map(o => (
                  <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-charcoal"><Icon name="checkCircle" className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-extrabold text-ink">{o.number} · {o.customer.name}</p>
                      <p className="truncate text-[11.5px] font-bold text-muted">{formatDate(o.assignmentTime)}</p>
                    </div>
                    <span className="ml-auto shrink-0 font-display text-base text-brand">{money(o.totals.totalCents, '$')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'notifications' && (
          <section>
            <button onClick={() => void api.post('/rider/notifications/read').then(notifs.retry).then(refreshAll)}
              className="mb-3 text-[12px] font-extrabold text-brand hover:underline">Mark all read</button>
            {(notifs.data?.notifications ?? []).length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13px] font-semibold text-muted">No notifications yet.</p>
            ) : (
              <ul className="space-y-2">
                {(notifs.data?.notifications ?? []).map(n => (
                  <li key={n.id} className={`rounded-2xl border p-3.5 ${n.read ? 'border-line bg-white' : 'border-brand/40 bg-brand-soft'}`}>
                    <p className="text-[13.5px] font-extrabold text-ink">{n.title}</p>
                    {n.body && <p className="text-[12px] font-semibold text-muted">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] font-bold text-muted">{formatDate(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <OrderDetailsSheet order={detail} riderPos={riderPos} onClose={() => setDetail(null)} />
      <IssueSheet order={issueFor} onClose={() => { setIssueFor(null); refreshAll(); }} />
      {busyId && <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center"><span className="rounded-full bg-charcoal px-4 py-2 text-[12px] font-extrabold text-white">Updating…</span></div>}

      <footer className="border-t border-line bg-white py-4 text-center text-[11.5px] font-semibold text-muted">
        Developed by Syed Fida Ullah · <a href="tel:03326972158" className="font-extrabold text-brand hover:underline">03326972158</a>
      </footer>
    </div>
  );
}
