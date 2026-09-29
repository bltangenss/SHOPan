import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { CATALOG } from '../src/data/catalog.js';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLOR_NAMES = {
  'tee-milk': 'Молочный', 'tee-ink': 'Чёрный',
  'coat-charcoal': 'Угольный', 'coat-ink': 'Тёмный',
  'trousers-charcoal': 'Графитовый', 'trousers-clay': 'Терракотовый',
  'dress-tape': 'Красный', 'dress-muslin': 'Молочный',
  'skirt-clay': 'Терракотовый',
};

export function createStore(filename = process.env.VFR_DB_PATH || resolve('server/data/store.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, piece TEXT NOT NULL,
      audience TEXT NOT NULL, description TEXT NOT NULL, fabric TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price >= 0), active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS variants (
      sku TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
      size TEXT NOT NULL, color TEXT NOT NULL, color_name TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK(stock >= 0), active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(product_id, size, color)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), receipt_hash TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
      customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL,
      fulfillment TEXT NOT NULL, address TEXT NOT NULL, delivery_cost INTEGER NOT NULL,
      subtotal INTEGER NOT NULL, total INTEGER NOT NULL,
      payment_status TEXT NOT NULL, fulfillment_status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id), sku TEXT NOT NULL, product_id TEXT NOT NULL,
      name TEXT NOT NULL, size TEXT NOT NULL, color TEXT NOT NULL,
      unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL,
      PRIMARY KEY(order_id, sku)
    );
    CREATE TABLE IF NOT EXISTS body_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      version INTEGER NOT NULL, measurements_json TEXT NOT NULL,
      gender TEXT NOT NULL, skin_tone TEXT NOT NULL, hair_color TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS body_profile_versions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      version INTEGER NOT NULL, measurements_json TEXT NOT NULL,
      gender TEXT NOT NULL, skin_tone TEXT NOT NULL, hair_color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, version)
    );
    CREATE TABLE IF NOT EXISTS saved_outfits (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, selection_json TEXT NOT NULL, sku TEXT NOT NULL,
      profile_version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL,
      action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_outfits_user ON saved_outfits(user_id, created_at);
  `);
  db.exec(`INSERT OR IGNORE INTO body_profile_versions
    (user_id, version, measurements_json, gender, skin_tone, hair_color, created_at)
    SELECT user_id, version, measurements_json, gender, skin_tone, hair_color, updated_at
    FROM body_profiles`);

  if (!db.prepare("SELECT value FROM settings WHERE key = 'receipt_secret'").get()) {
    db.prepare("INSERT INTO settings(key, value) VALUES('receipt_secret', ?)")
      .run(randomBytes(32).toString('hex'));
  }

  if (db.prepare('SELECT COUNT(*) AS count FROM products').get().count === 0) {
    const insertProduct = db.prepare(`INSERT INTO products
      (id, name, category, piece, audience, description, fabric, price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertVariant = db.prepare(`INSERT INTO variants
      (sku, product_id, size, color, color_name, stock) VALUES (?, ?, ?, ?, ?, ?)`);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of CATALOG) {
        insertProduct.run(item.id, item.name, item.category, item.piece, item.for,
          item.description, item.fabric, item.price);
        for (const size of SIZES) {
          const stock = item.id === 'dress-muslin' && size === 'XS' ? 1 :
            item.id === 'coat-ink' && size === 'XXL' ? 0 : 8;
          insertVariant.run(`${item.id}-${size}`, item.id, size, item.color, COLOR_NAMES[item.id] || item.name, stock);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const renameSeedColor = db.prepare('UPDATE variants SET color_name = ? WHERE product_id = ? AND color_name = ?');
  for (const item of CATALOG) renameSeedColor.run(COLOR_NAMES[item.id] || item.name, item.id, item.name);

  return db;
}

export function transaction(db, run) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const value = run();
    db.exec('COMMIT');
    return value;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listProducts(db, includeInactive = false) {
  const products = db.prepare(`SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY created_at, id`).all();
  const variants = db.prepare(`SELECT * FROM variants ${includeInactive ? '' : 'WHERE active = 1'}
    ORDER BY CASE size WHEN 'XS' THEN 0 WHEN 'S' THEN 1 WHEN 'M' THEN 2
      WHEN 'L' THEN 3 WHEN 'XL' THEN 4 ELSE 5 END, color`).all();
  return products.map((product) => ({
    ...product,
    active: Boolean(product.active),
    variants: variants.filter((variant) => variant.product_id === product.id)
      .map((variant) => ({ ...variant, active: Boolean(variant.active) })),
  }));
}

export function getOrder(db, id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  return { ...order, items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) };
}
