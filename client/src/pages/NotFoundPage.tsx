import { Link, useLocation } from 'react-router-dom';
import { LogoMark } from '../components/Logo';

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 pb-12 pt-14 text-center">
      <LogoMark className="h-24 w-24 animate-pulse-dot" />
      <h1 className="mt-6 text-[64px] leading-none text-brand">404</h1>
      <h2 className="mt-2 text-2xl text-ink">This page slipped off the pan</h2>
      <p className="mt-2 max-w-sm text-[13.5px] font-semibold text-muted">
        We couldn't find <span className="font-extrabold text-charcoal">{pathname}</span>. It may have been moved, eaten, or never existed — the menu, however, is very real.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn btn-primary btn-sm">Back to home</Link>
        <Link to="/menu" className="btn btn-outline btn-sm">Browse the menu</Link>
        <Link to="/orders" className="btn btn-outline btn-sm">My orders</Link>
      </div>
    </div>
  );
}
