export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const uid = () => crypto.randomUUID();

export const now = () => Date.now();

export function randomHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

export function parseJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

/** Reads a JSON request body. Empty body → {}. Malformed → 400 (same as the old express.json error). */
export async function readJson(c) {
  const text = await c.req.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid request body.'); }
}
