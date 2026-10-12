import { Router } from 'express';
import { all, get } from '../db.js';
import { publicSettings } from '../settings.js';
import { loadProductOptions } from '../pricing.js';
import { wrap } from '../util.js';

export const catalogRouter = Router();

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

catalogRouter.get('/categories', wrap(async (req, res) => {
  const cats = all('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order');
  res.json({
    categories: cats.map(c => ({
      id: c.id, slug: c.slug, name: c.name, image: c.image,
      productCount: get('SELECT COUNT(*) c FROM products WHERE category_id = ? AND available = 1', c.id).c,
    })),
  });
}));

catalogRouter.get('/products', wrap(async (req, res) => {
  const { category, q, veg, sort } = req.query;
  const where = ['p.available = 1'];
  const params = [];
  if (category) { where.push('c.slug = ?'); params.push(String(category)); }
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ?)'); const like = `%${String(q).trim()}%`; params.push(like, like); }
  if (veg === '1') where.push('p.is_veg = 1');
  const orderBy = sort === 'price_asc' ? 'p.price_cents ASC'
    : sort === 'price_desc' ? 'p.price_cents DESC' : 'p.sort_order ASC';
  const rows = all(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`, ...params);
  res.json({
    products: rows.map(p => mapProduct(p, loadProductOptions(p.id))),
  });
}));

catalogRouter.get('/products/:id', wrap(async (req, res) => {
  const p = get(`SELECT p.*, c.slug AS category_slug, c.name AS category_name
    FROM products p JOIN categories c ON c.id = p.category_id
    WHERE (p.id = ? OR p.slug = ?) AND p.available = 1`, req.params.id, req.params.id);
  if (!p) return res.status(404).json({ error: 'That item could not be found.' });
  const options = loadProductOptions(p.id);
  const settings = publicSettings();
  res.json({
    product: {
      ...mapProduct(p, options),
      crusts: options.crusts.map(c => ({ name: c.name, deltaCents: c.delta_cents, isDefault: !!c.is_default })),
      toppings: options.toppings.map(t => ({ id: t.id, name: t.name, priceCents: t.price_cents, isVeg: !!t.is_veg, available: !!t.available })),
      extraCheeseCents: settings.extraCheeseCents,
    },
  });
}));

catalogRouter.get('/promos', wrap(async (req, res) => {
  const rows = all('SELECT * FROM promos WHERE active = 1 ORDER BY value DESC');
  res.json({
    promos: rows.filter(p => !p.expires_at || p.expires_at > Date.now()).map(p => ({
      code: p.code,
      description: p.description,
      type: p.type,
      value: p.value,
      minOrderCents: p.min_order_cents,
      maxDiscountCents: p.max_discount_cents,
    })),
  });
}));

catalogRouter.get('/settings', wrap(async (req, res) => {
  res.json({ settings: publicSettings() });
}));
