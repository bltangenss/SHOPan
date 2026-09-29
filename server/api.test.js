import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { randomUUID, scryptSync } from 'node:crypto';
import { createStore } from './store.js';
import { createApiHandler } from './api.js';

const db = createStore(':memory:');
const server = createServer(createApiHandler(db));
let base;
before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); db.close(); });

async function request(path, method = 'GET', body, headers = {}) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

const customer = { name: 'Тестовый покупатель', email: 'buyer@example.test', phone: '+77001234567' };
const orderBody = (sku, quantity = 1) => ({
  idempotencyKey: randomUUID(), customer, fulfillment: 'pickup_arranged',
  items: [{ sku, quantity }], price: 1, total: 1,
});

test('catalog exposes products and variants; server calculates the amount', async () => {
  const catalog = await request('/api/catalog');
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.products.length, 9);
  const item = catalog.body.products.find((product) => product.id === 'tee-milk');
  assert.equal(item.variants.length, 6);
  const body = orderBody('tee-milk-M', 2);
  const placed = await request('/api/orders', 'POST', body);
  assert.equal(placed.status, 201);
  assert.equal(placed.body.total, 15800);
  assert.equal(placed.body.items[0].unit_price, 7900);
  const repeated = await request('/api/orders', 'POST', body);
  assert.equal(repeated.body.id, placed.body.id);
  assert.equal((await request('/api/orders', 'POST', { ...body, items: [{ sku: 'tee-milk-M', quantity: 1 }] })).status, 409);
  const read = await request(`/api/orders/${placed.body.id}`, 'GET', undefined,
    { 'X-Receipt-Token': placed.body.receiptToken });
  assert.equal(read.status, 200);
  assert.equal((await request(`/api/orders/${placed.body.id}`)).status, 403);
});

test('last unit cannot be oversold and cancellation restores stock once', async () => {
  const [first, second] = await Promise.all([
    request('/api/orders', 'POST', orderBody('dress-muslin-XS')),
    request('/api/orders', 'POST', orderBody('dress-muslin-XS')),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  const winner = first.status === 201 ? first : second;
  const headers = { 'X-Receipt-Token': winner.body.receiptToken };
  const cancel = await request(`/api/orders/${winner.body.id}/cancel`, 'POST', {}, headers);
  assert.equal(cancel.body.order.fulfillment_status, 'cancelled');
  assert.equal((await request(`/api/orders/${winner.body.id}/cancel`, 'POST', {}, headers)).status, 409);
  const next = await request('/api/orders', 'POST', orderBody('dress-muslin-XS'));
  assert.equal(next.status, 201);
});

test('declined test payment does not reserve inventory', async () => {
  const before = (await request('/api/catalog')).body.products.find((item) => item.id === 'tee-ink')
    .variants.find((variant) => variant.size === 'XS').stock;
  const body = { ...orderBody('tee-ink-XS'), paymentScenario: 'decline' };
  assert.equal((await request('/api/orders', 'POST', body)).status, 402);
  const after = (await request('/api/catalog')).body.products.find((item) => item.id === 'tee-ink')
    .variants.find((variant) => variant.size === 'XS').stock;
  assert.equal(after, before);
});

test('body profile is private and removable; customer cannot access admin routes', async () => {
  const registered = await request('/api/auth/register', 'POST', {
    name: 'Клиент', email: 'client@example.test', password: 'strong-password-123',
  });
  assert.equal(registered.status, 201);
  const cookie = registered.cookie;
  const profile = { measurements: { height: 168, chest: 92, waist: 74, hips: 98, shoulder: 40 },
    gender: 'female', skinTone: '#E4C6A8', hairColor: '#3B2A1E' };
  assert.equal((await request('/api/me/body', 'PUT', profile, { Cookie: cookie })).body.profile.version, 1);
  assert.equal((await request('/api/me/body', 'PUT', {
    ...profile, measurements: { ...profile.measurements, chest: 96 },
  }, { Cookie: cookie })).body.profile.version, 2);
  assert.deepEqual((await request('/api/me/body/history', 'GET', undefined,
    { Cookie: cookie })).body.versions.map((row) => row.version), [2, 1]);
  const savedOutfit = await request('/api/me/outfits', 'POST', {
    name: 'Повседневный образ', sku: 'tee-milk-M',
    selection: { top: 'tee-milk', bottom: 'trousers-charcoal', dress: null },
  }, { Cookie: cookie });
  assert.equal(savedOutfit.status, 201);
  assert.equal((await request('/api/me/body', 'GET', undefined, { Cookie: cookie })).body.profile.measurements.chest, 96);
  assert.equal((await request('/api/me/body')).status, 401);
  assert.equal((await request('/api/admin/products', 'GET', undefined, { Cookie: cookie })).status, 403);
  const other = await request('/api/auth/register', 'POST', {
    name: 'Другой клиент', email: 'other@example.test', password: 'another-strong-password',
  });
  assert.equal((await request('/api/me/body', 'GET', undefined, { Cookie: other.cookie })).body.profile, null);
  assert.equal((await request('/api/me/outfits', 'GET', undefined, { Cookie: other.cookie })).body.outfits.length, 0);
  assert.equal((await request(`/api/me/outfits/${savedOutfit.body.outfit.id}`, 'DELETE', {}, { Cookie: other.cookie })).status, 404);
  assert.equal((await request('/api/me/body', 'DELETE', {}, { Cookie: cookie })).status, 200);
  assert.equal((await request('/api/me/body', 'GET', undefined, { Cookie: cookie })).body.profile, null);
  assert.equal((await request('/api/me/body/history', 'GET', undefined, { Cookie: cookie })).body.versions.length, 0);
  assert.equal((await request('/api/me/outfits', 'GET', undefined, { Cookie: cookie })).body.outfits.length, 0);
});

test('admin can manage products and variants; ordinary users cannot', async () => {
  const salt = 'test-salt';
  const password = 'test-admin-password';
  db.prepare(`INSERT INTO users(id, email, name, password_hash, salt, role)
    VALUES (?, ?, ?, ?, ?, 'admin')`)
    .run(randomUUID(), 'admin@example.test', 'Admin', scryptSync(password, salt, 64).toString('hex'), salt);
  const login = await request('/api/auth/login', 'POST', { email: 'admin@example.test', password });
  assert.equal(login.status, 200);
  const headers = { Cookie: login.cookie };
  const created = await request('/api/admin/products', 'POST', {
    id: 'test-tee', name: 'Тестовая футболка', category: 'top', piece: 'tee',
    audience: 'unisex', price: 4200, description: 'Тест', fabric: 'Хлопок',
  }, headers);
  assert.equal(created.status, 201);
  assert.equal((await request('/api/admin/variants', 'POST', {
    sku: 'test-tee-M', productId: 'test-tee', size: 'M', color: '#123456',
    colorName: 'Синий', stock: 2,
  }, headers)).status, 201);
  assert.equal((await request('/api/admin/products/test-tee', 'PATCH', { price: 4700 }, headers)).body.product.price, 4700);
  assert.equal((await request('/api/catalog')).body.products.find((item) => item.id === 'test-tee').variants[0].stock, 2);
  assert.equal((await request('/api/admin/variants/test-tee-M', 'PATCH', { stock: 1 }, headers)).status, 200);
  assert.equal((await request('/api/admin/products/test-tee', 'PATCH', { active: false }, headers)).status, 200);
  assert.equal((await request('/api/catalog')).body.products.some((item) => item.id === 'test-tee'), false);
});
