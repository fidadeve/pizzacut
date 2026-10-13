// Cloudflare Worker entry point — D1 for data, R2 for uploads, ASSETS for the SPA.
import { configureDb, ensureSchema } from './db.js';
import { createD1Backend } from './d1.js';
import { configureStorage } from './storage.js';
import { createApi } from './app.js';
import { seed } from './seed.js';

const api = createApi();
let booted = null;

// The _headers file only covers assets Cloudflare serves directly; responses
// that pass through this Worker need the same hardening applied by hand.
function harden(res) {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function boot(env) {
  if (!booted) {
    booted = (async () => {
      configureDb(createD1Backend(env.DB));
      configureStorage({
        async put(name, bytes, contentType) {
          await env.FILES.put(name, bytes, { httpMetadata: { contentType } });
          return { url: `/api/uploads/${name}` };
        },
        async get(name) {
          const obj = await env.FILES.get(name);
          if (!obj) return null;
          return {
            body: await obj.arrayBuffer(),
            contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
          };
        },
      });
      await ensureSchema();
      await seed();
    })();
  }
  return booted;
}

export default {
  async fetch(request, env, ctx) {
    await boot(env);
    const url = new URL(request.url);

    // Everything under /api goes to the Hono app; static assets and SPA
    // fallbacks are served by the ASSETS binding.
    if (url.pathname.startsWith('/api/')) {
      return api.fetch(request, env, ctx);
    }

    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return harden(asset);

    // Unknown non-API path → hand the SPA router the entry document.
    const index = await env.ASSETS.fetch(new URL('/', url).toString());
    return harden(new Response(index.body, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));
  },
};
