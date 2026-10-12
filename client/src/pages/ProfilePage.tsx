import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Address } from '../lib/types';
import { Skeleton } from '../components/ui';
import { Icon } from '../components/icons';

const EMPTY_ADDR = { label: 'Home', line1: '', line2: '', city: '', zip: '' };

export function ProfilePage() {
  const { user, loading, updateProfile, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [addr, setAddr] = useState({ ...EMPTY_ADDR });
  const [addrError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    if (user) { setName(user.name); setPhone(user.phone ?? ''); }
  }, [user]);

  if (loading) {
    return <div className="mx-auto max-w-2xl space-y-3 px-4 pt-6"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="user" className="h-8 w-8" /></span>
        <h1 className="mt-4 text-2xl text-ink">You're not signed in</h1>
        <p className="mx-auto mt-1 max-w-sm text-[13.5px] font-semibold text-muted">
          Sign in to save addresses, keep your orders across devices and reorder in two taps.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/login" className="btn btn-primary btn-sm">Sign in</Link>
          <Link to="/menu" className="btn btn-outline btn-sm">Browse menu</Link>
        </div>
      </div>
    );
  }

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      push('Profile updated');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not save profile', 'error');
    } finally { setSaving(false); }
  };

  const addAddress = async () => {
    setAddressError(null);
    if (addr.line1.trim().length < 3 || addr.city.trim().length < 2 || addr.zip.trim().length < 3) {
      setAddressError('Street, city and postal code are all required.');
      return;
    }
    const next: Address[] = [
      ...user.addresses,
      { ...addr, id: crypto.randomUUID(), isDefault: user.addresses.length === 0 },
    ];
    try {
      await updateProfile({ addresses: next });
      setAddr({ ...EMPTY_ADDR });
      push('Address added');
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Could not save address');
    }
  };

  const setDefault = async (id: string) => {
    try {
      await updateProfile({ addresses: user.addresses.map(a => ({ ...a, isDefault: a.id === id })) });
      push('Default address updated');
    } catch (err) { push(err instanceof Error ? err.message : 'Could not update', 'error'); }
  };

  const removeAddress = async (id: string) => {
    try {
      await updateProfile({ addresses: user.addresses.filter(a => a.id !== id) });
      push('Address removed');
    } catch (err) { push(err instanceof Error ? err.message : 'Could not remove address', 'error'); }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
      <div className="flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-charcoal font-display text-xl text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl text-ink">{user.name}</h1>
          <p className="truncate text-[13px] font-semibold text-muted">{user.email}</p>
        </div>
        {user.role === 'admin' && (
          <Link to="/admin" className="btn btn-dark btn-sm ml-auto">Staff dashboard</Link>
        )}
      </div>

      <section className="card mt-5 p-4">
        <h2 className="mb-3 text-base text-ink">Your details</h2>
        <div className="space-y-3">
          <label><span className="label">Name</span>
            <input className="field" value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
          <label><span className="label">Phone</span>
            <input className="field" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+1 555 123 4567" /></label>
          <button onClick={() => void saveProfile()} disabled={saving || name.trim().length < 2} className="btn btn-primary btn-sm">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="mb-3 text-base text-ink">Saved addresses</h2>
        {user.addresses.length === 0 && <p className="text-[13px] font-semibold text-muted">No saved addresses yet — add one below.</p>}
        <ul className="space-y-2">
          {user.addresses.map(a => (
            <li key={a.id} className="rounded-2xl border border-line p-3.5">
              <div className="flex items-start gap-2">
                <Icon name="pin" className="mt-0.5 h-4.5 w-4.5 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-extrabold text-ink">{a.label} {a.isDefault && <span className="ml-1 text-[11px] font-bold text-muted">· Default</span>}</p>
                  <p className="truncate text-[12.5px] font-semibold text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.zip}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2 pl-6.5">
                {!a.isDefault && <button onClick={() => void setDefault(a.id!)} className="btn btn-ghost btn-xs">Make default</button>}
                <button onClick={() => void removeAddress(a.id!)} className="btn btn-ghost btn-xs text-brand hover:bg-brand-soft">Remove</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="divider mt-4 pt-4">
          <h3 className="mb-2 text-[14px] font-extrabold text-ink" style={{ fontFamily: 'var(--font-sans)' }}>Add a new address</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2"><span className="label">Label</span>
              <input className="field" value={addr.label} onChange={e => setAddr(a => ({ ...a, label: e.target.value }))} placeholder="Home" /></label>
            <label className="col-span-2"><span className="label">Street address</span>
              <input className="field" value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))} placeholder="42 Pizza Lane" /></label>
            <label className="col-span-2"><span className="label">Apt, suite (optional)</span>
              <input className="field" value={addr.line2} onChange={e => setAddr(a => ({ ...a, line2: e.target.value }))} /></label>
            <label><span className="label">City</span>
              <input className="field" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} /></label>
            <label><span className="label">Postal code</span>
              <input className="field" value={addr.zip} onChange={e => setAddr(a => ({ ...a, zip: e.target.value }))} inputMode="numeric" /></label>
          </div>
          {addrError && <p className="mt-2 text-[12.5px] font-bold text-brand" role="alert">{addrError}</p>}
          <button onClick={() => void addAddress()} className="btn btn-dark btn-sm mt-3">Save address</button>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Link to="/orders" className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-pop">
          <Icon name="receipt" className="h-6 w-6 text-brand" />
          <span className="text-[14px] font-extrabold text-ink">My orders</span>
        </Link>
        <Link to="/cart" className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-pop">
          <Icon name="cart" className="h-6 w-6 text-brand" />
          <span className="text-[14px] font-extrabold text-ink">Cart</span>
        </Link>
      </section>

      <button
        onClick={() => { void logout().then(() => { push('Signed out'); navigate('/'); }); }}
        className="btn btn-outline mt-5 w-full text-brand">
        <Icon name="logout" className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
