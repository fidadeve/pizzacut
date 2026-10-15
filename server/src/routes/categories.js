import { Hono } from 'hono';
import { z } from 'zod';
import { all, get, run } from '../db.js';
import { requireAdmin } from '../auth.js';
import { CATEGORY_CONFIG } from '../categories.js';
import { uid, now, HttpError, randomHex } from '../util.js';
import { putUpload } from '../storage.js';

// Categories CRUD for the admin panel (GET/POST/PATCH/DELETE + reorder).
// Client-side types live in client/src/lib/types.ts so the admin UI binds to
// one shared contract.

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const categories = new Hono();
categories.use('*', requireAdmin);

function mapCategory(row) {
  return {
    id: row.id, slug: row.slug, name: row.name, description: row.description ?? '',
    image: row.image ?? '', sortOrder: row.sort_order, active: row.active === 1,
    productCount: Number(row.product_count ?? 0),
  };
}

async function readCategory(id) {
  const row = await get(
    `SELECT c.*, COALESCE((
       SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.available = 1
     ), 0) AS product_count
     FROM categories c WHERE c.id = ?`,
    id,
  );
  if (!row) throw new HttpError(404, 'Category not found.');
  return mapCategory(row);
}

// GET /api/admin/categories
categories.get('/', async (c) => {
  const rows = await all(
    `SELECT c.*, COALESCE((
       SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.available = 1
     ), 0) AS product_count
     FROM categories c ORDER BY c.sort_order, c.name`,
  );
  return c.json({ categories: rows.map(mapCategory) });
});

// GET /api/admin/categories/:id
categories.get('/:id', async (c) => {
  return c.json({ category: await readCategory(c.req.param('id')) });
});

// POST /api/admin/categories
categories.post('/', async (c) => {
  const body = await c.req.json();
  if (!slugPattern.test(typeof body.slug === 'string' ? body.slug : '')) {
    throw new HttpError(400, 'Slug may only contain lowercase letters, numbers and hyphens.');
  }
  if (body.name == null || typeof body.name !== 'string' || !body.name.trim()) {
    throw new HttpError(400, 'Category name is required.');
  }
  if (body.name.trim().length > 80) {
    throw new HttpError(400, 'Category name must be 80 characters or fewer.');
  }
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > 400)) {
    throw new HttpError(400, 'Description must be 400 characters or fewer.');
  }
  if (body.image != null && (typeof body.image !== 'string' || body.image.length > 300)) {
    throw new HttpError(400, 'Image URL must be 300 characters or fewer.');
  }
  if (body.sortOrder != null && !Number.isInteger(body.sortOrder)) {
    throw new HttpError(400, 'Display order must be a whole number.');
  }
  if (body.active != null && typeof body.active !== 'boolean') {
    throw new HttpError(400, 'Active status must be a boolean.');
  }
  if (await get('SELECT id FROM categories WHERE slug = ?', body.slug)) {
    throw new HttpError(409, 'A category with that slug already exists.');
  }
  if (body.name.trim().toLowerCase() !== body.name.trim()) {
    throw new HttpError(409, 'A category with that name already exists.');
  }

  const id = `cat-${uid()}`;
  const active = body.active === false ? 0 : 1;
  const sortOrder = Number.isInteger(body.sortOrder)
    ? body.sortOrder
    : (await get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories')).m;
  await run(
    `INSERT INTO categories (id, slug, name, description, image, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, body.slug, body.name.trim(), body.description?.trim() ?? '', body.image?.trim() ?? null,
    sortOrder, active,
  );
  return c.json({ category: await readCategory(id) }, 201);
});

// PATCH /api/admin/categories/:id
categories.patch('/:id', async (c) => {
  const existing = await get('SELECT * FROM categories WHERE id = ?', c.req.param('id'));
  if (!existing) throw new HttpError(404, 'Category not found.');
  const body = await c.req.json();

  if (body.name != null && typeof body.name === 'string') {
    if (body.name.trim().length > 80) throw new HttpError(400, 'Category name must be 80 characters or fewer.');
    if (body.name.trim() !== existing.name && existing.name.trim().toLowerCase() === body.name.trim().toLowerCase()) {
      throw new HttpError(409, 'A category with that name already exists.');
    }
  }
  if (body.slug != null && typeof body.slug === 'string') {
    if (!slugPattern.test(body.slug)) {
      throw new HttpError(400, 'Slug may only contain lowercase letters, numbers and hyphens.');
    }
    if (body.slug !== existing.slug && await get('SELECT id FROM categories WHERE slug = ?', body.slug)) {
      throw new HttpError(409, 'A category with that slug already exists.');
    }
  }
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > 400)) {
    throw new HttpError(400, 'Description must be 400 characters or fewer.');
  }
  if (body.image != null && (typeof body.image !== 'string' || body.image.length > 300)) {
    throw new HttpError(400, 'Image URL must be 300 characters or fewer.');
  }
  if (body.sortOrder != null && !Number.isInteger(body.sortOrder)) {
    throw new HttpError(400, 'Display order must be a whole number.');
  }
  if (body.active != null && typeof body.active !== 'boolean') {
    throw new HttpError(400, 'Active status must be a boolean.');
  }

  const updates = [];
  const params = [];
  if (body.name != null && typeof body.name === 'string') { updates.push('name = ?'); params.push(body.name.trim()); }
  if (body.description != null && typeof body.description === 'string') { updates.push('description = ?'); params.push(body.description.trim()); }
  if (body.image != null && typeof body.image === 'string') { updates.push('image = ?'); params.push(body.image.trim() || null); }
  if (body.slug != null && typeof body.slug === 'string' && body.slug !== existing.slug) { updates.push('slug = ?'); params.push(body.slug); }
  if (body.sortOrder != null) { updates.push('sort_order = ?'); params.push(body.sortOrder); }
  if (body.active != null) { updates.push('active = ?'); params.push(body.active ? 1 : 0); }

  if (updates.length === 0) {
    return c.json({ category: mapCategory(existing) });
  }
  params.push(existing.id);
  await run(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`, ...params);
  return c.json({ category: await readCategory(existing.id) });
});

// DELETE /api/admin/categories/:id
categories.delete('/:id', async (c) => {
  const existing = await get('SELECT * FROM categories WHERE id = ?', c.req.param('id'));
  if (!existing) throw new HttpError(404, 'Category not found.');
  if (existing.active === 0) throw new HttpError(400, 'Only active categories can be deleted.');
  const productCount = await get('SELECT COUNT(*) c FROM products WHERE category_id = ?', existing.id);
  if (productCount.c > 0) {
    throw new HttpError(409, `Cannot delete “${existing.name}” — it has ${productCount.c} product${productCount.c === 1 ? '' : 's'} on the menu. Move those products to another category first.`);
  }
  await run('DELETE FROM categories WHERE id = ?', existing.id);
  return c.json({ ok: true });
});

// POST /api/admin/categories/reorder
categories.post('/reorder', async (c) => {
  const body = await c.req.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length === 0) throw new HttpError(400, 'Provide at least one category id.');
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Category ids must be unique.');
  for (const id of ids) {
    if (typeof id !== 'string' || !id.startsWith('cat-')) throw new HttpError(400, `Invalid category id: ${id}`);
    const row = await get('SELECT id FROM categories WHERE id = ?', id);
    if (!row) throw new HttpError(400, `Unknown category id: ${id}`);
    await run('UPDATE categories SET sort_order = ? WHERE id = ?', ids.indexOf(id), id);
  }
  return c.json({ ok: true });
});
