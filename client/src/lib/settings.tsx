import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { StoreSettings } from './types';

const FALLBACK: StoreSettings = {
  storeName: 'PizzaCut', tagline: 'Taste Maker', phone: '', email: '', address: '', hours: '',
  currencySymbol: '$', currencyCode: 'USD', deliveryFeeCents: 0, freeDeliveryMinCents: 0,
  taxPct: 0, extraCheeseCents: 0, etaDeliveryMinutes: 35, etaPickupMinutes: 15,
  paymentMethods: [{ id: 'cod', label: 'Cash on Delivery', enabled: true }],
};

const SettingsContext = createContext<{ settings: StoreSettings; ready: boolean }>({ settings: FALLBACK, ready: false });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(FALLBACK);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    api.get<{ settings: StoreSettings }>('/settings')
      .then(res => { if (alive) { setSettings(res.settings); setReady(true); } })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return <SettingsContext.Provider value={{ settings, ready }}>{children}</SettingsContext.Provider>;
}

export function useSettings() { return useContext(SettingsContext); }
export const DEFAULT_SETTINGS = FALLBACK;
