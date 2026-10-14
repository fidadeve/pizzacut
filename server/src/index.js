// Node entry point — local development, tests and `npm start`.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { configureDb, ensureSchema } from './db.js';
import { createSqliteBackend } from './sqlite.js';
import { configureStorage } from './storage.js';
import { createApi } from './app.js';
import { seed } from './seed.js';

// ---- Static headers (hardened for production) ----
const headersMiddleware = (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  return next();
};

// Export the same middleware to be applied once on the Hono app below.
export { headersMiddleware };

let app;

export const getApp = () => app;

export function applyHeadersMiddleware(appInstance) {
  appInstance.use('*', headersMiddleware);
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');

/* ---- Filesystem-backed uploads ---- */
const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};
configureStorage({
  async put(name, bytes) {
    const safe = path.basename(name);
    await fs.promises.writeFile(path.join(uploadsDir, safe), Buffer.from(bytes));
    return { url: `/api/uploads/${safe}` };
  },
  async get(name) {
    const safe = path.basename(name);
    const file = path.join(uploadsDir, safe);
    try {
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) return null;
      const body = await fs.promises.readFile(file);
      return { body, contentType: MIME[path.extname(safe).toLowerCase()] || 'application/octet-stream' };
    } catch {
      return null;
    }
  },
});

/* ---- Database ---- */
configureDb(createSqliteBackend(process.env.DB_PATH));
await ensureSchema();

app = createApi();
applyHeadersMiddleware(app);

// ---- Static client build + dev-only Vite proxy (dev only; never exposed in production) ----
const dist = path.join(root, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), dist) || '.' }));
  app.get('*', serveStatic({ path: path.join(dist, 'index.html') }));
}

if (process.env.NODE_ENV === 'development') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: path.join(root, 'client'),
    server: { port: 3000, strictPort: true },
    logLevel: 'silent',
  });
  app.use('/*', async (c) => {
    const res = await vite.middlewares.handle(
      new Request(`http://localhost:${vite.config.server.port}${c.req.path}`,
        { method: c.req.method, headers: c.req.headers }),
      c.req.raw,
    );
    return new Response(res.body, {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
    });
  });
}

await seed();

const PORT = Number(process.env.PORT || 4000);
// Production: bind only to localhost on the server itself.
const HOST = process.env.HOST || '127.0.0.1';
if (process.env.NODE_ENV === 'development') {
  // Dev: Vite dev server is already mounted above; do not start a second HTTP listener.
  console.log(`PizzaCut API (dev, no HTTP listener) on :3000`);
} else {
  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
    console.log(`PizzaCut API on http://${HOST}:${info.port}`);
  });
}

