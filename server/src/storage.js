import { HttpError } from './util.js';

// Upload storage abstraction: filesystem on Node (dev/tests), R2 on Workers.
let impl = null;
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};

export function contentTypeFor(name) {
  const dot = name.lastIndexOf('.');
  return (dot >= 0 && MIME[name.slice(dot).toLowerCase()]) || 'application/octet-stream';
}

export function configureStorage(s) { impl = s; }

export async function putUpload(name, bytes, contentType) {
  if (!impl?.put) throw new HttpError(503, 'Uploads are not available right now.');
  return impl.put(name, bytes, contentType);
}

export async function getUpload(name) {
  if (!impl?.get) return null;
  return impl.get(name);
}
