import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { createStore } from '../server/store.js';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || 'Администратор').trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in the environment.');
  process.exitCode = 1;
} else {
  const db = createStore();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    console.error('This email already exists. No account was changed.');
    process.exitCode = 1;
  } else {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    db.prepare(`INSERT INTO users(id, email, name, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?, 'admin')`).run(randomUUID(), email, name, hash, salt);
    console.log(`Admin account created: ${email}`);
  }
  db.close();
}
