import { get, run } from './db.js';
import { hashPassword } from './auth.js';
import { updateSettings } from './settings.js';
import { uid, now } from './util.js';
import { CATEGORY_CONFIG } from './categories.js';

// Products from version 1.0.0. Their old category slugs were never stored in
// the database, so we map them onto the 7 master categories by fuzzy slug
// matching. Historical products keep their records and order snapshots
// untouched — this only links them to a proper category.
const LEGACY_PRODUCTS = [
  { slug: 'margherita',                 name: 'Margherita Classic',            cat: 'Classic Pizza' },
  { slug: 'pepperoni',                  name: 'Pepperoni Passion',             cat: 'Classic Pizza' },
  { slug: 'hawaiian',                   name: 'Hawaiian Ham & Pineapple',      cat: 'Classic Pizza' },
  { slug: 'hot-spicy-pepperoni',        name: 'Hot & Spicy Pepperoni',         cat: 'Classic Pizza' },
  { slug: 'fresh-mushroom',             name: 'Wild Mushroom Truffle',         cat: 'Premium Pizza' },
  { slug: 'bbq-chicken',                name: 'BBQ Chicken Ranch',             cat: 'Premium Pizza' },
  { slug: 'virgin-margherita',          name: 'Margherita Classic',            cat: 'Classic Pizza' },
  { slug: 'margherita-veggie',          name: 'Farmhouse Veggie',              cat: 'Classic Pizza' },
  { slug: 'pepperoni-veggie',           name: 'Farmhouse Veggie',              cat: 'Classic Pizza' },
  { slug: 'bbq',                        name: 'BBQ Chicken Ranch',             cat: 'Premium Pizza' },
  { slug: 'thai-spicy-pepperoni',       name: 'Hot & Spicy Pepperoni',         cat: 'Classic Pizza' },
  { slug: 'cheese-lovers',              name: 'Four Cheese Deluxe',            cat: 'Premium Pizza' },
  { slug: 'hawaiian-ham',               name: 'Hawaiian Ham & Pineapple',      cat: 'Classic Pizza' },
  { slug: 'meat-lovers',                name: 'Pepperoni Passion',             cat: 'Classic Pizza' },
  { slug: 'farmhouse-veggie',           name: 'Farmhouse Veggie',              cat: 'Classic Pizza' },
  { slug: 'paneer-pizza',               name: 'Paneer Tikka Tandoori',         cat: 'Premium Pizza' },
  { slug: 'pepperoni-hawaiian',         name: 'Hawaiian Ham & Pineapple',      cat: 'Classic Pizza' },
  { slug: 'margherita-pepperoni',       name: 'Pepperoni Passion',             cat: 'Classic Pizza' },
  { slug: 'wood-fired-pepperoni',       name: 'Wood-Fired Pepperoni',          cat: 'Premium Pizza' },
  { slug: 'garlic-bread',               name: 'Garlic Bread Sticks',           cat: 'Sides' },
  { slug: 'crispy-fries',               name: 'Crispy Peri Fries',             cat: 'Sides' },
  { slug: 'chicken-wings-8pc',          name: 'Crispy Chicken Wings · 8pc',    cat: 'Sides' },
  { slug: 'onion-rings',                name: 'Crunchy Onion Rings',           cat: 'Sides' },
  { slug: 'choco-milkshake',            name: 'Choco Thick Shake',             cat: 'Drinks' },
  { slug: 'frozen-dessert',             name: 'Chocolate Lava Cake',           cat: 'Desserts' },
  { slug: 'tiramisu',                   name: 'Tiramisu Cup',                  cat: 'Desserts' },
  { slug: 'veggie-burger',              name: 'Garden Veg Burger',             cat: 'Burgers' },
  { slug: 'cheese-burger',              name: 'Classic Cheese Burger',         cat: 'Burgers' },
  { slug: 'chicken-burger',             name: 'Crunchy Chicken Burger',        cat: 'Burgers' },
  { slug: 'big-stack-burger',            name: 'Big Stack Beef Burger',         cat: 'Burgers' },
];

export async function seed() {
  // 1. Master categories.
  for (const [i, c] of CATEGORY_CONFIG.entries()) {
    await run(
      `INSERT OR IGNORE INTO categories (id, slug, name, image, sort_order, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      `cat-${c.slug}`, c.slug, c.name, c.image, i,
    );
  }

  // 2. Map legacy product slugs onto category ids and insert them.
  for (const p of LEGACY_PRODUCTS) {
    const id = `prd-${p.slug}`;
    const catId = categoryIdForLegacySlug(p.cat);
    await run(
      `INSERT OR IGNORE INTO products (id, slug, name, description, category_id, price_cents, image, is_veg, spice_level, badge, discount_pct, available, is_combo, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
      id, p.slug, p.name, '', catId, 0, null, 0, 0, null, 0, now(),
    );
  }

  // 3. Default settings + existing payment-method flags.
  await updateSettings({
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
  });

  return { seeded: true, categories: CATEGORY_CONFIG.length, products: LEGACY_PRODUCTS.length };
}

/** Legacy-category slug → master category id. Kept for internal migrations. */
export function categoryIdForLegacySlug(name) {
  const match = name.toLowerCase().replace(/[-_]/g, ' ').trim();
  const slug = CATEGORY_CONFIG.find(c => c.name === match)?.slug ?? 'classic-pizza';
  return `cat-${slug}`;
}
