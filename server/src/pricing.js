import { all, get } from './db.js';
import { HttpError } from './util.js';
import { getSettings } from './settings.js';

export function loadProduct(productId) {
  return get('SELECT * FROM products WHERE id = ? OR slug = ?', productId, productId);
}

export function loadProductOptions(productId) {
  return {
    sizes: all('SELECT size, name, delta_cents, is_default FROM product_sizes WHERE product_id = ? ORDER BY delta_cents', productId),
    crusts: all('SELECT name, delta_cents, is_default FROM product_crusts WHERE product_id = ? ORDER BY delta_cents', productId),
    toppings: all(`SELECT t.id, t.name, t.price_cents, t.is_veg, t.available
      FROM product_toppings pt JOIN toppings t ON t.id = pt.topping_id
      WHERE pt.product_id = ? ORDER BY t.is_veg DESC, t.name`, productId),
  };
}

/**
 * Validates a selection against the catalog and returns the unit price in cents.
 * All prices come from the database — the client price is never trusted.
 */
export function priceItem({ product, options, selection }) {
  const settings = getSettings();
  const isPizza = options.sizes.length > 0 || options.crusts.length > 0;
  let unit = product.price_cents;
  const detail = { sizeKey: null, size: null, crust: null, toppings: [], extraCheese: false };

  if (isPizza) {
    const size = (selection.size ? options.sizes.find(s => s.size === selection.size) : null) ||
      options.sizes.find(s => s.is_default) || options.sizes[0];
    if (!size) throw new HttpError(400, 'This item has no available sizes right now.');
    unit += size.delta_cents;
    detail.sizeKey = size.size;
    detail.size = size.name;

    const crust = options.crusts.find(c => c.name === (selection.crust)) ||
      options.crusts.find(c => c.is_default) || options.crusts[0];
    if (!crust) throw new HttpError(400, 'This item has no available crusts right now.');
    unit += crust.delta_cents;
    detail.crust = crust.name;

    const wanted = Array.isArray(selection.toppingIds) ? selection.toppingIds.slice(0, 8) : [];
    const byId = new Map(options.toppings.map(t => [t.id, t]));
    const chosen = [];
    for (const id of wanted) {
      const t = byId.get(id);
      if (!t) throw new HttpError(400, 'One of the selected toppings is not available.');
      if (!t.available) throw new HttpError(400, `"${t.name}" is currently unavailable.`);
      unit += t.price_cents;
      chosen.push({ id: t.id, name: t.name, priceCents: t.price_cents });
    }
    detail.toppings = chosen;

    if (selection.extraCheese) {
      unit += settings.extra_cheese_cents;
      detail.extraCheese = true;
    }
  } else if (selection.size || selection.crust || selection.extraCheese ||
    (Array.isArray(selection.toppingIds) && selection.toppingIds.length)) {
    throw new HttpError(400, 'Customization options are not available for this item.');
  }

  const qty = Math.max(1, Math.min(20, Number.parseInt(selection.qty ?? 1, 10) || 1));
  return { unitPriceCents: unit, qty, detail };
}

/** Recomputes the whole cart from the current catalog (fresh prices every time). */
export function computeCart(cartId) {
  const settings = getSettings();
  const cart = get('SELECT * FROM carts WHERE id = ?', cartId);
  const rows = all('SELECT * FROM cart_items WHERE cart_id = ? ORDER BY created_at', cartId);
  const items = [];
  let subtotalCents = 0;

  for (const row of rows) {
    const product = loadProduct(row.product_id);
    if (!product) continue;
    const options = loadProductOptions(product.id);
    const priced = priceItem({
      product,
      options,
      selection: {
        size: row.size, crust: row.crust,
        toppings: JSON.parse(row.toppings || '[]'),
        toppingIds: JSON.parse(row.toppings || '[]'),
        extraCheese: !!row.extra_cheese, qty: row.qty,
      },
    });
    const lineTotalCents = priced.unitPriceCents * priced.qty;
    subtotalCents += lineTotalCents;
    items.push({
      id: row.id,
      product: {
        id: product.id, slug: product.slug, name: product.name, image: product.image,
        isVeg: !!product.is_veg, spiceLevel: product.spice_level, available: !!product.available,
      },
      name: product.name,
      size: priced.detail.size,
      sizeKey: priced.detail.sizeKey,
      crust: priced.detail.crust,
      toppings: priced.detail.toppings,
      extraCheese: priced.detail.extraCheese,
      qty: priced.qty,
      unitPriceCents: priced.unitPriceCents,
      lineTotalCents,
      customizable: options.sizes.length > 0 || options.crusts.length > 0,
    });
  }

  let promo = null;
  let discountCents = 0;
  if (cart?.promo_code) {
    try {
      const applied = validatePromo(cart.promo_code, subtotalCents);
      promo = applied.promo;
      discountCents = applied.discountCents;
    } catch {
      // Promo no longer valid for this subtotal — drop it silently.
      promo = null;
    }
  }

  const itemCount = items.reduce((n, i) => n + i.qty, 0);
  return {
    id: cartId,
    items,
    itemCount,
    subtotalCents,
    promo,
    discountCents,
    settings: {
      deliveryFeeCents: settings.delivery_fee_cents,
      freeDeliveryMinCents: settings.free_delivery_min_cents,
      taxPct: settings.tax_pct,
      currencySymbol: settings.currency_symbol,
      extraCheeseCents: settings.extra_cheese_cents,
    },
  };
}

export function validatePromo(code, subtotalCents) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw new HttpError(400, 'Enter a promo code.');
  const promo = get('SELECT * FROM promos WHERE code = ?', normalized);
  if (!promo || !promo.active) throw new HttpError(400, 'That promo code is not valid.');
  if (promo.expires_at && promo.expires_at < Date.now()) throw new HttpError(400, 'That promo code has expired.');
  if (subtotalCents < promo.min_order_cents) {
    throw new HttpError(400, `This code requires a minimum order of ${formatCents(promo.min_order_cents, getSettings())}.`);
  }
  let discountCents = promo.type === 'percent'
    ? Math.round(subtotalCents * promo.value / 100)
    : promo.value;
  if (promo.max_discount_cents != null) discountCents = Math.min(discountCents, promo.max_discount_cents);
  discountCents = Math.min(discountCents, subtotalCents);
  return {
    promo: { code: promo.code, description: promo.description, type: promo.type, value: promo.value, minOrderCents: promo.min_order_cents },
    discountCents,
  };
}

export function computeTotals({ subtotalCents, discountCents = 0, fulfilment, settings = getSettings() }) {
  const deliveryCents = fulfilment === 'pickup'
    ? 0
    : (subtotalCents >= settings.free_delivery_min_cents ? 0 : settings.delivery_fee_cents);
  const taxable = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round(taxable * settings.tax_pct / 100);
  return {
    subtotalCents,
    discountCents,
    deliveryCents,
    taxCents,
    totalCents: taxable + deliveryCents + taxCents,
  };
}

function formatCents(cents, settings) {
  return `${settings.currency_symbol}${(cents / 100).toFixed(2)}`;
}
