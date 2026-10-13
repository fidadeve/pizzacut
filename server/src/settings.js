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

// Short TTL so admin edits propagate across Worker isolates.
const TTL_MS = 15_000;
let cache = null;
let cachedAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const out = { ...DEFAULT_SETTINGS };
  for (const row of await all('SELECT key, value FROM settings')) {
    try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
  }
  cache = out;
  cachedAt = Date.now();
  return cache;
}

export function invalidateSettings() { cache = null; cachedAt = 0; }

export async function updateSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key, JSON.stringify(value));
  }
  invalidateSettings();
  return getSettings();
}

export async function publicSettings(s) {
  const st = s ?? await getSettings();
  return {
    storeName: st.store_name,
    tagline: st.tagline,
    phone: st.phone,
    email: st.email,
    address: st.address,
    hours: st.hours,
    currencySymbol: st.currency_symbol,
    currencyCode: st.currency_code,
    deliveryFeeCents: st.delivery_fee_cents,
    freeDeliveryMinCents: st.free_delivery_min_cents,
    taxPct: st.tax_pct,
    extraCheeseCents: st.extra_cheese_cents,
    etaDeliveryMinutes: st.eta_delivery_minutes,
    etaPickupMinutes: st.eta_pickup_minutes,
    paymentMethods: [
      { id: 'cod', label: 'Cash on Delivery', enabled: !!st.pay_cod },
      { id: 'upi', label: 'UPI / QR Payment', enabled: !!st.pay_upi },
      { id: 'card', label: 'Credit / Debit Card', enabled: !!st.pay_card },
      { id: 'wallet', label: 'Digital Wallet', enabled: !!st.pay_wallet },
    ],
  };
}
