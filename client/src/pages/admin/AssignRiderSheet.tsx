import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { Rider } from '../../lib/types';
import { Sheet, Spinner } from '../../components/ui';
import { Icon } from '../../components/icons';

/**
 * Rider selection dialog: lists active riders only, with availability and
 * current load, then asks for explicit confirmation before assigning.
 */
export function AssignRiderSheet({ orderId, orderNumber, onClose, onAssigned }: {
  orderId: string; orderNumber: string; onClose: () => void; onAssigned: () => void;
}) {
  const riders = useFetch(() => api.get<{ riders: Rider[] }>('/admin/riders'), []);
  const [picked, setPicked] = useState<Rider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = (riders.data?.riders ?? []).filter(r => r.status === 'active');
  const others = (riders.data?.riders ?? []).filter(r => r.status !== 'active');

  const confirmAssign = async () => {
    if (!picked) return;
    setBusy(true); setError(null);
    try {
      await api.patch(`/admin/orders/${orderId}/assign`, { riderId: picked.id });
      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed.');
    } finally { setBusy(false); }
  };

  const list = (rs: Rider[], title?: string) => rs.length === 0 ? null : (
    <>
      {title && <p className="mt-3 text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</p>}
      <div className="mt-2 space-y-2">
        {rs.map(r => {
          const sel = picked?.id === r.id;
          return (
            <button key={r.id} onClick={() => setPicked(r)} disabled={busy} aria-pressed={sel}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${sel ? 'border-brand bg-brand-soft' : 'border-line hover:border-charcoal/30'}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon name="bike" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-extrabold text-ink">{r.name} <span className="font-bold text-muted">({r.username})</span></span>
                <span className="block truncate text-[11.5px] font-bold text-muted">
                  {r.phone ?? '—'} · {r.availability === 'online' ? 'online' : 'offline'} · {r.activeDeliveries} active delivery{r.activeDeliveries === 1 ? '' : 'ies'}
                </span>
              </span>
              {sel && <Icon name="checkCircle" className="ml-auto h-5 w-5 shrink-0 text-brand" />}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <Sheet open onClose={onClose} title="Assign rider"
      footer={picked ? (
        <div>
          <p className="mb-2 rounded-2xl bg-brand-soft p-3 text-center text-[13px] font-bold text-brand">
            {orderNumber} → {picked.name}. The rider will be notified in their portal.
          </p>
          <button disabled={busy} onClick={() => void confirmAssign()} className="btn btn-primary w-full justify-center">
            {busy ? <><Spinner className="h-5 w-5" /> Assigning…</> : `Confirm — assign ${picked.name}`}
          </button>
        </div>
      ) : (
        <p className="pb-1 text-center text-[12.5px] font-semibold text-muted">Select a rider to continue.</p>
      )}>
      {riders.loading ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6 text-brand" /></div>
      ) : riders.error ? (
        <p className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand">{riders.error}</p>
      ) : (
        <>
          {list(active)}
          {list(others, 'Inactive / suspended (cannot be assigned)')}
          {!riders.error && active.length === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-[13px] font-bold text-muted">
              No active riders available right now — create or activate one in the Riders tab.
            </p>
          )}
          {error && <p className="mt-3 rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{error}</p>}
        </>
      )}
    </Sheet>
  );
}
