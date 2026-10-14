import { Link } from 'react-router-dom';
import { useSettings } from '../lib/settings';
import { LogoMark } from './Logo';
import { Icon } from './icons';

const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 3.2A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4Zm0 10.9A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3Zm6.9-11.2a1.5 1.5 0 1 1-1.5-1.5 1.5 1.5 0 0 1 1.5 1.5Z' },
  { label: 'Facebook', href: 'https://www.facebook.com/', icon: 'M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1a3.9 3.9 0 0 0-4.2 4.3v2.4H7.4V14h2.7v8Z' },
  { label: 'X', href: 'https://x.com/', icon: 'M17.7 3H21l-7.3 8.3L22 21h-6.6l-5.2-6.2L4.3 21H1l7.8-8.9L2 3h6.8l4.7 5.6ZM16.5 19.2h1.9L7.6 4.7H5.6Z' },
];

export function Footer() {
  const { settings } = useSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-14 bg-charcoal text-white">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <div className="leading-none">
              <p className="font-display text-xl">PizzaCut</p>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand">Taste Maker</p>
            </div>
          </div>
          <p className="max-w-xs text-[13px] font-semibold text-white/70">
            Bold, premium pizzas baked fresh and delivered hot. Made with 100% mozzarella and zero shortcuts.
          </p>
          <div className="flex gap-2">
            {SOCIALS.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-brand"
                aria-label={`PizzaCut on ${s.label}`}>
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true"><path d={s.icon} /></svg>
              </a>
            ))}
          </div>
        </div>

        <nav aria-label="Footer links">
          <h3 className="mb-3 text-base text-white">Order</h3>
          <ul className="space-y-2.5 text-[13px] font-bold text-white/75">
            <li><Link className="transition-colors hover:text-brand" to="/menu">Full menu</Link></li>
            <li><Link className="transition-colors hover:text-brand" to="/menu?category=special-deals">Special deals</Link></li>
            <li><Link className="transition-colors hover:text-brand" to="/offers">Promo codes</Link></li>
            <li><Link className="transition-colors hover:text-brand" to="/orders">My orders</Link></li>
            <li><Link className="transition-colors hover:text-brand" to="/cart">Cart</Link></li>
          </ul>
        </nav>

        <div>
          <h3 className="mb-3 text-base text-white">Contact</h3>
          <ul className="space-y-2.5 text-[13px] font-bold text-white/75">
            <li><a className="flex items-center gap-2 transition-colors hover:text-brand" href={`tel:${settings.phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" className="h-4 w-4 text-brand" /> {settings.phone}</a></li>
            <li><a className="flex items-center gap-2 transition-colors hover:text-brand" href={`mailto:${settings.email}`}><Icon name="mail" className="h-4 w-4 text-brand" /> {settings.email}</a></li>
            <li className="flex items-start gap-2"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {settings.address}</li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-base text-white">Opening hours</h3>
          <p className="text-[13px] font-bold text-white/75">{settings.hours}</p>
          <p className="mt-4 rounded-2xl bg-white/10 p-3 text-[12px] font-semibold text-white/70">
            Delivery in around <span className="font-extrabold text-white">{settings.etaDeliveryMinutes} minutes</span>. Pickup ready in {settings.etaPickupMinutes} minutes.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-4 text-[12px] font-semibold text-white/60 sm:flex-row">
          <p>© {year} PizzaCut — Taste Maker. All rights reserved.</p>
          <p>Fresh dough daily · 100% real mozzarella · Hot delivery</p>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-5 text-center text-[11.5px] font-semibold text-white/50">
          Developed by Syed Fida Ullah · <a href="tel:03326972158" className="font-extrabold text-brand hover:underline">03326972158</a>
        </div>
      </div>
    </footer>
  );
}
