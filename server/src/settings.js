import { all, run } from './db.js';

export const DEFAULT_SETTINGS = {
  store_name: 'PizzaCut',
  tagline: 'Taste Maker',
  phone: '+1 (555) 010-7788',
  email: 'hello@pizzacut.com',
  address: '221 Baker Street, Food District',
  hours: 'Mon–Sun · 11:00 AM – 11:00 PM',
  currency_symbol: '$',
  currency_code: 'USD',
  delivery_fee_cents: 299,
  free_delivery_min_cents: 3500,
  tax_pct: 5,
  extra_cheese_cents: 200,
  eta_delivery_minutes: 35,
  eta_pickup_minutes: 15,
  auto_advance: 1,
  pay_cod: 1,
  pay_upi: 0,
  pay_card: 0,
  pay_wallet: 0,
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  const out = { ...DEFAULT_SETTINGS };
  for (const row of all('SELECT key, value FROM settings')) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  cache = out;
  return out;
}

export function invalidateSettings() { cache = null; }

export function updateSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key, JSON.stringify(value));
  }
  invalidateSettings();
  return getSettings();
}

export function publicSettings(s = getSettings()) {
  return {
    storeName: s.store_name,
    tagline: s.tagline,
    phone: s.phone,
    email: s.email,
    address: s.address,
    hours: s.hours,
    currencySymbol: s.currency_symbol,
    currencyCode: s.currency_code,
    deliveryFeeCents: s.delivery_fee_cents,
    freeDeliveryMinCents: s.free_delivery_min_cents,
    taxPct: s.tax_pct,
    extraCheeseCents: s.extra_cheese_cents,
    etaDeliveryMinutes: s.eta_delivery_minutes,
    etaPickupMinutes: s.eta_pickup_minutes,
    paymentMethods: [
      { id: 'cod', label: 'Cash on Delivery', enabled: !!s.pay_cod },
      { id: 'upi', label: 'UPI / QR Payment', enabled: !!s.pay_upi },
      { id: 'card', label: 'Credit / Debit Card', enabled: !!s.pay_card },
      { id: 'wallet', label: 'Digital Wallet', enabled: !!s.pay_wallet },
    ],
  };
}
