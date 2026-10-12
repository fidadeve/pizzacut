import { NavLink } from 'react-router-dom';
import { Icon } from './icons';
import { useAuth } from '../lib/auth';

const ITEMS = [
  { to: '/', label: 'Home', icon: 'home' as const, end: true },
  { to: '/menu', label: 'Menu', icon: 'grid' as const },
  { to: '/offers', label: 'Offers', icon: 'tag' as const },
  { to: '/orders', label: 'Orders', icon: 'receipt' as const },
  { to: '/profile', label: 'Profile', icon: 'user' as const },
];

export function BottomNav() {
  const { user } = useAuth();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Bottom navigation">
      <ul className="mx-auto flex max-w-lg items-stretch">
        {ITEMS.map(item => {
          const to = item.to === '/profile' && !user ? '/login' : item.to;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={to} end={item.end}
                className={({ isActive }) =>
                  `relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-extrabold transition-colors ${isActive ? 'text-brand' : 'text-muted'}`}>
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-0 h-1 w-8 rounded-b-full bg-brand" />}
                    <Icon name={item.icon} className="h-[22px] w-[22px]" filled={isActive && (item.icon === 'home' || item.icon === 'grid')} />
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
