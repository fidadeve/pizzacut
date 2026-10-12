import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useToast } from '../../lib/toast';
import { ErrorState, Skeleton } from '../../components/ui';

interface RawSettings {
  store_name: string; tagline: string; phone: string; email: string; address: string; hours: string;
  currency_symbol: string; currency_code: string;
  delivery_fee_cents: number; free_delivery_min_cents: number; tax_pct: number; extra_cheese_cents: number;
  eta_delivery_minutes: number; eta_pickup_minutes: number;
  auto_advance: number;
  pay_cod: number; pay_upi: number; pay_card: number; pay_wallet: number;
}

export function AdminSettings() {
  const { push } = useToast();
  const { data, loading, error, retry } = useFetch(() => api.get<{ settings: RawSettings }>('/admin/settings'), []);
  const [form, setForm] = useState<RawSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { if (data) setForm(data.settings); }, [data]);

  if (loading || !form) {
    return <div className="space-y-4">{error ? <ErrorState message={error} onRetry={retry} /> : Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  const set = <K extends keyof RawSettings>(key: K, value: RawSettings[K]) => setForm(f => (f ? { ...f, [key]: value } : f));
  const dollars = (cents: number) => (cents / 100).toString();

  const save = async () => {
    setSaving(true); setFormError(null);
    try {
      await api.put('/admin/settings', {
        ...form,
        delivery_fee_cents: Math.round(form.delivery_fee_cents),
        free_delivery_min_cents: Math.round(form.free_delivery_min_cents),
        extra_cheese_cents: Math.round(form.extra_cheese_cents),
        tax_pct: Number(form.tax_pct),
        auto_advance: !!form.auto_advance,
        pay_cod: !!form.pay_cod, pay_upi: !!form.pay_upi, pay_card: !!form.pay_card, pay_wallet: !!form.pay_wallet,
      });
      push('Settings saved');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save settings');
      push(err instanceof Error ? err.message : 'Could not save settings', 'error');
    } finally { setSaving(false); }
  };

  const moneyField = (label: string, key: 'delivery_fee_cents' | 'free_delivery_min_cents' | 'extra_cheese_cents', hint?: string) => (
    <label><span className="label">{label}</span>
      <input className="field" type="number" min={0} step={0.5} value={dollars(form[key])}
        onChange={e => set(key, Math.round(Number(e.target.value || 0) * 100))} />
      {hint && <span className="mt-1 block text-[11.5px] font-semibold text-muted">{hint}</span>}</label>
  );

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-ink">Store settings</h1>
          <p className="text-[13px] font-semibold text-muted">Charges, hours, payments and order flow.</p>
        </div>
        <button onClick={() => void save()} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Save settings'}</button>
      </div>

      <section className="card mt-4 p-4">
        <h2 className="mb-3 text-base text-ink">Store details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Store name</span><input className="field" value={form.store_name} onChange={e => set('store_name', e.target.value)} /></label>
          <label><span className="label">Tagline</span><input className="field" value={form.tagline} onChange={e => set('tagline', e.target.value)} /></label>
          <label><span className="label">Phone</span><input className="field" value={form.phone} onChange={e => set('phone', e.target.value)} /></label>
          <label><span className="label">Email</span><input className="field" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="label">Address</span><input className="field" value={form.address} onChange={e => set('address', e.target.value)} /></label>
          <label className="sm:col-span-2"><span className="label">Opening hours</span><input className="field" value={form.hours} onChange={e => set('hours', e.target.value)} /></label>
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-3 text-base text-ink">Pricing &amp; delivery</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {moneyField('Delivery charge', 'delivery_fee_cents', 'Applied to delivery orders under the free-delivery minimum.')}
          {moneyField('Free delivery from', 'free_delivery_min_cents')}
          <label><span className="label">Tax rate (%)</span>
            <input className="field" type="number" min={0} max={30} step={0.5} value={form.tax_pct} onChange={e => set('tax_pct', Number(e.target.value))} /></label>
          {moneyField('Extra cheese', 'extra_cheese_cents')}
          <label><span className="label">Delivery ETA (minutes)</span>
            <input className="field" type="number" min={5} max={180} value={form.eta_delivery_minutes} onChange={e => set('eta_delivery_minutes', Number(e.target.value))} /></label>
          <label><span className="label">Pickup ETA (minutes)</span>
            <input className="field" type="number" min={5} max={180} value={form.eta_pickup_minutes} onChange={e => set('eta_pickup_minutes', Number(e.target.value))} /></label>
          <label><span className="label">Currency symbol</span><input className="field" maxLength={4} value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} /></label>
          <label><span className="label">Currency code</span><input className="field" maxLength={5} value={form.currency_code} onChange={e => set('currency_code', e.target.value)} /></label>
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-1 text-base text-ink">Payment methods</h2>
        <p className="mb-3 text-[12.5px] font-semibold text-muted">Only enabled methods can be selected at checkout — customers never see unconfigured options as working.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {([['pay_cod', 'Cash on Delivery'], ['pay_upi', 'UPI / QR payment'], ['pay_card', 'Credit / Debit card'], ['pay_wallet', 'Digital wallet']] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3.5">
              <span className="text-[13.5px] font-extrabold text-ink">{label}</span>
              <input type="checkbox" className="h-5 w-5 accent-[#FF0018]" checked={!!form[key]}
                onChange={e => set(key, (e.target.checked ? 1 : 0) as never)} />
            </label>
          ))}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-1 text-base text-ink">Order flow</h2>
        <label className="flex items-start justify-between gap-4 rounded-2xl border border-line p-3.5">
          <span>
            <span className="block text-[13.5px] font-extrabold text-ink">Auto-advance demo kitchen</span>
            <span className="block text-[12px] font-semibold text-muted">Moves orders through the five tracking stages automatically for demos and tests. Turn it off to set every status manually.</span>
          </span>
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#FF0018]" checked={!!form.auto_advance}
            onChange={e => set('auto_advance', (e.target.checked ? 1 : 0) as never)} />
        </label>
      </section>

      {formError && <p className="mt-4 rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{formError}</p>}

      <div className="mt-4 flex justify-end">
        <button onClick={() => void save()} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save settings'}</button>
      </div>
    </div>
  );
}
