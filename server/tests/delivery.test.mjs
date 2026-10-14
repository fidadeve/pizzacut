import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, client } from './helpers.mjs';

let server;

before(async () => { server = await startServer(); });
after(() => { server.child.kill(); });

test('rider delivery lifecycle: create rider, place delivery order, assign, accept, deliver', async () => {
  const admin = client();
  await admin.post('/api/auth/login', { email: 'admin@pizzacut.com', password: 'admin123' });

  // --- Admin creates the rider (only admins may do this) ---
  const created = await admin.post('/api/admin/riders', {
    name: 'Fida Rider', username: 'fida', password: 'rider-secret-1',
    phone: '+1 555 900 1111', vehicle: 'Bike / Honda CD70',
  });
  assert.equal(created.status, 201);
  const rider = created.json.rider;
  assert.equal(rider.status, 'active');
  assert.equal(rider.availability, 'offline');

  // duplicate login ID is rejected
  const dup = await admin.post('/api/admin/riders', {
    name: 'Second Rider', username: 'fida', password: 'rider-secret-2', phone: '+1 555 900 2222',
  });
  assert.equal(dup.status, 409);

  // --- Customer places a delivery order with confirmed location ---
  const cust = client();
  await cust.post('/api/cart/items', { productId: 'prd-margherita-classic', qty: 1 });
  const orderRes = await cust.post('/api/orders', {
    customer: { name: 'Delivery Customer', phone: '+1 555 333 4444' },
    fulfilment: 'delivery',
    address: { line1: '7 Rider Street', city: 'Foodtown', zip: '12345' },
    location: { lat: 34.0151, lng: 71.5249, accuracy: 12 },
    paymentMethod: 'cod',
  });
  assert.equal(orderRes.status, 201);
  const order = orderRes.json.order;
  assert.equal(order.deliveryLocation.lat, 34.0151);
  assert.equal(order.deliveryLocation.riderInfoVisible, undefined); // customer payload has no rider yet
  assert.ok(order.deliveryLocation.lat === 34.0151);

  // delivery order without location is rejected
  const noLoc = await cust.post('/api/orders', {
    customer: { name: 'Delivery Customer', phone: '+1 555 333 4444' },
    fulfilment: 'delivery',
    address: { line1: '7 Rider Street', city: 'Foodtown', zip: '12345' },
    paymentMethod: 'cod',
  });
  assert.equal(noLoc.status, 400);

  // --- Admin sees the order and assigns the rider ---
  const ops = await admin.get('/api/admin/delivery/ops');
  assert.equal(ops.status, 200);
  const opsOrder = ops.json.orders.find(o => o.id === order.id);
  assert.ok(opsOrder, 'order appears in delivery ops');
  assert.equal(opsOrder.hasLocation, true);

  const assigned = await admin.patch(`/api/admin/orders/${order.id}/assign`, { riderId: rider.id });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.json.status, 'assigned');

  // reassigning the same rider is blocked cleanly
  const reassign = await admin.patch(`/api/admin/orders/${order.id}/assign`, { riderId: rider.id });
  assert.equal(reassign.status, 409);

  // --- Rider portal login (admin-issued credentials) ---
  const rc = client();
  const login = await rc.post('/api/rider/login', { username: 'fida', password: 'rider-secret-1' });
  assert.equal(login.status, 200);
  assert.equal(login.json.rider.username, 'fida');

  const badLogin = await client().post('/api/rider/login', { username: 'fida', password: 'wrong-pass' });
  assert.equal(badLogin.status, 401);

  // rider sees the assigned order with full location data
  const mine = await rc.get(`/api/rider/orders/${order.id}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.json.order.deliveryLocation.lat, 34.0151);
  assert.equal(mine.json.order.customer.phone, '+1 555 333 4444');

  // --- Accept → pick up → out for delivery → delivered ---
  assert.equal((await rc.post(`/api/rider/orders/${order.id}/accept`)).json.status, 'accepted');
  // picked up before kitchen hands over is fine from accepted
  assert.equal((await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'picked_up' })).json.status, 'picked_up');
  assert.equal((await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'out_for_delivery' })).json.status, 'out_for_delivery');

  // rider location ping is recorded while a delivery is active
  const ping = await rc.post('/api/rider/location', { lat: 34.02, lng: 71.53, accuracy: 9 });
  assert.equal(ping.json.recorded, true);

  // --- Real-time "Your Rider" feed: the customer sees the live position ---
  const live = await cust.get(`/api/orders/${order.id}/rider-location`);
  assert.equal(live.status, 200);
  assert.equal(live.json.active, true);
  assert.equal(live.json.location.lat, 34.02);
  assert.equal(live.json.location.lng, 71.53);
  assert.equal(live.json.rider.username, 'fida');

  // admin sees the same live feed plus the customer pin
  const adminLive = await admin.get(`/api/admin/orders/${order.id}/location`);
  assert.equal(adminLive.status, 200);
  assert.equal(adminLive.json.location.lat, 34.02);
  assert.equal(adminLive.json.customer.lat, 34.0151);

  // another signed-in customer cannot read someone else's rider location
  const stranger = client();
  await stranger.post('/api/auth/register', { email: 'stranger-live@test.com', name: 'Stranger', password: 'password123' });
  await stranger.post('/api/auth/login', { email: 'stranger-live@test.com', password: 'password123' });
  assert.equal((await stranger.get(`/api/orders/${order.id}/rider-location`)).status, 404);
  // anonymous → 404 too (ownership required, no information leaked)
  assert.equal((await fetch(`http://127.0.0.1:4599/api/orders/${order.id}/rider-location`)).status, 404);
  // admin location endpoint requires admin
  assert.equal((await fetch(`http://127.0.0.1:4599/api/admin/orders/${order.id}/location`)).status, 401);

  // delivery_failed requires a reason
  const failNoNote = await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'delivery_failed' });
  assert.equal(failNoNote.status, 400);
  const failed = await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'delivery_failed', note: 'Customer gate locked' });
  assert.equal(failed.json.status, 'delivery_failed');
  // retry (admin-driven reality: rider resumes)
  const resumed = await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'out_for_delivery' });
  assert.equal(resumed.json.status, 'out_for_delivery');
  const delivered = await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'delivered', note: 'Handed over at door' });
  assert.equal(delivered.json.status, 'delivered');

  // closed order → the live feed turns off (no stale rider tracking)
  const afterDone = await cust.get(`/api/orders/${order.id}/rider-location`);
  assert.equal(afterDone.json.active, false);
  assert.equal(afterDone.json.location, null);
  assert.equal(afterDone.json.rider, null);

  // duplicate delivered is blocked
  const dupDelivered = await rc.post(`/api/rider/orders/${order.id}/status`, { status: 'delivered' });
  assert.equal(dupDelivered.status, 400);

  // --- Admin sees the audit trail ---
  const full = await admin.get(`/api/admin/orders/${order.id}/full`);
  assert.equal(full.status, 200);
  const kinds = full.json.history.map(h => h.kind);
  assert.ok(kinds.includes('assignment'));
  assert.ok(full.json.history.some(h => h.to === 'delivered' && h.actorRole === 'rider'));
  assert.ok(full.json.assignments.length >= 1);
  assert.equal(full.json.order.rider?.username, 'fida');

  // --- Issue reporting + admin visibility ---
  await cust.post('/api/cart/items', { productId: 'prd-margherita-classic', qty: 1 });
  const order2 = (await cust.post('/api/orders', {
    customer: { name: 'Delivery Customer', phone: '+1 555 333 4444' },
    fulfilment: 'delivery',
    address: { line1: '7 Rider Street', city: 'Foodtown', zip: '12345' },
    location: { lat: 34.0151, lng: 71.5249 },
    paymentMethod: 'cod',
  })).json.order;
  await admin.patch(`/api/admin/orders/${order2.id}`, { status: 'confirmed' });
  await admin.patch(`/api/admin/orders/${order2.id}/assign`, { riderId: rider.id });
  const issue = await rc.post(`/api/rider/orders/${order2.id}/issue`, { reason: 'Address seems wrong on map' });
  assert.equal(issue.status, 200);
  const issueAdmin = await admin.get(`/api/admin/orders/${order2.id}/full`);
  assert.ok(issueAdmin.json.history.some(h => h.kind === 'issue'));

  // --- Authorization: customers can't touch admin rider APIs ---
  const custLogin = client();
  await custLogin.post('/api/auth/register', { email: 'delivery-cust@test.com', name: 'Cust Guard', password: 'password123' });
  await custLogin.post('/api/auth/login', { email: 'delivery-cust@test.com', password: 'password123' });
  const custBlocked = await custLogin.get('/api/admin/riders');
  assert.equal(custBlocked.status, 403);
  const anon = await fetch(`${'http://127.0.0.1:4599'}/api/admin/riders`);
  assert.equal(anon.status, 401);

  // rider availability + dashboard counters
  const dash = await rc.get('/api/rider/dashboard');
  assert.equal(dash.json.counts.deliveredToday, 1);
  const avail = await rc.patch('/api/rider/availability', { online: true });
  assert.equal(avail.json.availability, 'online');

  // after delivered, location is no longer recorded (no active delivery)
  const idlePing = await rc.post('/api/rider/location', { lat: 34.05, lng: 71.54 });
  assert.equal(idlePing.json.recorded, false);

  // --- Suspend rider → portal access revoked ---
  await admin.patch(`/api/admin/riders/${rider.id}`, { status: 'suspended' });
  const blockedDash = await rc.get('/api/rider/dashboard');
  assert.equal(blockedDash.status, 403);
  const reLogin = await client().post('/api/rider/login', { username: 'fida', password: 'rider-secret-1' });
  assert.equal(reLogin.status, 403);

  // reset credentials + reactivate
  await admin.patch(`/api/admin/riders/${rider.id}`, { status: 'active', password: 'rider-secret-new' });
  const reLogin2 = await client().post('/api/rider/login', { username: 'fida', password: 'rider-secret-new' });
  assert.equal(reLogin2.status, 200);
});
