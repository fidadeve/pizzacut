import { getCookie, setCookie } from 'hono/cookie';
import { get, run } from './db.js';
import { HttpError, now, randomHex } from './util.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_S = SESSION_TTL_MS / 1000;
export const SESSION_COOKIE = 'pc_sid';
export const CART_COOKIE = 'pc_cart';

// PBKDF2-SHA256 via Web Crypto — identical on Node and Cloudflare Workers.
// workerd caps PBKDF2 at 100k iterations; 50k keeps the CPU cost comfortably
// inside the per-request budget while remaining a reasonable work factor.
const PBKDF2_ITERATIONS = 50_000;

async function pbkdf2(password, saltHex, iterations) {
  const enc = new TextEncoder();
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password, stored) {
  const [v, iterStr, salt, hash] = String(stored || '').split('$');
  if (v !== 'pbkdf2' || !iterStr || !salt || !hash) return false;
  const candidate = await pbkdf2(password, salt, Number(iterStr) || PBKDF2_ITERATIONS);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export async function createSession(userId) {
  const token = randomHex(32);
  await run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    token, userId ?? null, now(), now() + SESSION_TTL_MS);
  return token;
}

export async function destroySession(token) {
  if (token) await run('DELETE FROM sessions WHERE token = ?', token);
}

// Same-site enforcement on the session cookie (no cross-site reads).
export const sessionCookieOptions = { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_S };

/**
 * Hono middleware: attaches `ctx` (user / sessionToken / cartId) to the
 * context and guarantees a session cookie and a cart cookie on every API request.
 */
export async function attachContext(c, next) {
  const ctx = {};
  c.set('ctx', ctx);

  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    const session = await get('SELECT * FROM sessions WHERE token = ?', sid);
    if (session && session.expires_at > now()) {
      ctx.sessionToken = sid;
      ctx.user = session.user_id
        ? await get('SELECT id, email, name, phone, role, addresses, created_at FROM users WHERE id = ?', session.user_id) || null
        : null;
    } else if (session) {
      await destroySession(sid);
    }
  }
  if (!ctx.sessionToken) {
    ctx.sessionToken = await createSession(null);
    setCookie(c, SESSION_COOKIE, ctx.sessionToken, sessionCookieOptions);
  }

  let cartId = getCookie(c, CART_COOKIE);
  const cart = cartId ? await get('SELECT id FROM carts WHERE id = ?', cartId) : null;
  if (!cart) {
    cartId = crypto.randomUUID();
    await run('INSERT INTO carts (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
      cartId, ctx.user?.id ?? null, now(), now());
    setCookie(c, CART_COOKIE, cartId, sessionCookieOptions);
  }
  ctx.cartId = cartId;

  await next();
}

/** Claim guest carts/orders into the account after login. */
export async function claimSessionData(userId, sessionToken, cartId) {
  if (cartId) {
    await run('UPDATE carts SET user_id = ? WHERE id = ? AND user_id IS NULL', userId, cartId);
  }
  if (sessionToken) {
    await run('UPDATE orders SET user_id = ? WHERE session_token = ? AND user_id IS NULL', userId, sessionToken);
  }
}

export async function requireAuth(c, next) {
  const ctx = c.get('ctx');
  if (!ctx?.user) throw new HttpError(401, 'Please sign in to continue.');
  await next();
}

export async function requireAdmin(c, next) {
  const ctx = c.get('ctx');
  if (!ctx?.user) throw new HttpError(401, 'Please sign in to continue.');
  if (ctx.user.role !== 'admin') throw new HttpError(403, 'Staff access required.');
  await next();
}

/** Guards every rider-portal API route. Also caches the rider row on ctx. */
export async function requireRider(c, next) {
  const ctx = c.get('ctx');
  if (!ctx?.user) throw new HttpError(401, 'Please sign in to continue.');
  if (ctx.user.role !== 'rider') throw new HttpError(403, 'Rider access required.');
  const rider = await get('SELECT * FROM riders WHERE user_id = ?', ctx.user.id);
  if (!rider) throw new HttpError(403, 'No rider profile found for this account.');
  if (rider.status !== 'active') throw new HttpError(403, 'Your rider account is not active. Contact the PizzaCut team.');
  ctx.rider = rider;
  await next();
}
