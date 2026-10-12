import crypto from 'node:crypto';
import { db, get, run } from './db.js';
import { HttpError, now, setCookie } from './util.js';

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'pc_sid';
export const CART_COOKIE = 'pc_cart';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    token, userId ?? null, now(), now() + SESSION_TTL);
  return token;
}

export function destroySession(token) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

/** Attaches req.user and guarantees a cart (req.cartId) for every request. */
export function attachContext(req, res, next) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) {
    const session = get('SELECT * FROM sessions WHERE token = ?', sid);
    if (session && session.expires_at > now()) {
      req.sessionToken = sid;
      req.user = session.user_id
        ? get('SELECT id, email, name, phone, role, addresses, created_at FROM users WHERE id = ?', session.user_id) || null
        : null;
    } else if (session) {
      destroySession(sid);
    }
  }
  if (!req.sessionToken) {
    req.sessionToken = createSession(null);
    setCookie(res, SESSION_COOKIE, req.sessionToken);
  }
  let cartId = req.cookies?.[CART_COOKIE];
  const cart = cartId ? get('SELECT id FROM carts WHERE id = ?', cartId) : null;
  if (!cart) {
    cartId = crypto.randomUUID();
    run('INSERT INTO carts (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
      cartId, req.user?.id ?? null, now(), now());
    setCookie(res, CART_COOKIE, cartId);
  }
  req.cartId = cartId;
  next();
}

/** Claim guest carts/orders into the account after login. */
export function claimSessionData(userId, sessionToken) {
  if (!sessionToken) return;
  run('UPDATE carts SET user_id = ? WHERE id IS NOT NULL AND user_id IS NULL AND id IN (SELECT id FROM carts)', userId);
  run('UPDATE orders SET user_id = ? WHERE session_token = ? AND user_id IS NULL', userId, sessionToken);
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'));
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue.'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Staff access required.'));
  next();
}
