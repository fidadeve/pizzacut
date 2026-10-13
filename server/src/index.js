// Node entry point — local development, tests and `npm start`.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureDb, ensureSchema } from './db.js';
import { createSqliteBackend } from './sqlite.js';
import { configureStorage } from './storage.js';
import { createApi } from './app.js';
import { seed } from './seed.js';

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

const app = createApi();

/* ---- Static client build (dev falls back to the Vite dev server) ---- */
const dist = path.join(root, 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), dist) || '.' }));
  app.get('*', serveStatic({ path: path.join(dist, 'index.html') }));
}

await seed();

const PORT = Number(process.env.PORT || 4000);
serve({ fetch: app.fetch, port: PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`PizzaCut API on http://localhost:${info.port}`);
});
