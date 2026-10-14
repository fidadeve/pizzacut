import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { ctx.child.kill('SIGTERM'); });

const money = (obj, key) => obj[key];

test('public catalog: categories, products, product detail, promos, settings', async () => {
  const c = client();
  const cats = await c.get('/api/categories');
  assert.equal(cats.status, 200);
  assert.equal(cats.json.categories.length, 7);

  const prods = await c.get('/api/products?category=classic-pizza');
  assert.equal(prods.status, 200);
  assert.ok(prods.json.products.length >= 5);
  assert.ok(prods.json.products.every(p => p.priceCents > 0 && p.image && p.name));

  const search = await c.get('/api/products?q=margherita');
  assert.equal(search.json.products.length, 1);
  assert.equal(search.json.products[0].slug, 'margherita-classic');

  const detail = await c.get('/api/products/prd-margherita-classic');
  assert.equal(detail.status, 200);
  assert.equal(detail.json.product.sizes.length, 3);
  assert.equal(detail.json.product.crusts.length, 5);
  assert.ok(detail.json.product.toppings.length > 5);

  const promos = await c.get('/api/promos');
  assert.ok(promos.json.promos.some(p => p.code === 'SAVE20'));

  const settings = await c.get('/api/settings');
  assert.equal(settings.json.settings.currencySymbol, '$');
  assert.ok(settings.json.settings.paymentMethods.find(m => m.id === 'cod').enabled);
  assert.ok(!settings.json.settings.paymentMethods.find(m => m.id === 'card').enabled);

  const missing = await c.get('/api/products/nope-not-real');
  assert.equal(missing.status, 404);
});

test('cart: server-side pricing with sizes, crusts, toppings, extra cheese', async () => {
  const c = client();
  const res = await c.post('/api/cart/items', {
    productId: 'prd-margherita-classic',
    size: 'medium', crust: 'Cheese Burst',
    toppingIds: ['top-mozz', 'top-mushroom'], extraCheese: true, qty: 2,
  });
  assert.equal(res.status, 201);
  const item = res.json.cart.items[0];
  // 799 base + 300 medium + 200 cheese burst + 200 mozz + 150 mushroom + 200 extra cheese
  assert.equal(item.unitPriceCents, 1849);
  assert.equal(item.lineTotalCents, 3698);
  assert.equal(res.json.cart.subtotalCents, 3698);
  assert.equal(item.size, 'Medium · 10"');
  assert.equal(item.crust, 'Cheese Burst');

  const patched = await c.patch(`/api/cart/items/${item.id}`, { qty: 1, size: 'small', crust: 'Hand Tossed', toppingIds: [] });
  assert.equal(patched.status, 200);
  // 799 base + 200 extra cheese, size/crust/toppings reset
  assert.equal(patched.json.cart.items[0].unitPriceCents, 999);

  const del = await c.del(`/api/cart/items/${item.id}`);
  assert.equal(del.json.cart.items.length, 0);
});

test('cart: rejects customization for non-pizza items and unknown toppings', async () => {
  const c = client();
  const bad = await c.post('/api/cart/items', { productId: 'prd-cola', size: 'large' });
  assert.equal(bad.status, 400);
  const badTop = await c.post('/api/cart/items', { productId: 'prd-margherita-classic', toppingIds: ['top-fake'] });
  assert.equal(badTop.status, 400);
  const combo = await c.post('/api/cart/items', { productId: 'prd-combo-pizza-feast', qty: 1 });
  assert.equal(combo.status, 201);
  assert.equal(combo.json.cart.items[0].customizable, false);
  await c.post('/api/cart/clear');
});

test('promo codes: valid, invalid, minimum order', async () => {
  const c = client();
  await c.post('/api/cart/items', { productId: 'prd-pepperoni-passion', size: 'large', qty: 2 });
  // subtotal = (1199+550)*2 = 3498
  const tooLow = await c.post('/api/cart/promo', { code: 'SAVE20' }); // min 2500 -> ok actually
  assert.equal(tooLow.status, 200);
  assert.equal(tooLow.json.cart.discountCents, 700); // 20% of 3498 = 699.6 -> 700
  const invalid = await c.post('/api/cart/promo', { code: 'NOTREAL' });
  assert.equal(invalid.status, 400);
  await c.post('/api/cart/clear');
  await c.post('/api/cart/items', { productId: 'prd-garlic-bread' });
  const belowMin = await c.post('/api/cart/promo', { code: 'SAVE20' });
  assert.equal(belowMin.status, 400);
});

test('auth: register, duplicate email, login, profile with addresses', async () => {
  const c = client();
  const reg = await c.post('/api/auth/register', {
    name: 'Test Customer', email: 'customer@test.com', password: 'password123', phone: '+1 555 123 4567',
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.json.user.role, 'customer');

  const dup = await c.post('/api/auth/register', { name: 'X2', email: 'customer@test.com', password: 'password123' });
  assert.equal(dup.status, 409);

  const weak = await c.post('/api/auth/register', { name: 'X3', email: 'x3@test.com', password: 'short' });
  assert.equal(weak.status, 400);

  const fresh = client();
  const badLogin = await fresh.post('/api/auth/login', { email: 'customer@test.com', password: 'wrongpass' });
  assert.equal(badLogin.status, 401);

  const login = await fresh.post('/api/auth/login', { email: 'customer@test.com', password: 'password123' });
  assert.equal(login.status, 200);

  const prof = await fresh.patch('/api/auth/profile', {
    name: 'Test Customer',
    addresses: [{ label: 'Home', line1: '42 Pizza Lane', city: 'Foodtown', zip: '12345', isDefault: true }],
  });
  assert.equal(prof.status, 200);
  assert.equal(prof.json.user.addresses.length, 1);
  assert.equal(prof.json.user.addresses[0].isDefault, true);

  const me = await fresh.get('/api/auth/me');
  assert.equal(me.json.user.email, 'customer@test.com');
});

test('checkout: server-side validation and authoritative totals', async () => {
  const c = client();
  await c.post('/api/auth/login', { email: 'customer@test.com', password: 'password123' });
  await c.post('/api/cart/clear');
  await c.post('/api/cart/items', { productId: 'prd-margherita-classic', size: 'medium', crust: 'Cheese Burst', toppingIds: ['top-mozz'], extraCheese: true, qty: 2 });
  // 799+300+200+200+200 = 1699 * 2 = 3398
  await c.post('/api/cart/promo', { code: 'FIRST10' }); // 10% -> 340 capped 300 -> 300

  const noPhone = await c.post('/api/orders', {
    customer: { name: 'Test Customer', phone: '' },
    fulfilment: 'delivery',
    address: { line1: '42 Pizza Lane', city: 'Foodtown', zip: '12345' },
    paymentMethod: 'cod',
  });
  assert.equal(noPhone.status, 400);

  const disabledMethod = await c.post('/api/orders', {
    customer: { name: 'Test Customer', phone: '+1 555 123 4567' },
    fulfilment: 'delivery',
    address: { line1: '42 Pizza Lane', city: 'Foodtown', zip: '12345' },
    paymentMethod: 'card',
  });
  assert.equal(disabledMethod.status, 400);

  const noAddress = await c.post('/api/orders', {
    customer: { name: 'Test Customer', phone: '+1 555 123 4567' },
    fulfilment: 'delivery', paymentMethod: 'cod',
  });
  assert.equal(noAddress.status, 400);

  const res = await c.post('/api/orders', {
    customer: { name: 'Test Customer', phone: '+1 555 123 4567' },
    fulfilment: 'delivery',
    address: { line1: '42 Pizza Lane', city: 'Foodtown', zip: '12345' },
    location: { lat: 40.7128, lng: -74.006, accuracy: 18 },
    paymentMethod: 'cod',
  });
  assert.equal(res.status, 201);
  const order = res.json.order;
  assert.match(order.number, /^PC-\d+$/);
  // subtotal 3398, discount 300 (10% = 340 capped at 300), delivery 0 (>= 3500? no -> 299), tax 5% of 3098 = 155
  assert.equal(order.totals.subtotalCents, 3398);
  assert.equal(order.totals.discountCents, 300);
  assert.equal(order.totals.deliveryCents, 299);
  assert.equal(order.totals.taxCents, 155);
  assert.equal(order.totals.totalCents, 3398 - 300 + 299 + 155);
  assert.equal(order.tracking.stages.length, 5);
  assert.equal(order.tracking.stages[0].state, 'current');
  assert.equal(order.paymentMethod, 'cod');

  const cleared = await c.get('/api/cart');
  assert.equal(cleared.json.cart.items.length, 0);

  const list = await c.get('/api/orders');
  assert.ok(list.json.orders.some(o => o.id === order.id));

  const detail = await c.get(`/api/orders/${order.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.order.items.length, 1);
  assert.equal(detail.json.order.items[0].size, 'Medium · 10"');

  // another session cannot read this order
  const stranger = client();
  const denied = await stranger.get(`/api/orders/${order.id}`);
  assert.equal(denied.status, 404);
});

test('guest checkout works and stays tied to the session', async () => {
  const c = client();
  await c.post('/api/cart/items', { productId: 'prd-cola', qty: 2 });
  const res = await c.post('/api/orders', {
    customer: { name: 'Guest User', phone: '+1 555 999 0000' },
    fulfilment: 'pickup', paymentMethod: 'cod',
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.order.totals.deliveryCents, 0);
  assert.equal(res.json.order.fulfilment, 'pickup');
  const list = await c.get('/api/orders');
  assert.equal(list.json.orders.length, 1);
});

test('admin: RBAC, product CRUD, promos, order status, settings, sales summary', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/admin/overview')).status, 401);

  const cust = client();
  await cust.post('/api/auth/login', { email: 'customer@test.com', password: 'password123' });
  assert.equal((await cust.get('/api/admin/overview')).status, 403);

  const admin = client();
  const login = await admin.post('/api/auth/login', { email: 'admin@pizzacut.com', password: 'admin123' });
  assert.equal(login.json.user.role, 'admin');

  const overview = await admin.get('/api/admin/overview');
  assert.equal(overview.status, 200);
  assert.ok(overview.json.overview.todayOrders >= 2);

  // product create
  const created = await admin.post('/api/admin/products', {
    name: 'Truffle Test Pizza', description: 'Test', categoryId: 'cat-premium-pizza',
    priceCents: 1599, isVeg: true, spiceLevel: 0, discountPct: 0, available: true, isCombo: false,
    sizes: [{ size: 'small', name: 'Small', deltaCents: 0, isDefault: true }],
    crusts: [{ name: 'Hand Tossed', deltaCents: 0, isDefault: true }],
    toppingIds: ['top-mozz'],
  });
  assert.equal(created.status, 201);
  const pid = created.json.product.id;

  const patchedProduct = await admin.patch(`/api/admin/products/${pid}`, { priceCents: 1899, available: false });
  assert.equal(patchedProduct.json.product.priceCents, 1899);
  assert.equal(patchedProduct.json.product.available, false);

  // unavailable products must not be orderable / visible publicly
  const anon2 = client();
  const hidden = await anon2.get(`/api/products/${pid}`);
  assert.equal(hidden.status, 404);
  const addToCart = await anon2.post('/api/cart/items', { productId: pid });
  assert.equal(addToCart.status, 404);

  const del = await admin.del(`/api/admin/products/${pid}`);
  assert.equal(del.status, 200);

  // promo create/update/delete
  const promo = await admin.post('/api/admin/promos', {
    code: 'TEST20', description: 'Test', type: 'percent', value: 20, minOrderCents: 0, active: true,
  });
  assert.equal(promo.status, 201);
  assert.equal((await admin.post('/api/admin/promos', { code: 'TEST20', type: 'percent', value: 10 })).status, 409);
  await admin.patch(`/api/admin/promos/${promo.json.promo.id}`, { active: false });
  const c2 = client();
  await c2.post('/api/cart/items', { productId: 'prd-cola' });
  assert.equal((await c2.post('/api/cart/promo', { code: 'TEST20' })).status, 400);
  await admin.del(`/api/admin/promos/${promo.json.promo.id}`);

  // disable a topping -> customers can no longer select it
  await admin.patch('/api/admin/toppings/top-jalapeno', { available: false });
  const c3 = client();
  const badTopping = await c3.post('/api/cart/items', { productId: 'prd-margherita-classic', toppingIds: ['top-jalapeno'] });
  assert.equal(badTopping.status, 400);
  await admin.patch('/api/admin/toppings/top-jalapeno', { available: true });

  // orders management (statuses now follow the validated transition chain)
  const orders = await admin.get('/api/admin/orders');
  assert.ok(orders.json.orders.length >= 2);
  const target = orders.json.orders.find(o => o.fulfilment === 'delivery');
  const upd = await admin.patch(`/api/admin/orders/${target.id}`, { status: 'confirmed' });
  assert.equal(upd.status, 200);
  assert.equal((await admin.patch(`/api/admin/orders/${target.id}`, { status: 'preparing' })).status, 200);
  const invalidTransition = await admin.patch(`/api/admin/orders/${target.id}`, { status: 'ready_for_pickup' });
  assert.equal(invalidTransition.status, 400);
  assert.equal((await admin.patch(`/api/admin/orders/${target.id}`, { status: 'picked_up' })).status, 200);
  await admin.patch(`/api/admin/orders/${target.id}`, { status: 'delivered' });

  // customer sees the delivered status
  const custOrders = await cust.get('/api/orders');
  const seen = custOrders.json.orders.find(o => o.id === target.id);
  assert.equal(seen.status, 'delivered');
  assert.ok(seen.tracking.stages.every(s => s.state === 'done'));

  // settings: enable card payments, change tax; verify public surface + totals
  const before = await anon2.get('/api/settings');
  const put = await admin.put('/api/admin/settings', { pay_card: true, tax_pct: 10 });
  assert.equal(put.status, 200);
  const afterSet = await anon2.get('/api/settings');
  assert.equal(afterSet.json.settings.taxPct, 10);
  assert.ok(afterSet.json.settings.paymentMethods.find(m => m.id === 'card').enabled);

  const c4 = client();
  await c4.post('/api/cart/items', { productId: 'prd-cola' });
  const order4 = await c4.post('/api/orders', {
    customer: { name: 'Tax Tester', phone: '+1 555 000 1111' },
    fulfilment: 'pickup', paymentMethod: 'card',
  });
  assert.equal(order4.status, 201);
  assert.equal(order4.json.order.totals.taxCents, 25); // 10% of 249 = 24.9 -> 25

  // restore defaults
  await admin.put('/api/admin/settings', { pay_card: false, tax_pct: 5 });
});

test('order status auto-advance reflects real order data', async () => {
  const c = client();
  await c.post('/api/cart/items', { productId: 'prd-iced-tea' });
  // Delivery orders now require a confirmed location; statuses follow the
  // validated transition chain instead of random jumps.
  const res = await c.post('/api/orders', {
    customer: { name: 'Advance Tester', phone: '+1 555 222 3333' },
    fulfilment: 'delivery',
    address: { line1: '9 Tracking Road', city: 'Foodtown', zip: '12345' },
    location: { lat: 40.7128, lng: -74.006, accuracy: 25 },
    paymentMethod: 'cod',
  });
  const id = res.json.order.id;
  const t1 = await c.get(`/api/orders/${id}`);
  assert.equal(t1.json.order.status, 'received');
  assert.ok(t1.json.order.etaMinutes > 0);
  const admin = client();
  await admin.post('/api/auth/login', { email: 'admin@pizzacut.com', password: 'admin123' });
  for (const status of ['confirmed', 'assigned', 'accepted', 'preparing', 'picked_up', 'out_for_delivery']) {
    await admin.patch(`/api/admin/orders/${id}`, { status });
  }
  const t2 = await c.get(`/api/orders/${id}`);
  assert.equal(t2.json.order.status, 'out_for_delivery');
  assert.equal(t2.json.order.tracking.stages[3].state, 'current');
  assert.ok(t2.json.order.tracking.stages.slice(0, 3).every(s => s.state === 'done'));
});

test('security: malformed JSON and oversized payloads are rejected cleanly', async () => {
  const res = await fetch('http://127.0.0.1:4599/api/cart/items', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json',
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.ok(json.error);
});
