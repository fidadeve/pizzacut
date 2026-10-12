import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { LogoMark } from '../components/Logo';
import { Spinner } from '../components/ui';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        const user = await login(email.trim(), password);
        push(`Welcome back, ${user.name.split(' ')[0]}!`);
      } else {
        const user = await register({ name: name.trim(), email: email.trim(), password, phone: phone.trim() || undefined });
        push(`Welcome to PizzaCut, ${user.name.split(' ')[0]}!`);
      }
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 pb-10 pt-8">
      <div className="flex flex-col items-center text-center">
        <LogoMark className="h-20 w-20" />
        <h1 className="mt-4 text-[28px] text-ink">{mode === 'login' ? 'Welcome back' : 'Join the pizza club'}</h1>
        <p className="mt-1 text-[13.5px] font-semibold text-muted">
          {mode === 'login' ? 'Sign in to track orders and reorder in seconds.' : 'Create an account for faster checkout and order history.'}
        </p>
      </div>

      <form onSubmit={e => void submit(e)} className="card mt-6 space-y-3.5 p-5">
        {mode === 'register' && (
          <label><span className="label">Full name</span>
            <input className="field" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required minLength={2} placeholder="Alex Pepperoni" /></label>
        )}
        <label><span className="label">Email</span>
          <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
        {mode === 'register' && (
          <label><span className="label">Phone (optional)</span>
            <input className="field" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+1 555 123 4567" /></label>
        )}
        <label><span className="label">Password</span>
          <input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} placeholder="At least 8 characters" /></label>

        {error && <p className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? <><Spinner className="h-5 w-5" /> Just a sec…</> : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <p className="text-center text-[13px] font-semibold text-muted">
          {mode === 'login' ? "New to PizzaCut? " : 'Already have an account? '}
          <button type="button" onClick={() => { setMode(m => (m === 'login' ? 'register' : 'login')); setError(null); }}
            className="font-extrabold text-brand hover:underline">
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </form>

      <div className="mt-4 flex items-center justify-between text-[12.5px] font-bold text-muted">
        <Link to="/menu" className="hover:text-brand">Keep browsing as guest</Link>
        <Link to="/admin" className="hover:text-brand">Staff login →</Link>
      </div>
    </div>
  );
}
