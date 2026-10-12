import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { Address } from '../lib/types';
import { Sheet } from './ui';
import { Icon } from './icons';

const STORAGE_KEY = 'pc_address';

export function useSelectedAddress() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Address | null>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  });

  useEffect(() => {
    if (!selected && user?.addresses.length) {
      const def = user.addresses.find(a => a.isDefault) ?? user.addresses[0];
      setSelected(def);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
    }
    if (selected && user?.addresses.length) {
      const match = user.addresses.find(a => a.id === selected.id);
      if (match && JSON.stringify(match) !== JSON.stringify(selected)) {
        setSelected(match);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
      }
    }
  }, [user, selected]);

  const choose = (address: Address) => {
    setSelected(address);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(address));
  };
  return { selected, choose };
}

export function AddressSelector({ compact = false }: { compact?: boolean }) {
  const { user, loading } = useAuth();
  const { selected, choose } = useSelectedAddress();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const addresses = useMemo(() => user?.addresses ?? [], [user]);

  const label = selected ? `${selected.label} · ${selected.line1}` : 'Set delivery address';

  return (
    <>
      <button
        type="button"
        onClick={() => (user ? setOpen(true) : navigate('/login?next=/checkout'))}
        className={`flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 font-extrabold text-charcoal transition-colors hover:border-brand/40 ${compact ? 'h-9 max-w-[46vw] text-[12px]' : 'h-10 text-[13px]'}`}
        aria-label={`Delivery address: ${label}. Change address`}
      >
        <Icon name="pin" className={`shrink-0 text-brand ${compact ? 'h-4 w-4' : 'h-4.5 w-4.5'}`} />
        <span className="truncate">{loading && !selected ? 'Loading…' : label}</span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Deliver to"
        footer={
          <div className="flex gap-2">
            <button className="btn btn-outline flex-1" onClick={() => { setOpen(false); navigate('/profile'); }}>Manage addresses</button>
          </div>
        }>
        {addresses.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-muted">Add a delivery address in your profile, then it will show up here.</p>
          </div>
        ) : (
          <ul className="space-y-2 pb-2">
            {addresses.map(addr => {
              const active = selected?.id === addr.id;
              return (
                <li key={addr.id}>
                  <button
                    onClick={() => { choose(addr); setOpen(false); }}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${active ? 'border-brand bg-brand-soft' : 'border-line hover:border-charcoal/30'}`}
                  >
                    <Icon name="pin" className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-brand' : 'text-muted'}`} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-extrabold text-ink">{addr.label}{addr.isDefault && <span className="ml-2 text-[11px] font-bold text-muted">Default</span>}</span>
                      <span className="block truncate text-[13px] font-semibold text-muted">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city} {addr.zip}</span>
                    </span>
                    {active && <Icon name="check" className="ml-auto mt-0.5 h-5 w-5 shrink-0 text-brand" />}
                  </button>
                </li>
              );
            })}
            <li>
              <Link to="/profile" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-3 text-[13px] font-extrabold text-brand">
                <Icon name="plus" className="h-4 w-4" /> Add a new address
              </Link>
            </li>
          </ul>
        )}
      </Sheet>
    </>
  );
}
