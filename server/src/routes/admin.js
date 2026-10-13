import { Hono } from 'hono';
import { z } from 'zod';
import { all, get, run } from '../db.js';
import { requireAdmin } from '../auth.js';
import { getSettings, updateSettings, publicSettings, DEFAULT_SETTINGS } from '../settings.js';
import { loadProductOptions } from '../pricing.js';
import { orderPayload } from './orders.js';
import { trackingStages } from '../tracking.js';
import { uid, now, HttpError, randomHex, readJson } from '../util.js';
import { putUpload } from '../storage.js';

export const admin = new Hono();
admin.use('*', requireAdmin);

const MAX_UPLOAD = 3 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;

function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

async function uniqueSlug(base, excludeId) {
  let slug = base;
  let n = 1;
  for (;;) {
    const row = await get('SELECT id FROM products WHERE slug = ?', slug);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${++n}`;
  }
}

/* ---------- Overview ---------- */
admin.get('/overview', async (c) => {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  const today = await get(`SELECT COUNT(*) orders, COALESCE(SUM(total_cents), 0) revenue
    FROM orders WHERE created_at >= ? AND status != 'cancelled'`, start);
  const total = await get(`SELECT COUNT(*) orders, COALESCE(SUM(total_cents), 0) revenue FROM orders WHERE status != 'cancelled'`);
  const byStatusRows = await all('SELECT status, COUNT(*) c FROM orders GROUP BY status');
  const byStatus = Object.fromEntries(byStatusRows.map(r => [r.status, r.c]));
  const last7 = await all(`SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) orders, COALESCE(SUM(total_cents), 0) revenue
    FROM orders WHERE created_at >= ? AND status != 'cancelled' GROUP BY day ORDER BY day`,
    Date.now() - 6 * 86400_000 - (Date.now() - start));
  const topProducts = await all(`SELECT oi.name, SUM(oi.qty) qty, SUM(oi.line_total_cents) revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled' GROUP BY oi.name ORDER BY qty DESC LIMIT 5`);
  const recentRows = await all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8');
  const recent = [];
  for (const o of recentRows) {
    const count = await get('SELECT COUNT(*) c FROM order_items WHERE order_id = ?', o.id);
    recent.push({
      id: o.id, number: o.number, customer: o.customer_name, totalCents: o.total_cents,
      status: o.status, fulfilment: o.fulfilment, createdAt: o.created_at,
      itemCount: count.c,
    });
  }
  return c.json({
    overview: {
      todayOrders: today.orders,
      todayRevenueCents: today.revenue,
      avgOrderCents: today.orders ? Math.round(today.revenue / today.orders) : 0,
      totalOrders: total.orders,
      totalRevenueCents: total.revenue,
      byStatus,
      last7,
      topProducts,
      recent,
      openOrders: (byStatus.received || 0) + (byStatus.confirmed || 0) + (byStatus.preparing || 0)
        + (byStatus.out_for_delivery || 0) + (byStatus.ready_for_pickup || 0),
    },
  });
});

/* ---------- Products ---------- */
const sizeSchema = z.object({
  size: z.enum(['small', 'medium', 'large']),
  name: z.string().trim().min(1).max(24),
  deltaCents: z.number().int().min(0).max(5000),
  isDefault: z.boolean().optional(),
});
const crustSchema = z.object({
  name: z.string().trim().min(1).max(40),
  deltaCents: z.number().int().min(0).max(5000),
  isDefault: z.boolean().optional(),
});
const productSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(80),
  description: z.string().trim().max(400).default(''),
  categoryId: z.string().min(1, 'Category is required.'),
  priceCents: z.number().int().min(0).max(1000000),
  image: z.string().trim().max(300).default(''),
  isVeg: z.boolean().default(false),
  spiceLevel: z.number().int().min(0).max(3).default(0),
  badge: z.string().trim().max(20).nullable().default(null),
  discountPct: z.number().int().min(0).max(90).default(0),
  available: z.boolean().default(true),
  isCombo: z.boolean().default(false),
  sizes: z.array(sizeSchema).max(3).optional(),
  crusts: z.array(crustSchema).max(6).optional(),
  toppingIds: z.array(z.string()).max(20).optional(),
});

admin.post('/upload', async (c) => {
  const declared = Number(c.req.header('content-length') || 0);
  if (declared > MAX_UPLOAD * 1.2) throw new HttpError(400, 'Image must be under 3 MB.');
  let form;
  try { form = await c.req.formData(); }
  catch { throw new HttpError(400, 'Choose a JPEG, PNG or WebP image.'); }
  const file = form.get('image');
  if (!file || typeof file === 'string' || !IMAGE_TYPES.test(file.type)) {
    throw new HttpError(400, 'Choose a JPEG, PNG or WebP image.');
  }
  if (file.size > MAX_UPLOAD) throw new HttpError(400, 'Image must be under 3 MB.');
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' }[file.type] || '.img';
  const name = `${Date.now()}-${randomHex(4)}${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await putUpload(name, bytes, file.type);
  return c.json({ url: `/api/uploads/${name}` });
});

admin.get('/products', async (c) => {
  const rows = await all(`SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p JOIN categories c ON c.id = p.category_id ORDER BY c.sort_order, p.sort_order`);
  const products = [];
  for (const p of rows) products.push({ ...mapAdminProduct(p), options: await loadProductOptions(p.id) });
  return c.json({ products });
});

function mapAdminProduct(p) {
  return {
    id: p.id, slug: p.slug, name: p.name, description: p.description,
    categoryId: p.category_id, priceCents: p.price_cents, image: p.image,
    isVeg: !!p.is_veg, spiceLevel: p.spice_level, badge: p.badge,
    discountPct: p.discount_pct, available: !!p.available, isCombo: !!p.is_combo,
    category: { id: p.category_id, name: p.category_name, slug: p.category_slug },
  };
}

async function replaceOptions(productId, body, { replaceSizes, replaceCrusts, replaceToppings }) {
  if (replaceSizes) {
    await run('DELETE FROM product_sizes WHERE product_id = ?', productId);
    for (const s of body.sizes ?? []) {
      await run('INSERT INTO product_sizes (id, product_id, size, name, delta_cents, is_default) VALUES (?, ?, ?, ?, ?, ?)',
        uid(), productId, s.size, s.name, s.deltaCents, s.isDefault ? 1 : 0);
    }
  }
  if (replaceCrusts) {
    await run('DELETE FROM product_crusts WHERE product_id = ?', productId);
    for (const cr of body.crusts ?? []) {
      await run('INSERT INTO product_crusts (id, product_id, name, delta_cents, is_default) VALUES (?, ?, ?, ?, ?)',
        uid(), productId, cr.name, cr.deltaCents, cr.isDefault ? 1 : 0);
    }
  }
  if (replaceToppings) {
    await run('DELETE FROM product_toppings WHERE product_id = ?', productId);
    for (const tid of body.toppingIds ?? []) {
      if (await get('SELECT id FROM toppings WHERE id = ?', tid)) {
        await run('INSERT INTO product_toppings (product_id, topping_id) VALUES (?, ?)', productId, tid);
      }
    }
  }
}

admin.post('/products', async (c) => {
  const body = productSchema.parse(await readJson(c));
  if (!await get('SELECT id FROM categories WHERE id = ?', body.categoryId)) throw new HttpError(400, 'Choose a valid category.');
  const id = `prd-${uid()}`;
  await run(`INSERT INTO products (id, slug, name, description, category_id, price_cents, image, is_veg, spice_level, badge, discount_pct, available, is_combo, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM products), ?)`,
    id, await uniqueSlug(slugify(body.name)), body.name, body.description, body.categoryId, body.priceCents,
    body.image || null, body.isVeg ? 1 : 0, body.spiceLevel, body.badge || null, body.discountPct,
    body.available ? 1 : 0, body.isCombo ? 1 : 0, now());
  await replaceOptions(id, body, { replaceSizes: !body.isCombo, replaceCrusts: !body.isCombo, replaceToppings: !body.isCombo });
  const p = await get('SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?', id);
  return c.json({ product: { ...mapAdminProduct(p), options: await loadProductOptions(id) } }, 201);
});

admin.patch('/products/:id', async (c) => {
  const existing = await get('SELECT * FROM products WHERE id = ?', c.req.param('id'));
  if (!existing) throw new HttpError(404, 'Product not found.');
  const body = productSchema.partial().parse(await readJson(c));
  if (body.categoryId && !await get('SELECT id FROM categories WHERE id = ?', body.categoryId)) throw new HttpError(400, 'Choose a valid category.');
  const fields = {
    name: body.name ?? existing.name,
    description: body.description ?? existing.description,
    category_id: body.categoryId ?? existing.category_id,
    price_cents: body.priceCents ?? existing.price_cents,
    image: body.image !== undefined ? (body.image || null) : existing.image,
    is_veg: body.isVeg !== undefined ? (body.isVeg ? 1 : 0) : existing.is_veg,
    spice_level: body.spiceLevel ?? existing.spice_level,
    badge: body.badge !== undefined ? (body.badge || null) : existing.badge,
    discount_pct: body.discountPct ?? existing.discount_pct,
    available: body.available !== undefined ? (body.available ? 1 : 0) : existing.available,
    is_combo: body.isCombo !== undefined ? (body.isCombo ? 1 : 0) : existing.is_combo,
  };
  await run(`UPDATE products SET name = ?, description = ?, category_id = ?, price_cents = ?, image = ?, is_veg = ?,
       spice_level = ?, badge = ?, discount_pct = ?, available = ?, is_combo = ?, slug = ? WHERE id = ?`,
    fields.name, fields.description, fields.category_id, fields.price_cents, fields.image, fields.is_veg,
    fields.spice_level, fields.badge, fields.discount_pct, fields.available, fields.is_combo,
    await uniqueSlug(slugify(fields.name), existing.id), existing.id);
  await replaceOptions(existing.id, { sizes: [], crusts: [], toppingIds: [], ...body }, {
    replaceSizes: body.sizes !== undefined, replaceCrusts: body.crusts !== undefined, replaceToppings: body.toppingIds !== undefined,
  });
  const p = await get('SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ?', existing.id);
  return c.json({ product: { ...mapAdminProduct(p), options: await loadProductOptions(existing.id) } });
});

admin.delete('/products/:id', async (c) => {
  const existing = await get('SELECT * FROM products WHERE id = ?', c.req.param('id'));
  if (!existing) throw new HttpError(404, 'Product not found.');
  await run('DELETE FROM products WHERE id = ?', existing.id);
  return c.json({ ok: true });
});

/* ---------- Toppings ---------- */
const toppingSchema = z.object({
  name: z.string().trim().min(2).max(40),
  priceCents: z.number().int().min(0).max(5000),
  isVeg: z.boolean().default(true),
  available: z.boolean().default(true),
});

admin.get('/toppings', async (c) => {
  const rows = await all('SELECT * FROM toppings ORDER BY is_veg DESC, name');
  const toppings = [];
  for (const t of rows) {
    const count = await get('SELECT COUNT(*) c FROM product_toppings WHERE topping_id = ?', t.id);
    toppings.push({ id: t.id, name: t.name, priceCents: t.price_cents, isVeg: !!t.is_veg, available: !!t.available, productCount: count.c });
  }
  return c.json({ toppings });
});

admin.post('/toppings', async (c) => {
  const body = toppingSchema.parse(await readJson(c));
  const id = `top-${slugify(body.name)}-${randomHex(3)}`;
  await run('INSERT INTO toppings (id, name, price_cents, is_veg, available) VALUES (?, ?, ?, ?, ?)',
    id, body.name, body.priceCents, body.isVeg ? 1 : 0, body.available ? 1 : 0);
  return c.json({ topping: { id, ...body } }, 201);
});

admin.patch('/toppings/:id', async (c) => {
  const t = await get('SELECT * FROM toppings WHERE id = ?', c.req.param('id'));
  if (!t) throw new HttpError(404, 'Topping not found.');
  const body = toppingSchema.partial().parse(await readJson(c));
  await run('UPDATE toppings SET name = ?, price_cents = ?, is_veg = ?, available = ? WHERE id = ?',
    body.name ?? t.name, body.priceCents ?? t.price_cents,
    body.isVeg !== undefined ? (body.isVeg ? 1 : 0) : t.is_veg,
    body.available !== undefined ? (body.available ? 1 : 0) : t.available, t.id);
  return c.json({ ok: true });
});

admin.delete('/toppings/:id', async (c) => {
  await run('DELETE FROM toppings WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

/* ---------- Promos ---------- */
const promoSchema = z.object({
  code: z.string().trim().min(3, 'Code must be at least 3 characters.').max(16).transform(v => v.toUpperCase()),
  description: z.string().trim().max(120).default(''),
  type: z.enum(['percent', 'flat']),
  value: z.number().int().min(1),
  minOrderCents: z.number().int().min(0).default(0),
  maxDiscountCents: z.number().int().min(0).nullable().default(null),
  active: z.boolean().default(true),
});

admin.get('/promos', async (c) => {
  const rows = await all('SELECT * FROM promos ORDER BY active DESC, code');
  const promos = [];
  for (const p of rows) {
    const used = await get('SELECT COUNT(*) c FROM orders WHERE promo_code = ?', p.code);
    promos.push({
      id: p.id, code: p.code, description: p.description, type: p.type, value: p.value,
      minOrderCents: p.min_order_cents, maxDiscountCents: p.max_discount_cents, active: !!p.active,
      usedCount: used.c,
    });
  }
  return c.json({ promos });
});

admin.post('/promos', async (c) => {
  const body = promoSchema.parse(await readJson(c));
  if (body.type === 'percent' && body.value > 90) throw new HttpError(400, 'Percentage discounts cap at 90%.');
  if (await get('SELECT id FROM promos WHERE code = ?', body.code)) throw new HttpError(409, 'That code already exists.');
  const id = uid();
  await run(`INSERT INTO promos (id, code, description, type, value, min_order_cents, max_discount_cents, active, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id, body.code, body.description, body.type, body.value, body.minOrderCents, body.maxDiscountCents, body.active ? 1 : 0);
  return c.json({ promo: { id, ...body } }, 201);
});

admin.patch('/promos/:id', async (c) => {
  const p = await get('SELECT * FROM promos WHERE id = ?', c.req.param('id'));
  if (!p) throw new HttpError(404, 'Promo not found.');
  const body = promoSchema.partial().parse(await readJson(c));
  await run(`UPDATE promos SET code = ?, description = ?, type = ?, value = ?, min_order_cents = ?, max_discount_cents = ?, active = ? WHERE id = ?`,
    body.code ?? p.code, body.description ?? p.description, body.type ?? p.type, body.value ?? p.value,
    body.minOrderCents ?? p.min_order_cents, body.maxDiscountCents ?? p.max_discount_cents,
    body.active !== undefined ? (body.active ? 1 : 0) : p.active, p.id);
  return c.json({ ok: true });
});

admin.delete('/promos/:id', async (c) => {
  await run('DELETE FROM promos WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

/* ---------- Orders ---------- */
admin.get('/orders', async (c) => {
  const { status, q } = c.req.query();
  const where = [];
  const params = [];
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status)); }
  if (q) { where.push('(number LIKE ? OR customer_name LIKE ? OR phone LIKE ?)'); const like = `%${String(q)}%`; params.push(like, like, like); }
  const rows = await all(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 200`, ...params);
  const out = [];
  for (const o of rows) {
    const count = await get('SELECT COALESCE(SUM(qty), 0) c FROM order_items WHERE order_id = ?', o.id);
    out.push({
      id: o.id, number: o.number, customer: o.customer_name, phone: o.phone,
      fulfilment: o.fulfilment, status: o.status, totalCents: o.total_cents,
      paymentMethod: o.payment_method, createdAt: o.created_at,
      itemCount: count.c,
    });
  }
  return c.json({
    orders: out,
    statuses: trackingStages('delivery').map(s => s.key).concat(trackingStages('pickup').map(s => s.key))
      .filter((v, i, a) => a.indexOf(v) === i).concat(['cancelled']),
  });
});

admin.get('/orders/:id', async (c) => {
  const id = c.req.param('id');
  const o = await get('SELECT * FROM orders WHERE id = ? OR number = ?', id, String(id).toUpperCase());
  if (!o) throw new HttpError(404, 'Order not found.');
  return c.json({ order: await orderPayload(o, await getSettings()) });
});

const statusSchema = z.object({
  status: z.enum(['received', 'confirmed', 'preparing', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled']),
});

admin.patch('/orders/:id', async (c) => {
  const o = await get('SELECT * FROM orders WHERE id = ?', c.req.param('id'));
  if (!o) throw new HttpError(404, 'Order not found.');
  const { status } = statusSchema.parse(await readJson(c));
  if (status === 'out_for_delivery' && o.fulfilment === 'pickup') {
    throw new HttpError(400, 'Pickup orders cannot be marked out for delivery — use "Ready for Pickup".');
  }
  if (status === 'ready_for_pickup' && o.fulfilment === 'delivery') {
    throw new HttpError(400, 'Delivery orders cannot be marked ready for pickup — use "Out for Delivery".');
  }
  const ts = now();
  await run('UPDATE orders SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?', status, ts, ts, o.id);
  return c.json({ ok: true, status });
});

/* ---------- Settings ---------- */
admin.get('/settings', async (c) => {
  const settings = await getSettings();
  return c.json({ settings, defaults: DEFAULT_SETTINGS, public: await publicSettings(settings) });
});

const settingsSchema = z.object({
  store_name: z.string().min(1).max(60).optional(),
  tagline: z.string().max(60).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(80).optional(),
  address: z.string().max(140).optional(),
  hours: z.string().max(140).optional(),
  currency_symbol: z.string().min(1).max(4).optional(),
  currency_code: z.string().min(3).max(5).optional(),
  delivery_fee_cents: z.number().int().min(0).max(10000).optional(),
  free_delivery_min_cents: z.number().int().min(0).max(100000).optional(),
  tax_pct: z.number().min(0).max(30).optional(),
  extra_cheese_cents: z.number().int().min(0).max(5000).optional(),
  eta_delivery_minutes: z.number().int().min(5).max(180).optional(),
  eta_pickup_minutes: z.number().int().min(5).max(180).optional(),
  auto_advance: z.boolean().optional(),
  pay_cod: z.boolean().optional(),
  pay_upi: z.boolean().optional(),
  pay_card: z.boolean().optional(),
  pay_wallet: z.boolean().optional(),
});

admin.put('/settings', async (c) => {
  const body = settingsSchema.parse(await readJson(c));
  const current = await getSettings();
  if (body.pay_cod === false && !body.pay_upi && !body.pay_card && !body.pay_wallet
    && !current.pay_upi && !current.pay_card && !current.pay_wallet) {
    throw new HttpError(400, 'Keep at least one payment method enabled.');
  }
  const updated = await updateSettings(body);
  return c.json({ settings: updated, public: await publicSettings(updated) });
});
