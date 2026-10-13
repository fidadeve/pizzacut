import { Hono } from 'hono';
import { z } from 'zod';
import { get, run } from '../db.js';
import { hashPassword, verifyPassword, createSession, destroySession, claimSessionData } from '../auth.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../auth.js';
import { HttpError, uid, now, readJson } from '../util.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export const auth = new Hono();

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.').max(128);
const phoneSchema = z.string().trim().regex(/^[+()\-.\s\d]{7,18}$/, 'Enter a valid phone number.');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(60),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

auth.post('/register', async (c) => {
  const ctx = c.get('ctx');
  const body = registerSchema.parse(await readJson(c));
  if (await get('SELECT id FROM users WHERE email = ?', body.email)) {
    throw new HttpError(409, 'An account with this email already exists. Try signing in.');
  }
  const id = uid();
  await run('INSERT INTO users (id, email, password_hash, name, phone, role, addresses, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, body.email, await hashPassword(body.password), body.name, body.phone ?? null, 'customer', '[]', now());
  await claimSessionData(id, ctx.sessionToken, ctx.cartId);
  await destroySession(ctx.sessionToken);
  const token = await createSession(id);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions);
  const user = await get('SELECT id, email, name, phone, role, addresses FROM users WHERE id = ?', id);
  return c.json({ user: publicUser(user) }, 201);
});

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.') });

auth.post('/login', async (c) => {
  const ctx = c.get('ctx');
  const body = loginSchema.parse(await readJson(c));
  const user = await get('SELECT * FROM users WHERE email = ?', body.email);
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  await destroySession(ctx.sessionToken);
  const token = await createSession(user.id);
  await claimSessionData(user.id, ctx.sessionToken, ctx.cartId);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions);
  return c.json({ user: publicUser(user) });
});

auth.post('/logout', async (c) => {
  const ctx = c.get('ctx');
  await destroySession(ctx.sessionToken);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

auth.get('/me', async (c) => c.json({ user: c.get('ctx').user ? publicUser(c.get('ctx').user) : null }));

const profileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  phone: phoneSchema.optional(),
  addresses: z.array(z.object({
    id: z.string().optional(),
    label: z.string().trim().min(1).max(30),
    line1: z.string().trim().min(3).max(120),
    line2: z.string().trim().max(120).optional().or(z.literal('')),
    city: z.string().trim().min(2).max(60),
    zip: z.string().trim().min(3).max(12),
    isDefault: z.boolean().optional(),
  })).max(8).optional(),
});

auth.patch('/profile', async (c) => {
  const ctx = c.get('ctx');
  if (!ctx.user) throw new HttpError(401, 'Please sign in to continue.');
  const body = profileSchema.parse(await readJson(c));
  const current = await get('SELECT * FROM users WHERE id = ?', ctx.user.id);
  const name = body.name ?? current.name;
  const phone = body.phone ?? current.phone;
  let addresses = current.addresses;
  if (body.addresses) {
    for (const a of body.addresses) {
      if (!a.line1 || !a.city || !a.zip) throw new HttpError(400, 'Each address needs a street, city and postal code.');
    }
    const normalized = body.addresses.map(a => ({ ...a, id: a.id ?? uid(), line2: a.line2 || '' }));
    const def = normalized.find(a => a.isDefault) ?? normalized[0];
    addresses = JSON.stringify(normalized.map(a => ({ ...a, isDefault: a.id === def.id })));
  }
  await run('UPDATE users SET name = ?, phone = ?, addresses = ? WHERE id = ?', name, phone, addresses, ctx.user.id);
  const user = await get('SELECT id, email, name, phone, role, addresses FROM users WHERE id = ?', ctx.user.id);
  return c.json({ user: publicUser(user) });
});

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    addresses: JSON.parse(user.addresses || '[]'),
    createdAt: user.created_at,
  };
}
