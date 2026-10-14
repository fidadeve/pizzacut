import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useToast } from '../../lib/toast';
import type { Rider } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { ErrorState, Sheet, Skeleton, Spinner } from '../../components/ui';
import { Icon } from '../../components/icons';

const STATUS_PILL: Record<string, string> = {
  active: 'bg-charcoal text-white',
  inactive: 'bg-surface text-muted',
  suspended: 'bg-brand text-white',
};

function riderDefaults(): { name: string; username: string; password: string; phone: string; vehicle: string; status: Rider['status'] } {
  return { name: '', username: '', password: '', phone: '', vehicle: '', status: 'active' };
}

export function AdminRiders() {
  const { push } = useToast();
  const ridersFetch = useFetch(() => api.get<{ riders: Rider[] }>('/admin/riders'), []);
  const riders = ridersFetch.data?.riders ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(riderDefaults());
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<string | null>(null);

  // Per-rider detail + edit
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useFetch(
    () => (selected
      ? api.get<{ rider: Rider; activeOrders: { id: string; number: string; status: string; totalCents: number; createdAt: number }[]; completedOrders: { id: string; number: string; totalCents: number; createdAt: number }[] }>(`/admin/riders/${selected}`)
      : Promise.resolve(null)), [selected], !!selected);
  const [edit, setEdit] = useState<{ phone: string; vehicle: string; status: Rider['status']; password: string } | null>(null);

  const submitCreate = async () => {
    setBusy(true); setFieldErr(null);
    try {
      await api.post('/admin/riders', form);
      push('Rider account created');
      setCreateOpen(false);
      setForm(riderDefaults());
      void ridersFetch.retry();
    } catch (err) {
      setFieldErr(err instanceof Error ? err.message : 'Could not create the rider.');
    } finally { setBusy(false); }
  };

  const patchRider = async (id: string, patch: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api.patch(`/admin/riders/${id}`, patch);
      push(message);
      void ridersFetch.retry();
      void detail.retry();
      setEdit(null);
    } catch (err) {
      push(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl text-ink">Riders</h1>
        <button onClick={() => setCreateOpen(true)} className="btn btn-primary btn-sm ml-auto">
          <Icon name="plus" className="h-4 w-4" /> Create rider account
        </button>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-muted">
        Only admins create rider logins — there is no public rider sign-up. Share credentials in person or reset them here.
      </p>

      <div className="mt-4 space-y-3">
        {ridersFetch.loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : ridersFetch.error ? (
          <ErrorState message={ridersFetch.error} onRetry={ridersFetch.retry} />
        ) : riders.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13.5px] font-semibold text-muted">No riders yet — create the first account.</p>
        ) : (
          riders.map(r => (
            <article key={r.id} className="card overflow-hidden">
              <button onClick={() => setSelected(selected === r.id ? null : r.id)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={selected === r.id}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon name="bike" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-extrabold text-ink">{r.name} <span className="font-bold text-muted">({r.username})</span></p>
                  <p className="truncate text-[12px] font-bold text-muted">
                    {r.phone ?? '—'} · {r.vehicle || 'no vehicle on file'} · {r.availability === 'online' ? '🟢 online' : '⚪ offline'}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <span className="hidden text-center text-[11px] font-extrabold text-muted sm:block">{r.activeDeliveries} active · {r.deliveredToday} today</span>
                  <span className={`pill-badge ${STATUS_PILL[r.status]}`}>{r.status}</span>
                  <Icon name="chevronDown" className={`h-4 w-4 text-muted transition-transform ${selected === r.id ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {selected === r.id && (
                <div className="border-t border-line bg-surface/60 p-4 text-[13px]">
                  {detail.loading ? (
                    <div className="flex justify-center py-6 text-brand"><Spinner className="h-6 w-6" /></div>
                  ) : detail.error || !detail.data ? (
                    <p className="font-bold text-brand">{detail.error ?? 'Could not load rider.'}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {([['Active now', detail.data.rider.activeDeliveries, 'bike'], ['Today', detail.data.rider.deliveredToday, 'checkCircle'], ['All-time', detail.data.rider.totalDelivered, 'receipt'], ['Status', detail.data.rider.status, 'info']] as const).map(([label, val, icon]) => (
                          <div key={label} className="rounded-2xl border border-line bg-white p-3">
                            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted"><Icon name={icon} className="h-3.5 w-3.5 text-brand" />{label}</p>
                            <p className="mt-0.5 font-display text-lg text-ink">{val}</p>
                          </div>
                        ))}
                      </div>

                      <p className="mt-4 text-[12px] font-extrabold uppercase tracking-wide text-muted">Assigned orders</p>
                      {detail.data.activeOrders.length === 0 ? (
                        <p className="mt-1 text-[12.5px] font-semibold text-muted">None right now.</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {detail.data.activeOrders.map(o => (
                            <li key={o.id} className="rounded-xl bg-white px-3 py-2 text-[12.5px] font-bold">{o.number} · {o.status} · {formatDate(o.createdAt)}</li>
                          ))}
                        </ul>
                      )}

                      <p className="mt-4 text-[12px] font-extrabold uppercase tracking-wide text-muted">Completed deliveries</p>
                      {detail.data.completedOrders.length === 0 ? (
                        <p className="mt-1 text-[12.5px] font-semibold text-muted">No completed deliveries yet.</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {detail.data.completedOrders.slice(0, 10).map(o => (
                            <li key={o.id} className="rounded-xl bg-white px-3 py-2 text-[12.5px] font-bold text-muted">{o.number} · delivered {formatDate(o.createdAt)}</li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => setEdit({ phone: detail.data!.rider.phone ?? '', vehicle: detail.data!.rider.vehicle ?? '', status: detail.data!.rider.status, password: '' })}
                          className="btn btn-outline btn-sm"><Icon name="edit" className="h-4 w-4" /> Edit profile / reset password</button>
                        {detail.data!.rider.status === 'active'
                          ? <button disabled={busy} onClick={() => void patchRider(r.id, { status: 'inactive' }, `${r.name} deactivated`)} className="btn btn-outline btn-sm text-brand"><Icon name="close" className="h-4 w-4" /> Deactivate</button>
                          : <button disabled={busy} onClick={() => void patchRider(r.id, { status: 'active' }, `${r.name} activated`)} className="btn btn-primary btn-sm"><Icon name="check" className="h-4 w-4" /> Activate</button>}
                        {detail.data!.rider.status !== 'suspended' && (
                          <button disabled={busy} onClick={() => void patchRider(r.id, { status: 'suspended' }, `${r.name} suspended`)} className="btn btn-outline btn-sm text-brand"><Icon name="info" className="h-4 w-4" /> Suspend</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Create / edit sheets */}
      {(createOpen || edit?.password !== undefined) && createOpen && (
        <Sheet open title="Create rider account" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3 pb-4">
            <label className="block"><span className="label">Full name *</span>
              <input className="field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Fida Ullah" /></label>
            <label className="block"><span className="label">Login ID (username) *</span>
              <input className="field" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} maxLength={24} placeholder="e.g. fida" autoCapitalize="none" /></label>
            <label className="block"><span className="label">Password (min 8 chars) *</span>
              <input className="field" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="new-password" placeholder="••••••••" /></label>
            <label className="block"><span className="label">Phone *</span>
              <input className="field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} inputMode="tel" placeholder="+92 333 000 0000" /></label>
            <label className="block"><span className="label">Vehicle (optional)</span>
              <input className="field" value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} placeholder="Honda CD70 · ABC-123" /></label>
            <label className="block"><span className="label">Account status</span>
              <select className="field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Rider['status'] }))}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
              </select></label>
            {fieldErr && <p className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{fieldErr}</p>}
            <button disabled={busy} onClick={() => void submitCreate()} className="btn btn-primary w-full justify-center">
              {busy ? <><Spinner className="h-5 w-5" /> Creating…</> : 'Create rider'}
            </button>
            <p className="text-[11.5px] font-semibold text-muted">Passwords are stored hashed (PBKDF2) — they can be reset from this screen any time.</p>
          </div>
        </Sheet>
      )}

      {(!!selected && edit) && (
        <Sheet open title={`Edit ${detail.data?.rider.name ?? 'rider'}`} onClose={() => setEdit(null)}>
          <div className="space-y-3 pb-4">
            <label className="block"><span className="label">Phone</span>
              <input className="field" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} inputMode="tel" /></label>
            <label className="block"><span className="label">Vehicle</span>
              <input className="field" value={edit.vehicle} onChange={e => setEdit({ ...edit, vehicle: e.target.value })} /></label>
            <label className="block"><span className="label">Account status</span>
              <select className="field" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value as Rider['status'] })}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
              </select></label>
            <label className="block"><span className="label">Reset password (leave blank to keep current)</span>
              <input className="field" value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} autoComplete="new-password" placeholder="••••••••" /></label>
            <button disabled={busy} onClick={() => void patchRider(selected, {
              phone: edit.phone, vehicle: edit.vehicle, status: edit.status,
              ...(edit.password ? { password: edit.password } : {}),
            }, 'Rider updated')} className="btn btn-primary w-full justify-center">
              {busy ? <><Spinner className="h-5 w-5" /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
