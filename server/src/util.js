import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const uid = () => crypto.randomUUID();

export const now = () => Date.now();

export function setCookie(res, name, value, opts = {}) {
  res.cookie(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: opts.maxAge ?? 30 * 24 * 60 * 60 * 1000,
    ...opts,
  });
}

export function parseJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}
