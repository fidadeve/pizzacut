import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../lib/cart';
import { useAuth } from '../lib/auth';
import { Logo } from './Logo';
import { AddressSelector } from './AddressSelector';
import { Icon } from './icons';

const NAV = [
  { to: '/', label: 'Home', icon: 'home' as const, end: true },
  { to: '/menu', label: 'Menu', icon: 'grid' as const },
  { to: '/offers', label: 'Offers', icon: 'tag' as const },
  { to: '/orders', label: 'Orders', icon: 'receipt' as const },
];

export function Header() {
  const { itemCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    if (location.pathname === '/menu') setQ(searchParams.get('q') ?? '');
  }, [location.pathname, searchParams]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/menu?q=${encodeURIComponent(q.trim())}` : '/menu');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <Logo size={40} withWordmark className="shrink-0" />

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-[14px] font-extrabold transition-colors ${isActive ? 'bg-brand-soft text-brand' : 'text-charcoal hover:bg-surface'}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-60 lg:block" role="search">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            className="field h-10 min-h-10 rounded-full pl-9 text-[13px]"
            placeholder="Search pizzas…" aria-label="Search menu"
          />
        </form>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-2">
          <Link to="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-surface" aria-label={`Cart, ${itemCount} items`}>
            <Icon name="cart" className="h-[22px] w-[22px]" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-extrabold text-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
          {user ? (
            <Link to="/profile" className="hidden h-10 items-center gap-2 rounded-full border border-line px-3 text-[13px] font-extrabold text-charcoal hover:border-charcoal/30 sm:flex">
              <Icon name="user" className="h-4 w-4 text-brand" /> {user.name.split(' ')[0]}
            </Link>
          ) : (
            <Link to="/login" className="btn btn-dark btn-sm hidden sm:inline-flex">Sign in</Link>
          )}
          <Link to={user ? '/profile' : '/login'} className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-surface sm:hidden" aria-label={user ? 'Profile' : 'Sign in'}>
            <Icon name="user" className="h-[22px] w-[22px]" />
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pb-2.5 lg:hidden">
        <AddressSelector compact />
        <form onSubmit={submitSearch} className="relative min-w-0 flex-1" role="search">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            className="field h-9 min-h-9 rounded-full pl-9 text-[13px]"
            placeholder="Search pizzas, burgers…" aria-label="Search menu"
          />
        </form>
      </div>
    </header>
  );
}
