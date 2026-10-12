import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { Order } from '../lib/types';
import { money } from '../lib/format';
import { useSelectedAddress } from '../components/AddressSelector';
import { EmptyState, Spinner } from '../components/ui';
import { Icon, type IconName } from '../components/icons';

const PAYMENT_ICONS: Record<string, IconName> = { cod: 'cash', upi: 'sparkle', card: 'card', wallet: 'bag' };

export function CheckoutPage() {
  const { cart, loading, busy } = useCart();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { push } = useToast();
  const navigate = useNavigate();
  const { selected: savedAddress, choose: chooseAddress } = useSelectedAddress();

  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup'>('delivery');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [addr, setAddr] = useState({ label: 'Home', line1: '', line2: '', city: '', zip: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setName(n => n || user.name);
      setPhone(p => p || (user.phone ?? ''));
      setEmail(e => e || user.email);
    }
  }, [user]);

  const enabledMethods = useMemo(() => settings.paymentMethods.filter(m => m.enabled), [settings.paymentMethods]);
  useEffect(() => {
    if (!paymentMethod && enabledMethods.length) setPaymentMethod(enabledMethods[0].id);
  }, [enabledMethods, paymentMethod]);

  const sym = settings.currencySymbol;
  const subtotal = cart?.subtotalCents ?? 0;
  const discount = cart?.discountCents ?? 0;
  const delivery = fulfilment === 'pickup' ? 0 : (subtotal >= settings.freeDeliveryMinCents ? 0 : settings.deliveryFeeCents);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * settings.taxPct / 100);
  const total = taxable + delivery + tax;

  if (!loading && cart && cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4">
        <EmptyState icon="cart" title="Nothing to check out yet"
          body="Add something delicious to your cart first."
          action={<Link to="/menu" className="btn btn-primary btn-sm">Browse the menu</Link>} />
      </div>
    );
  }

  const addressForOrder = fulfilment === 'pickup' ? null : (
    useNewAddress || !savedAddress || !user
      ? { label: addr.label || 'Home', line1: addr.line1, line2: addr.line2, city: addr.city, zip: addr.zip }
      : { label: savedAddress.label, line1: savedAddress.line1, line2: savedAddress.line2, city: savedAddress.city, zip: savedAddress.zip }
  );

  const placeOrder = async () => {
    setFormError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await api.post<{ order: Order }>('/orders', {
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        fulfilment,
        address: addressForOrder,
        paymentMethod,
        notes: notes.trim(),
        promoCode: cart?.promo?.code,
      });
      push('Order placed — the kitchen is on it!');
      navigate(`/order-confirmed/${res.order.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        const fe: Record<string, string> = {};
        for (const f of err.fields) fe[f.path] = f.message;
        setFieldErrors(fe);
        push(err.message, 'error');
      } else {
        setFormError('Something went wrong. Please try again.');
        push('Something went wrong. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart) return <div className="mx-auto max-w-2xl px-4 pt-8"><div className="flex justify-center py-20 text-brand"><Spinner className="h-8 w-8" /></div></div>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
      <h1 className="text-[26px] text-ink sm:text-3xl">Checkout</h1>
      <p className="mt-0.5 text-[13px] font-semibold text-muted">{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} · everything is re-checked by our system before submission.</p>

      {/* Fulfilment */}
      <section className="mt-5">
        <h2 className="mb-2 text-base text-ink">How do you want it?</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {([['delivery', 'Delivery', `Hot to your door · ${settings.etaDeliveryMinutes} min`, 'bike'], ['pickup', 'Pickup', `Ready in ${settings.etaPickupMinutes} min · free`, 'bag']] as const).map(([key, label, sub, icon]) => {
            const active = fulfilment === key;
            return (
              <button key={key} onClick={() => setFulfilment(key)} aria-pressed={active}
                className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition-all ${active ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-charcoal/30'}`}>
                <Icon name={icon} className={`h-5 w-5 ${active ? 'text-brand' : 'text-muted'}`} />
                <span className="text-[14px] font-extrabold text-ink">{label}</span>
                <span className="text-[11.5px] font-bold text-muted">{sub}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Address */}
      {fulfilment === 'delivery' && (
        <section className="mt-6">
          <h2 className="mb-2 text-base text-ink">Delivery address</h2>
          {user && user.addresses.length > 0 && !useNewAddress ? (
            <div className="space-y-2">
              {user.addresses.map(a => {
                const active = savedAddress?.id === a.id;
                return (
                  <button key={a.id} onClick={() => chooseAddress(a)} aria-pressed={active}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${active ? 'border-brand bg-brand-soft' : 'border-line hover:border-charcoal/30'}`}>
                    <Icon name="pin" className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-brand' : 'text-muted'}`} />
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-extrabold text-ink">{a.label}</span>
                      <span className="block truncate text-[12.5px] font-semibold text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.zip}</span>
                    </span>
                    {active && <Icon name="check" className="ml-auto h-5 w-5 shrink-0 text-brand" />}
                  </button>
                );
              })}
              <button onClick={() => setUseNewAddress(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-3 text-[13px] font-extrabold text-brand">
                <Icon name="plus" className="h-4 w-4" /> Use a different address
              </button>
            </div>
          ) : (
            <div className="card space-y-3 p-4">
              {user && (
                <button onClick={() => setUseNewAddress(false)} className="text-[12.5px] font-extrabold text-brand hover:underline">← Use saved addresses</button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2"><span className="label">Address label</span>
                  <input className="field" value={addr.label} onChange={e => setAddr(a => ({ ...a, label: e.target.value }))} placeholder="Home, Work…" /></label>
                <label className="col-span-2"><span className="label">Street address *</span>
                  <input className="field" value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))} placeholder="42 Pizza Lane" />
                  {fieldErrors['address.line1'] && <span className="mt-1 block text-[12px] font-bold text-brand">{fieldErrors['address.line1']}</span>}</label>
                <label className="col-span-2"><span className="label">Apartment, suite (optional)</span>
                  <input className="field" value={addr.line2} onChange={e => setAddr(a => ({ ...a, line2: e.target.value }))} placeholder="Apt 4B" /></label>
                <label><span className="label">City *</span>
                  <input className="field" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} placeholder="Foodtown" />
                  {fieldErrors['address.city'] && <span className="mt-1 block text-[12px] font-bold text-brand">{fieldErrors['address.city']}</span>}</label>
                <label><span className="label">Postal code *</span>
                  <input className="field" value={addr.zip} onChange={e => setAddr(a => ({ ...a, zip: e.target.value }))} placeholder="12345" inputMode="numeric" />
                  {fieldErrors['address.zip'] && <span className="mt-1 block text-[12px] font-bold text-brand">{fieldErrors['address.zip']}</span>}</label>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Contact */}
      <section className="mt-6">
        <h2 className="mb-2 text-base text-ink">Contact details</h2>
        <div className="card space-y-3 p-4">
          <label><span className="label">Full name *</span>
            <input className="field" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Alex Pepperoni" />
            {fieldErrors['customer.name'] && <span className="mt-1 block text-[12px] font-bold text-brand">{fieldErrors['customer.name']}</span>}</label>
          <label><span className="label">Phone number *</span>
            <input className="field" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+1 555 123 4567" />
            {fieldErrors['customer.phone'] && <span className="mt-1 block text-[12px] font-bold text-brand">{fieldErrors['customer.phone']}</span>}</label>
          <label><span className="label">Email for the receipt (optional)</span>
            <input className="field" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" />
            {fieldErrors['customer.email'] && <span className="mt-1 block text-[12px] font-bold text-brand">{fieldErrors['customer.email']}</span>}</label>
          {!user && (
            <p className="rounded-2xl bg-surface p-3 text-[12.5px] font-semibold text-muted">
              Ordering as a guest — your order stays trackable on this device. <Link to="/login" className="font-extrabold text-brand hover:underline">Sign in</Link> to keep it in your account.
            </p>
          )}
        </div>
      </section>

      {/* Payment */}
      <section className="mt-6">
        <h2 className="mb-2 text-base text-ink">Payment method</h2>
        <div className="space-y-2">
          {settings.paymentMethods.map(m => {
            const active = paymentMethod === m.id;
            return (
              <button key={m.id} disabled={!m.enabled} onClick={() => setPaymentMethod(m.id)} aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${
                  !m.enabled ? 'cursor-not-allowed border-line bg-surface opacity-60'
                  : active ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-charcoal/30'}`}>
                <Icon name={PAYMENT_ICONS[m.id] ?? 'card'} className={`h-5 w-5 shrink-0 ${active ? 'text-brand' : 'text-muted'}`} />
                <span className="text-[14px] font-extrabold text-ink">{m.label}</span>
                <span className="ml-auto text-[11.5px] font-bold text-muted">{m.enabled ? (m.id === 'cod' ? 'Pay at the door' : 'Configured') : 'Not available yet'}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] font-semibold text-muted">
          Digital payments activate here as soon as the business connects its payment provider — until then only configured methods can be selected.
        </p>
      </section>

      {/* Notes */}
      <section className="mt-6">
        <h2 className="mb-2 text-base text-ink">Order notes (optional)</h2>
        <textarea className="field min-h-20 resize-none py-3" value={notes} onChange={e => setNotes(e.target.value)}
          maxLength={300} placeholder="Allergies, extra napkins, gate code…" />
      </section>

      {/* Summary */}
      <section className="card mt-6 p-4">
        <h2 className="mb-3 text-base text-ink">Order summary</h2>
        <ul className="mb-3 space-y-1.5">
          {cart.items.map(i => (
            <li key={i.id} className="flex justify-between gap-3 text-[13px] font-bold">
              <span className="min-w-0 truncate text-muted">{i.qty} × {i.name}{i.size ? ` · ${i.size.split(' · ')[0]}` : ''}</span>
              <span className="shrink-0 text-ink">{money(i.lineTotalCents, sym)}</span>
            </li>
          ))}
        </ul>
        <dl className="divider space-y-2 pt-3 text-[13.5px] font-bold">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(subtotal, sym)}</dd></div>
          {discount > 0 && <div className="flex justify-between text-brand"><dt>Discount ({cart.promo?.code})</dt><dd>−{money(discount, sym)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">{fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{delivery === 0 ? <span className="text-brand">Free</span> : money(delivery, sym)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Taxes ({settings.taxPct}%)</dt><dd>{money(tax, sym)}</dd></div>
          <div className="flex items-baseline justify-between pt-1"><dt className="text-base font-extrabold">Total</dt><dd className="font-display text-2xl text-brand">{money(total, sym)}</dd></div>
        </dl>
        {formError && <p className="mt-3 rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{formError}</p>}
        <button onClick={() => void placeOrder()} disabled={submitting || busy || !paymentMethod}
          className="btn btn-primary mt-4 w-full text-base">
          {submitting ? <><Spinner className="h-5 w-5" /> Placing your order…</> : `Place order · ${money(total, sym)}`}
        </button>
        <p className="mt-2 text-center text-[11.5px] font-semibold text-muted">
          Your order is only confirmed once our kitchen system accepts it.
        </p>
      </section>
    </div>
  );
}
