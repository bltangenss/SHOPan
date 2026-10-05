import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { getOrder, listProducts, transaction } from './store.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const digest = (value) => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { throw new HttpError(status, message); };
const validEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 65_536) fail(413, 'Слишком большой запрос');
  }
  try { return JSON.parse(body || '{}'); } catch { return fail(400, 'Некорректный JSON'); }
}

function sessionUser(db, req) {
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('sid='));
  if (!cookie) return null;
  const token = cookie.slice(4);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare(`SELECT users.id, users.email, users.name, users.role FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .get(digest(token), Date.now()) || null;
}

function requireUser(db, req, admin = false) {
  const user = sessionUser(db, req);
  if (!user) fail(401, 'Войдите в аккаунт');
  if (admin && user.role !== 'admin') fail(403, 'Недостаточно прав');
  return user;
}

function issueSession(db, req, res, user) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(digest(token), user.id, Date.now() + 30 * 86_400_000);
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${req.socket.encrypted ? '; Secure' : ''}`);
}

function orderAccess(db, req, id) {
  const order = getOrder(db, id);
  if (!order) fail(404, 'Заказ не найден');
  const user = sessionUser(db, req);
  if (user?.role === 'admin' || (user && order.user_id === user.id)) return order;
  const receipt = req.headers['x-receipt-token'];
  if (typeof receipt === 'string' && digest(receipt) === order.receipt_hash) return order;
  fail(403, 'Нет доступа к заказу');
}

function publicOrder(order) {
  const { receipt_hash, payload_hash, idempotency_key, user_id, ...rest } = order;
  return rest;
}

function createOrder(db, body, user) {
  const idempotencyKey = clean(body.idempotencyKey, 100);
  if (!/^[a-zA-Z0-9-]{20,100}$/.test(idempotencyKey)) fail(400, 'Некорректный ключ оформления');
  const customer = body.customer || {};
  const name = clean(customer.name, 100);
  const email = clean(customer.email, 254).toLowerCase();
  const phone = clean(customer.phone, 40);
  if (name.length < 2 || !validEmail(email) || !/^\+?[0-9 ()-]{9,40}$/.test(phone)) {
    fail(400, 'Проверьте имя, почту и телефон');
  }
  if (body.fulfillment !== 'pickup_arranged') fail(400, 'Недоступный способ получения');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    fail(400, 'Корзина пуста или слишком велика');
  }
  const items = body.items.map(({ sku, quantity }) => ({ sku: clean(sku, 100), quantity: Number(quantity) }));
  if (items.some(({ sku, quantity }) => !sku || !Number.isInteger(quantity) || quantity < 1 || quantity > 20)) {
    fail(400, 'Некорректный состав корзины');
  }
  if (new Set(items.map((item) => item.sku)).size !== items.length) fail(400, 'Повторяющиеся SKU');
  items.sort((a, b) => a.sku.localeCompare(b.sku));
  const payloadHash = digest(JSON.stringify({ items, name, email, phone, fulfillment: body.fulfillment }));
  const receiptSecret = db.prepare("SELECT value FROM settings WHERE key = 'receipt_secret'").get().value;
  const receiptToken = createHmac('sha256', receiptSecret).update(idempotencyKey).digest('hex');

  return transaction(db, () => {
    const old = db.prepare('SELECT id, payload_hash FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
    if (old) {
      if (old.payload_hash !== payloadHash) fail(409, 'Ключ оформления уже использован для другого заказа');
      return { ...publicOrder(getOrder(db, old.id)), receiptToken };
    }
    const resolved = items.map((item) => {
      const row = db.prepare(`SELECT variants.*, products.name, products.price, products.active AS product_active
        FROM variants JOIN products ON products.id = variants.product_id WHERE variants.sku = ?`).get(item.sku);
      if (!row || !row.active || !row.product_active) fail(409, `Вариант ${item.sku} больше недоступен`);
      if (row.stock < item.quantity) fail(409, `Недостаточно товара ${row.name}, ${row.size}`);
      return { ...row, quantity: item.quantity };
    });
    const subtotal = resolved.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const id = randomUUID();
    db.prepare(`INSERT INTO orders
      (id, user_id, receipt_hash, idempotency_key, payload_hash, customer_name,
       customer_email, customer_phone, fulfillment, address, delivery_cost,
       subtotal, total, payment_status, fulfillment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pickup_arranged', '', 0, ?, ?, 'test_confirmed', 'new')`)
      .run(id, user?.id || null, digest(receiptToken), idempotencyKey, payloadHash,
        name, email, phone, subtotal, subtotal);
    const addItem = db.prepare(`INSERT INTO order_items
      (order_id, sku, product_id, name, size, color, unit_price, quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const reduceStock = db.prepare('UPDATE variants SET stock = stock - ? WHERE sku = ? AND stock >= ?');
    for (const item of resolved) {
      if (reduceStock.run(item.quantity, item.sku, item.quantity).changes !== 1) {
        fail(409, `Остаток ${item.sku} изменился`);
      }
      addItem.run(id, item.sku, item.product_id, item.name, item.size, item.color,
        item.price, item.quantity);
    }
    return { ...publicOrder(getOrder(db, id)), receiptToken };
  });
}

function validateBodyProfile(body) {
  const ranges = { height: [140, 210], chest: [70, 140], waist: [55, 130], hips: [70, 150], shoulder: [32, 55] };
  const measurements = {};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = Number(body.measurements?.[key]);
    if (!Number.isFinite(value) || value < min || value > max) fail(400, `Проверьте мерку: ${key}`);
    measurements[key] = value;
  }
  if (!['female', 'male'].includes(body.gender)) fail(400, 'Некорректная модель тела');
  const skinTone = clean(body.skinTone, 7);
  const hairColor = clean(body.hairColor, 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(skinTone) || !/^#[0-9a-fA-F]{6}$/.test(hairColor)) {
    fail(400, 'Некорректный цвет');
  }
  return { measurements, gender: body.gender, skinTone, hairColor };
}

export function createApiHandler(db) {
  const authAttempts = new Map();
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const path = url.pathname;
    if (!path.startsWith('/api/')) return next?.();
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) fail(403, 'Недопустимый источник запроса');
      }
      if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true, database: 'sqlite' });
      if (req.method === 'GET' && path === '/api/catalog') {
        return send(res, 200, { products: listProducts(db) });
      }
      if (req.method === 'GET' && path === '/api/model-status') {
        return send(res, 200, { version: 'smpl-300-basis-v2',
          status: 'ready', shapeBasis: 'SMPL 1.1.0 shapedirs', shapeComponents: 300,
          measurementDrivenComponents: 10, trainingDataset: 'not_provided',
          fit: 'illustrative', measuredAccuracy: null });
      }
      if (req.method === 'GET' && path === '/api/me') {
        return send(res, 200, { user: sessionUser(db, req) });
      }
      if (req.method === 'POST' && path === '/api/auth/register') {
        const body = await readJson(req);
        const email = clean(body.email, 254).toLowerCase();
        const name = clean(body.name, 100);
        const password = body.password;
        if (!validEmail(email) || name.length < 2 || typeof password !== 'string' || password.length < 8 || password.length > 200) {
          fail(400, 'Укажите имя, почту и пароль от 8 символов');
        }
        if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) fail(409, 'Почта уже зарегистрирована');
        const id = randomUUID();
        const salt = randomBytes(16).toString('hex');
        const hash = scryptSync(password, salt, 64).toString('hex');
        db.prepare('INSERT INTO users(id, email, name, password_hash, salt) VALUES (?, ?, ?, ?, ?)')
          .run(id, email, name, hash, salt);
        const user = { id, email, name, role: 'customer' };
        issueSession(db, req, res, user);
        return send(res, 201, { user });
      }
      if (req.method === 'POST' && path === '/api/auth/login') {
        const ip = req.socket.remoteAddress || 'unknown';
        const attempt = authAttempts.get(ip) || { count: 0, since: Date.now() };
        if (Date.now() - attempt.since > 15 * 60_000) { attempt.count = 0; attempt.since = Date.now(); }
        if (attempt.count >= 20) fail(429, 'Слишком много попыток. Повторите позже');
        const body = await readJson(req);
        const email = clean(body.email, 254).toLowerCase();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        const submitted = typeof body.password === 'string' ? body.password : '';
        const hash = scryptSync(submitted, user?.salt || 'missing-user', 64);
        const correct = user && timingSafeEqual(hash, Buffer.from(user.password_hash, 'hex'));
        if (!correct) {
          attempt.count += 1;
          authAttempts.set(ip, attempt);
          fail(401, 'Неверная почта или пароль');
        }
        authAttempts.delete(ip);
        issueSession(db, req, res, user);
        return send(res, 200, { user: { id: user.id, email: user.email, name: user.name, role: user.role } });
      }
      if (req.method === 'POST' && path === '/api/auth/logout') {
        const cookie = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
        if (cookie) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(cookie[1]));
        res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
        return send(res, 200, { ok: true });
      }
      if (path === '/api/me/body') {
        const user = requireUser(db, req);
        if (req.method === 'GET') {
          const row = db.prepare('SELECT * FROM body_profiles WHERE user_id = ?').get(user.id);
          return send(res, 200, { profile: row ? {
            version: row.version, measurements: JSON.parse(row.measurements_json),
            gender: row.gender, skinTone: row.skin_tone, hairColor: row.hair_color,
            updatedAt: row.updated_at,
          } : null });
        }
        if (req.method === 'PUT') {
          const profile = validateBodyProfile(await readJson(req));
          const version = transaction(db, () => {
            const previous = db.prepare('SELECT version FROM body_profiles WHERE user_id = ?').get(user.id);
            const nextVersion = (previous?.version || 0) + 1;
            db.prepare(`INSERT INTO body_profiles
              (user_id, version, measurements_json, gender, skin_tone, hair_color)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET version = excluded.version,
              measurements_json = excluded.measurements_json, gender = excluded.gender,
              skin_tone = excluded.skin_tone, hair_color = excluded.hair_color,
              updated_at = CURRENT_TIMESTAMP`)
              .run(user.id, nextVersion, JSON.stringify(profile.measurements), profile.gender, profile.skinTone, profile.hairColor);
            db.prepare(`INSERT INTO body_profile_versions
              (user_id, version, measurements_json, gender, skin_tone, hair_color)
              VALUES (?, ?, ?, ?, ?, ?)`)
              .run(user.id, nextVersion, JSON.stringify(profile.measurements), profile.gender, profile.skinTone, profile.hairColor);
            return nextVersion;
          });
          return send(res, 200, { profile: { ...profile, version } });
        }
        if (req.method === 'DELETE') {
          transaction(db, () => {
            db.prepare('DELETE FROM saved_outfits WHERE user_id = ?').run(user.id);
            db.prepare('DELETE FROM body_profile_versions WHERE user_id = ?').run(user.id);
            db.prepare('DELETE FROM body_profiles WHERE user_id = ?').run(user.id);
          });
          return send(res, 200, { ok: true });
        }
      }
      if (req.method === 'GET' && path === '/api/me/body/history') {
        const user = requireUser(db, req);
        const rows = db.prepare(`SELECT version, measurements_json, gender, skin_tone, hair_color, created_at
          FROM body_profile_versions WHERE user_id = ? ORDER BY version DESC LIMIT 20`).all(user.id);
        return send(res, 200, { versions: rows.map((row) => ({ version: row.version,
          measurements: JSON.parse(row.measurements_json), gender: row.gender,
          skinTone: row.skin_tone, hairColor: row.hair_color, createdAt: row.created_at })) });
      }
      if (path === '/api/me/outfits') {
        const user = requireUser(db, req);
        if (req.method === 'GET') {
          const rows = db.prepare('SELECT * FROM saved_outfits WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
          return send(res, 200, { outfits: rows.map((row) => ({ id: row.id, name: row.name,
            selection: JSON.parse(row.selection_json), sku: row.sku,
            profileVersion: row.profile_version, createdAt: row.created_at })) });
        }
        if (req.method === 'POST') {
          const body = await readJson(req);
          const name = clean(body.name, 80);
          const sku = clean(body.sku, 100);
          const selection = Object.fromEntries(['top', 'bottom', 'dress'].map((slot) => [slot,
            typeof body.selection?.[slot] === 'string' ? clean(body.selection[slot], 60) : null]));
          if (!name || !Object.values(selection).some(Boolean)) fail(400, 'Укажите название и вещи образа');
          for (const id of Object.values(selection).filter(Boolean)) {
            if (!db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(id)) fail(400, 'Товар образа недоступен');
          }
          const variant = db.prepare('SELECT product_id FROM variants WHERE sku = ? AND active = 1').get(sku);
          if (!variant || !Object.values(selection).includes(variant.product_id)) fail(400, 'Вариант не относится к образу');
          const storedVersion = db.prepare('SELECT version FROM body_profiles WHERE user_id = ?').get(user.id)?.version || 0;
          const profileVersion = Number(body.profileVersion) === storedVersion ? storedVersion : 0;
          const id = randomUUID();
          db.prepare(`INSERT INTO saved_outfits(id, user_id, name, selection_json, sku, profile_version)
            VALUES (?, ?, ?, ?, ?, ?)`).run(id, user.id, name, JSON.stringify(selection), sku, profileVersion);
          return send(res, 201, { outfit: { id, name, selection, sku, profileVersion } });
        }
      }
      const outfitMatch = path.match(/^\/api\/me\/outfits\/([a-f0-9-]+)$/);
      if (req.method === 'DELETE' && outfitMatch) {
        const user = requireUser(db, req);
        const result = db.prepare('DELETE FROM saved_outfits WHERE id = ? AND user_id = ?').run(outfitMatch[1], user.id);
        if (!result.changes) fail(404, 'Образ не найден');
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/try-on') {
        const body = await readJson(req);
        const variant = db.prepare(`SELECT variants.*, products.piece, products.active AS product_active
          FROM variants JOIN products ON products.id = variants.product_id WHERE sku = ?`).get(clean(body.sku, 100));
        if (!variant || !variant.active || !variant.product_active) fail(404, 'Вариант не найден');
        const profile = validateBodyProfile(body.profile || {});
        return send(res, 200, { requestId: randomUUID(), sku: variant.sku,
          profileVersion: Number(body.profileVersion) || 0, modelVersion: 'smpl-300-basis-v2',
          status: 'ready', assetUrl: `/models/smpl_${profile.gender}_300.glb`,
          garment: variant.piece, fit: 'illustrative',
          limitation: '3D-визуализация показывает силуэт и объём; точная физика ткани не моделируется' });
      }
      if (req.method === 'POST' && path === '/api/orders') {
        const body = await readJson(req);
        if (body.paymentScenario === 'decline') fail(402, 'Тестовая оплата отклонена. Можно повторить');
        return send(res, 201, createOrder(db, body, sessionUser(db, req)));
      }
      if (req.method === 'GET' && path === '/api/me/orders') {
        const user = requireUser(db, req);
        const rows = db.prepare('SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
        return send(res, 200, { orders: rows.map((row) => publicOrder(getOrder(db, row.id))) });
      }
      const orderMatch = path.match(/^\/api\/orders\/([a-f0-9-]+)(\/cancel)?$/);
      if (orderMatch) {
        const order = orderAccess(db, req, orderMatch[1]);
        if (req.method === 'GET' && !orderMatch[2]) return send(res, 200, { order: publicOrder(order) });
        if (req.method === 'POST' && orderMatch[2]) {
          const cancelled = transaction(db, () => {
            const current = getOrder(db, order.id);
            if (current.fulfillment_status !== 'new') fail(409, 'Заказ уже обрабатывается');
            db.prepare("UPDATE orders SET fulfillment_status = 'cancelled', payment_status = 'test_cancelled' WHERE id = ?")
              .run(order.id);
            for (const item of current.items) {
              db.prepare('UPDATE variants SET stock = stock + ? WHERE sku = ?').run(item.quantity, item.sku);
            }
            return publicOrder(getOrder(db, order.id));
          });
          return send(res, 200, { order: cancelled });
        }
      }
      if (path.startsWith('/api/admin/')) {
        const admin = requireUser(db, req, true);
        if (req.method === 'GET' && path === '/api/admin/products') {
          return send(res, 200, { products: listProducts(db, true) });
        }
        if (req.method === 'GET' && path === '/api/admin/orders') {
          const rows = db.prepare('SELECT id FROM orders ORDER BY created_at DESC LIMIT 100').all();
          return send(res, 200, { orders: rows.map((row) => publicOrder(getOrder(db, row.id))) });
        }
        const adminOrderMatch = path.match(/^\/api\/admin\/orders\/([a-f0-9-]+)$/);
        if (req.method === 'PATCH' && adminOrderMatch) {
          const body = await readJson(req);
          if (!['processing', 'fulfilled'].includes(body.fulfillmentStatus)) fail(400, 'Некорректный статус');
          const order = getOrder(db, adminOrderMatch[1]);
          if (!order) fail(404, 'Заказ не найден');
          if (order.fulfillment_status === 'cancelled') fail(409, 'Отменённый заказ нельзя обработать');
          db.prepare('UPDATE orders SET fulfillment_status = ? WHERE id = ?')
            .run(body.fulfillmentStatus, order.id);
          db.prepare('INSERT INTO audit_log(actor_id, action, target) VALUES (?, ?, ?)')
            .run(admin.id, 'order.update', order.id);
          return send(res, 200, { order: publicOrder(getOrder(db, order.id)) });
        }
        if (req.method === 'POST' && path === '/api/admin/products') {
          const body = await readJson(req);
          const id = clean(body.id, 60);
          const price = Number(body.price);
          if (!/^[a-z0-9-]{3,60}$/.test(id) || !clean(body.name) ||
              !['top', 'bottom', 'outerwear', 'dress'].includes(body.category) ||
              !['tee', 'coat', 'trousers', 'dress', 'skirt'].includes(body.piece) ||
              !['female', 'male', 'unisex'].includes(body.audience) ||
              !Number.isInteger(price) || price < 0) fail(400, 'Некорректные данные товара');
          db.prepare(`INSERT INTO products
            (id, name, category, piece, audience, description, fabric, price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, clean(body.name), body.category, body.piece, body.audience,
              clean(body.description, 2000), clean(body.fabric, 500), price);
          db.prepare('INSERT INTO audit_log(actor_id, action, target) VALUES (?, ?, ?)').run(admin.id, 'product.create', id);
          return send(res, 201, { product: listProducts(db, true).find((item) => item.id === id) });
        }
        const productMatch = path.match(/^\/api\/admin\/products\/([a-z0-9-]+)$/);
        if (req.method === 'PATCH' && productMatch) {
          const body = await readJson(req);
          const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productMatch[1]);
          if (!existing) fail(404, 'Товар не найден');
          const price = body.price === undefined ? existing.price : Number(body.price);
          if (!Number.isInteger(price) || price < 0 || ![0, 1, true, false].includes(body.active ?? existing.active)) {
            fail(400, 'Некорректная цена или статус');
          }
          db.prepare(`UPDATE products SET name = ?, description = ?, fabric = ?, price = ?, active = ? WHERE id = ?`)
            .run(clean(body.name ?? existing.name), clean(body.description ?? existing.description, 2000),
              clean(body.fabric ?? existing.fabric, 500), price, Number(body.active ?? existing.active), existing.id);
          db.prepare('INSERT INTO audit_log(actor_id, action, target) VALUES (?, ?, ?)').run(admin.id, 'product.update', existing.id);
          return send(res, 200, { product: listProducts(db, true).find((item) => item.id === existing.id) });
        }
        if (req.method === 'POST' && path === '/api/admin/variants') {
          const body = await readJson(req);
          const sku = clean(body.sku, 100);
          const stock = Number(body.stock);
          if (!/^[a-zA-Z0-9-]{3,100}$/.test(sku) || !db.prepare('SELECT id FROM products WHERE id = ?').get(body.productId) ||
              !['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(body.size) ||
              !/^#[0-9a-fA-F]{6}$/.test(body.color) || !Number.isInteger(stock) || stock < 0) {
            fail(400, 'Некорректный вариант');
          }
          db.prepare(`INSERT INTO variants(sku, product_id, size, color, color_name, stock)
            VALUES (?, ?, ?, ?, ?, ?)`)
            .run(sku, body.productId, body.size, body.color, clean(body.colorName, 80) || body.color, stock);
          db.prepare('INSERT INTO audit_log(actor_id, action, target) VALUES (?, ?, ?)').run(admin.id, 'variant.create', sku);
          return send(res, 201, { ok: true });
        }
        const variantMatch = path.match(/^\/api\/admin\/variants\/([a-zA-Z0-9-]+)$/);
        if (req.method === 'PATCH' && variantMatch) {
          const body = await readJson(req);
          const variant = db.prepare('SELECT * FROM variants WHERE sku = ?').get(variantMatch[1]);
          if (!variant) fail(404, 'Вариант не найден');
          const stock = body.stock === undefined ? variant.stock : Number(body.stock);
          if (!Number.isInteger(stock) || stock < 0 || ![0, 1, true, false].includes(body.active ?? variant.active)) {
            fail(400, 'Некорректный остаток или статус');
          }
          db.prepare('UPDATE variants SET stock = ?, active = ? WHERE sku = ?')
            .run(stock, Number(body.active ?? variant.active), variant.sku);
          db.prepare('INSERT INTO audit_log(actor_id, action, target) VALUES (?, ?, ?)').run(admin.id, 'variant.update', variant.sku);
          return send(res, 200, { ok: true });
        }
      }
      return send(res, 404, { error: 'Маршрут не найден' });
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message });
      if (error.code?.startsWith('SQLITE_CONSTRAINT')) return send(res, 409, { error: 'Запись уже существует или нарушено ограничение' });
      console.error('API error:', error);
      return send(res, 500, { error: 'Внутренняя ошибка сервера' });
    }
  };
}
