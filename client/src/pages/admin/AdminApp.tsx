import { useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSettings } from '../../lib/settings';
import { useToast } from '../../lib/toast';
import { LogoMark } from '../../components/Logo';
import { Icon } from '../../components/icons';
import { Spinner } from '../../components/ui';
import { AdminOverview } from './AdminOverview';
import { AdminOrders } from './AdminOrders';
import { AdminMenu } from './AdminMenu';
import { AdminOffers } from './AdminOffers';
import { AdminSettings } from './AdminSettings';

const TABS = [
  { to: '/admin', label: 'Overview', icon: 'grid' as const, end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'receipt' as const },
  { to: '/admin/menu', label: 'Menu', icon: 'bag' as const },
  { to: '/admin/offers', label: 'Offers', icon: 'tag' as const },
  { to: '/admin/settings', label: 'Settings', icon: 'edit' as const },
];

function AdminLogin() {
  const [email, setEmail] = useState('admin@pizzacut.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      if (user.role !== 'admin') { setError('This account does not have staff access.'); return; }
      push('Signed in to the kitchen dashboard');
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-charcoal px-4">
      <form onSubmit={e => void submit(e)} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-pop">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="h-16 w-16" />
          <h1 className="mt-3 text-2xl text-ink">Kitchen dashboard</h1>
          <p className="mt-1 text-[13px] font-semibold text-muted">Authorized PizzaCut staff only.</p>
        </div>
        <div className="mt-5 space-y-3">
          <label><span className="label">Staff email</span>
            <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label><span className="label">Password</span>
            <input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        </div>
        {error && <p className="mt-3 rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary mt-4 w-full">
          {busy ? <><Spinner className="h-5 w-5" /> Signing in…</> : 'Sign in'}
        </button>
        <div className="mt-4 flex justify-between text-[12.5px] font-bold text-muted">
          <Link to="/" className="hover:text-brand">← Back to store</Link>
          {/* Never reveal staff credentials in a production build. */}
          {import.meta.env.DEV && <span>Demo: admin@pizzacut.com / admin123</span>}
        </div>
      </form>
    </div>
  );
}

function AdminShell() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <LogoMark className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-ink">{settings.storeName} kitchen</p>
            <p className="truncate text-[11.5px] font-bold text-muted">Staff dashboard · {user?.email}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" className="btn btn-outline btn-sm">View store</Link>
            <button onClick={() => { void logout().then(() => navigate('/', { replace: true })); }} className="btn btn-ghost btn-sm">
              <Icon name="logout" className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
        <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="Admin sections">
          {TABS.map(tab => (
            <NavLink key={tab.to} to={tab.to} end={tab.end}
              className={({ isActive }) =>
                `chip border ${isActive ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal hover:border-charcoal/30'}`}>
              <Icon name={tab.icon} className="h-4 w-4" /> {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6" key={pathname}>
        <div className="animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function AdminApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-charcoal text-brand"><Spinner className="h-8 w-8" /></div>;
  }
  if (!user) return <AdminLogin />;
  if (user.role !== 'admin') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-charcoal px-6 text-center text-white">
        <Icon name="info" className="h-10 w-10 text-brand" />
        <h1 className="text-2xl">Staff access required</h1>
        <p className="max-w-sm text-[13.5px] font-semibold text-white/70">This account isn't authorized to manage PizzaCut. Sign in with a staff account to continue.</p>
        <Link to="/" className="btn btn-primary btn-sm">Back to the store</Link>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<AdminOverview />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="menu" element={<AdminMenu />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  );
}
