import { Hono } from 'hono';
import { all, get } from '../db.js';
import { publicSettings } from '../settings.js';
import { loadProductOptions } from '../pricing.js';

export const catalog = new Hono();

function mapProduct(p, options) {
  const mediumDelta = options.sizes.find(s => s.size === 'medium')?.delta_cents ?? 0;
  const priceCents = p.price_cents + mediumDelta;
  const comparePriceCents = p.discount_pct > 0
    ? Math.round(priceCents / (1 - p.discount_pct / 100))
    : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    image: p.image,
    isVeg: !!p.is_veg,
    spiceLevel: p.spice_level,
    badge: p.badge,
    discountPct: p.discount_pct,
    comparePriceCents,
    available: !!p.available,
    isCombo: !!p.is_combo,
    priceCents,
    fromPriceCents: p.price_cents,
    customizable: options.sizes.length > 0 || options.crusts.length > 0,
    category: p.category_slug ? { slug: p.category_slug, name: p.category_name } : undefined,
    sizes: options.sizes.map(s => ({ size: s.size, name: s.name, deltaCents: s.delta_cents, isDefault: !!s.is_default })),
  };
}

catalog.get('/categories', async (c) => {
  const cats = await all('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order');
  const categories = [];
  for (const cat of cats) {
    const row = await get('SELECT COUNT(*) c FROM products WHERE category_id = ? AND available = 1', cat.id);
    categories.push({
      id: cat.id, slug: cat.slug, name: cat.name, image: cat.image,
      productCount: row.c,
    });
  }
  return c.json({ categories });
});

catalog.get('/products', async (c) => {
  const { category, q, veg, sort } = c.req.query();
  const where = ['p.available = 1'];
  const params = [];
  if (category) { where.push('c.slug = ?'); params.push(String(category)); }
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); const like = `%${String(q).trim()}%`; params.push(like, like); }
  if (veg === '1') where.push('p.is_veg = 1');
  const orderBy = sort === 'price_asc' ? 'p.price_cents ASC'
    : sort === 'price_desc' ? 'p.price_cents DESC' : 'p.sort_order ASC';
  const rows = await all(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`, ...params);
  const products = [];
  for (const p of rows) products.push(mapProduct(p, await loadProductOptions(p.id)));
  return c.json({ products });
});

catalog.get('/products/:id', async (c) => {
  const id = c.req.param('id');
  const p = await get(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE (p.id = ? OR p.slug = ?) AND p.available = 1`, id, id);
  if (!p) return c.json({ error: 'That item could not be found.' }, 404);
  const options = await loadProductOptions(p.id);
  const settings = await publicSettings();
  return c.json({
    product: {
      ...mapProduct(p, options),
      crusts: options.crusts.map(x => ({ name: x.name, deltaCents: x.delta_cents, isDefault: !!x.is_default })),
      toppings: options.toppings.map(t => ({ id: t.id, name: t.name, priceCents: t.price_cents, isVeg: !!t.is_veg, available: !!t.available })),
      extraCheeseCents: settings.extraCheeseCents,
    },
  });
});

catalog.get('/promos', async (c) => {
  const rows = await all('SELECT * FROM promos WHERE active = 1 ORDER BY value DESC');
  return c.json({
    promos: rows.filter(p => !p.expires_at || p.expires_at > Date.now()).map(p => ({
      code: p.code,
      description: p.description,
      type: p.type,
      value: p.value,
      minOrderCents: p.min_order_cents,
      maxDiscountCents: p.max_discount_cents,
    })),
  });
});

catalog.get('/settings', async (c) => c.json({ settings: await publicSettings() }));
