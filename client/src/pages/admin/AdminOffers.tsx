import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useSettings } from '../../lib/settings';
import { useToast } from '../../lib/toast';
import type { PublicPromo } from '../../lib/types';
import { money } from '../../lib/format';
import { ErrorState, Sheet, Skeleton } from '../../components/ui';

interface AdminPromo extends PublicPromo { id: string; active: boolean; usedCount: number }

const EMPTY = { code: '', description: '', type: 'percent' as 'percent' | 'flat', value: 10, minOrder: 20, maxDiscount: '', active: true };

export function AdminOffers() {
  const { settings } = useSettings();
  const { push } = useToast();
  const sym = settings.currencySymbol;
  const { data, loading, error, retry } = useFetch(() => api.get<{ promos: AdminPromo[] }>('/admin/promos'), []);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const startNew = () => { setForm({ ...EMPTY }); setEditingId(null); setFormError(null); setOpen(true); };
  const startEdit = (p: AdminPromo) => {
    setForm({ code: p.code, description: p.description, type: p.type, value: p.value, minOrder: p.minOrderCents / 100, maxDiscount: p.maxDiscountCents != null ? String(p.maxDiscountCents / 100) : '', active: p.active });
    setEditingId(p.id); setFormError(null); setOpen(true);
  };

  const save = async () => {
    setSaving(true); setFormError(null);
    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      type: form.type,
      value: form.type === 'percent' ? Math.round(form.value) : Math.round(form.value * 100),
      minOrderCents: Math.round(form.minOrder * 100),
      maxDiscountCents: form.maxDiscount ? Math.round(Number(form.maxDiscount) * 100) : null,
      active: form.active,
    };
    try {
      if (editingId) await api.patch(`/admin/promos/${editingId}`, payload);
      else await api.post('/admin/promos', payload);
      push(editingId ? 'Promo updated' : 'Promo created');
      setOpen(false);
      retry();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the promo');
    } finally { setSaving(false); }
  };

  const toggle = async (p: AdminPromo) => {
    try { await api.patch(`/admin/promos/${p.id}`, { active: !p.active }); retry(); push(p.active ? 'Promo deactivated' : 'Promo activated'); }
    catch (err) { push(err instanceof Error ? err.message : 'Could not update promo', 'error'); }
  };

  const remove = async (p: AdminPromo) => {
    if (!window.confirm(`Delete promo ${p.code}? This cannot be undone.`)) return;
    try { await api.del(`/admin/promos/${p.id}`); retry(); push('Promo deleted'); }
    catch (err) { push(err instanceof Error ? err.message : 'Could not delete promo', 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-ink">Promo codes</h1>
          <p className="text-[13px] font-semibold text-muted">Codes are validated server-side at checkout.</p>
        </div>
        <button onClick={startNew} className="btn btn-primary btn-sm">New promo</button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : error ? <ErrorState message={error} onRetry={retry} />
          : data?.promos.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line p-8 text-center text-[13.5px] font-semibold text-muted">No promos yet. Create your first one.</p>
          ) : (
            data!.promos.map(p => (
              <article key={p.id} className={`card p-4 ${!p.active ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-2xl border-2 border-dashed border-brand px-3 py-1 font-display text-lg tracking-wide text-brand">{p.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-extrabold text-ink">{p.description || '—'}</p>
                    <p className="text-[12px] font-semibold text-muted">
                      {p.type === 'percent' ? `${p.value}% off` : `${money(p.value, sym)} off`}
                      {p.minOrderCents > 0 ? ` · min ${money(p.minOrderCents, sym)}` : ''}
                      {p.maxDiscountCents != null ? ` · cap ${money(p.maxDiscountCents, sym)}` : ''}
                      {' · '}{p.usedCount} used
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => void toggle(p)} className={`btn btn-sm ${p.active ? 'btn-outline' : 'btn-dark'}`}>{p.active ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => startEdit(p)} className="btn btn-outline btn-sm">Edit</button>
                    <button onClick={() => void remove(p)} className="btn btn-ghost btn-sm text-brand hover:bg-brand-soft">Delete</button>
                  </div>
                </div>
              </article>
            ))
          )}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit promo' : 'New promo'}
        footer={<button onClick={() => void save()} disabled={saving || form.code.trim().length < 3} className="btn btn-primary w-full">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create promo'}</button>}>
        <div className="space-y-3 pb-2">
          <label><span className="label">Code</span>
            <input className="field uppercase tracking-wider" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="PIZZA25" /></label>
          <label><span className="label">Description shown to customers</span>
            <input className="field" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="25% off orders over $20" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">Type</span>
              <select className="field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percent' | 'flat' }))}>
                <option value="percent">Percentage</option>
                <option value="flat">Flat amount</option>
              </select></label>
            <label><span className="label">{form.type === 'percent' ? 'Percent off' : 'Amount off ($)'}</span>
              <input className="field" type="number" min={1} step={form.type === 'percent' ? 1 : 0.5} value={form.value}
                onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} /></label>
            <label><span className="label">Minimum order ($)</span>
              <input className="field" type="number" min={0} step={0.5} value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: Number(e.target.value) }))} /></label>
            <label><span className="label">Max discount ($) — optional</span>
              <input className="field" type="number" min={0} step={0.5} value={form.maxDiscount} onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} placeholder="No cap" /></label>
          </div>
          <label className="flex items-center gap-2 text-[13.5px] font-extrabold text-ink">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="h-4 w-4 accent-[#FF0018]" />
            Active (customers can apply it)
          </label>
          {formError && <p className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{formError}</p>}
        </div>
      </Sheet>
    </div>
  );
}
