import { Hono } from 'hono';
import { ZodError } from 'zod';
import { attachContext } from './auth.js';
import { HttpError } from './util.js';
import { getUpload } from './storage.js';
import { catalog } from './routes/catalog.js';
import { auth } from './routes/auth.js';
import { cart } from './routes/cart.js';
import { orders } from './routes/orders.js';
import { admin } from './routes/admin.js';
import { rider as riderRoutes } from './routes/rider.js';
import { categories } from './routes/categories.js';

/**
 * Builds the API-only Hono application. Static asset serving differs per
 * runtime (filesystem on Node, the ASSETS binding on Workers) so it is
 * layered on by each entry point rather than here.
 */
export function createApi() {
  const app = new Hono();

  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    await next();
  });

  // Uploaded product images (304-friendly, served from fs or R2).
  app.get('/api/uploads/:name', async (c) => {
    const file = await getUpload(c.req.param('name'));
    if (!file) return c.notFound();
    return new Response(file.body, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=604800',
      },
    });
  });

  app.use('/api/*', attachContext);
  app.use('/api', attachContext);

  app.route('/api/auth', auth);
  app.route('/api/cart', cart);
  app.route('/api/orders', orders);
  app.route('/api/admin', admin);
  app.route('/api/rider', riderRoutes);
  app.route('/api/catalog', catalog);
  app.route('/api/categories', categories);

  app.notFound((c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Endpoint not found.' }, 404);
    }
    return c.text('Not found', 404);
  });

  // eslint-disable-next-line no-unused-vars
  app.onError((err, c) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return c.json({
        error: first?.message ?? 'Please check the form.',
        fields: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      }, 400);
    }
    if (err instanceof HttpError) {
      return c.json({ error: err.message, details: err.details }, err.status);
    }
    if (err?.name === 'AbortError') return c.text('Bad request', 400);
    console.error(err);
    return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500);
  });

  return app;
}
