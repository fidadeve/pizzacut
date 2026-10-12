import { Router } from 'express';
import { z } from 'zod';
import { get, run } from '../db.js';
import { hashPassword, verifyPassword, createSession, destroySession, claimSessionData } from '../auth.js';
import { SESSION_COOKIE, CART_COOKIE } from '../auth.js';
import { HttpError, wrap, uid, now, setCookie } from '../util.js';

export const authRouter = Router();

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.').max(128);
const phoneSchema = z.string().trim().regex(/^[+()\-.\s\d]{7,18}$/, 'Enter a valid phone number.');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(60),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

authRouter.post('/register', wrap(async (req, res) => {
  const body = registerSchema.parse(req.body);
  if (get('SELECT id FROM users WHERE email = ?', body.email)) {
    throw new HttpError(409, 'An account with this email already exists. Try signing in.');
  }
  const id = uid();
  run('INSERT INTO users (id, email, password_hash, name, phone, role, addresses, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, body.email, hashPassword(body.password), body.name, body.phone ?? null, 'customer', '[]', now());
  claimSessionData(id, req.sessionToken);
  destroySession(req.sessionToken);
  const token = createSession(id);
  setCookie(res, SESSION_COOKIE, token);
  const user = get('SELECT id, email, name, phone, role, addresses FROM users WHERE id = ?', id);
  res.status(201).json({ user: publicUser(user) });
}));

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.') });

authRouter.post('/login', wrap(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = get('SELECT * FROM users WHERE email = ?', body.email);
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  destroySession(req.sessionToken);
  const token = createSession(user.id);
  claimSessionData(user.id, req.sessionToken);
  setCookie(res, SESSION_COOKIE, token);
  res.json({ user: publicUser(user) });
}));

authRouter.post('/logout', wrap(async (req, res) => {
  destroySession(req.sessionToken);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}));

authRouter.get('/me', wrap(async (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
}));

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

authRouter.patch('/profile', wrap(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Please sign in to continue.');
  const body = profileSchema.parse(req.body);
  const current = get('SELECT * FROM users WHERE id = ?', req.user.id);
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
  run('UPDATE users SET name = ?, phone = ?, addresses = ? WHERE id = ?', name, phone, addresses, req.user.id);
  const user = get('SELECT id, email, name, phone, role, addresses FROM users WHERE id = ?', req.user.id);
  res.json({ user: publicUser(user) });
}));

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
