# PizzaCut — Taste Maker 🍕

A premium, mobile-first pizza ordering app built around the PizzaCut brand
(primary red `#FF0018`, white, black, charcoal `#29252A`).

Customers can browse the menu, customize pizzas (size, crust, toppings, extra
cheese), apply promo codes, check out as guest or account holder, and track
their order through five live stages. Staff get a protected dashboard for
menu, offers, orders and store settings — with all prices, discounts and
permissions validated on the server.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19 + TypeScript + Vite + React Router 7 + Tailwind CSS 4 |
| Backend  | Node 24 + Express 5 + `node:sqlite` (file DB, WAL) + zod validation |
| Auth     | Session cookies (httpOnly) + scrypt password hashing, customer/admin roles |
| Assets   | Self-hosted fonts (Lilita One, Manrope), WebP food photography, SVG logo/favicon |

## Run it

```bash
npm install          # installs client + server workspaces
npm run dev          # API on :4000, web app on :3000
```

Production build:

```bash
npm run build        # builds client/dist
npm start            # Express serves the API + the built app on :4000
```

Other scripts: `npm run typecheck`, `npm test` (API test suite), `npm run dev:server`, `npm run dev:client`.

## Accounts

| Role    | Email | Password |
|---------|-------|----------|
| Staff (admin) | `admin@pizzacut.com` | `admin123` |

Sign up as a customer in the app, or order as a guest — guest carts and orders
are tied to the session cookie.

Admin dashboard: `/admin` (not linked anywhere in customer navigation).

## What's server-validated

- Product prices, size/crust/topping options and availability come from the
  database — client prices are never trusted.
- Promo codes are re-checked at apply time *and* at order placement (active,
  expiry, minimum order, discount caps).
- Delivery fees, free-delivery threshold and taxes are computed server-side.
- Payment methods are limited to those the business has enabled; unavailable
  methods are rejected with a clear error (no fake payment success screens).
- Admin routes require an authenticated `admin` session (role check per request).
- Order status only changes from real order data (staff updates in the admin
  dashboard, or the optional demo auto-advance setting).

## Order lifecycle

`received → confirmed → preparing → out_for_delivery / ready_for_pickup → delivered`
(plus `cancelled`). Customers poll their order; the admin dashboard updates
statuses. Settings → “Auto-advance demo kitchen” simulates a kitchen for demos
and can be switched off for manual control.

## Project layout

```
client/               React SPA
  public/             logo.svg, favicon.svg, fonts, WebP imagery
  src/components/     Header, BottomNav, Footer, ProductCard, Logo, ui kit
  src/pages/          Home, Menu, Product, Cart, Checkout, Confirmation,
                      Tracking, Orders, Profile, Login, Offers, 404, admin/*
  src/lib/            api client, cart/auth/settings/toast providers, types
server/
  src/index.js        Express app (API + static build in production)
  src/routes/         catalog, cart, orders, auth, admin
  src/pricing.js      pricing + promo engine (single source of truth)
  src/tracking.js     order status model
  src/seed.js         idempotent seed: 7 categories, 30 products, 4 promos
  tests/api.test.mjs  end-to-end API suite (node --test)
```

## Tests

- `npm test` — 10 API integration tests (catalog, cart pricing, promos, auth,
  checkout validation, guest orders, RBAC, admin CRUD, status flow, hardening).
- The UI was verified end-to-end with a headless Chromium journey: browse →
  customize → cart → promo → checkout → confirmation → tracking, plus the
  admin flow and responsive checks at 390 / 768 / 1280 px.

## Notes

- Images are compressed WebP (≈1.5 MB for the whole catalog); product images
  load lazily below the fold.
- Digital payment methods (UPI/card/wallet) appear as “Not available yet”
  until the business enables them in Admin → Settings once a payment provider
  is connected; Cash on Delivery works out of the box.
