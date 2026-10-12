import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { seed } from './seed.js';
import { attachContext } from './auth.js';
import { HttpError } from './util.js';
import { catalogRouter } from './routes/catalog.js';
import { authRouter } from './routes/auth.js';
import { cartRouter } from './routes/cart.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => { const t = Date.now(); res.on('finish', () => {
    if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`);
  }); next(); });
}
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(attachContext);

app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d', immutable: true }));
app.use('/api', catalogRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: first?.message ?? 'Please check the form.',
      fields: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err?.name === 'MulterError') return res.status(400).json({ error: 'Upload too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const PORT = Number(process.env.PORT || 4000);
seed();
app.listen(PORT, '0.0.0.0', () => console.log(`PizzaCut API on http://localhost:${PORT}`));
