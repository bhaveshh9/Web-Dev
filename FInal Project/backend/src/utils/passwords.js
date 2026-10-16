import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const pbkdf2 = promisify(crypto.pbkdf2);

const SALT_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function makeSalt(len = 16) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += SALT_CHARS[bytes[i] % SALT_CHARS.length];
  return out;
}

/** New passwords: "scrypt:32768:8:1$salt$hex" (identical to werkzeug's default). */
export async function hashPassword(password) {
  const N = 32768, r = 8, p = 1;
  const salt = makeSalt();
  const key = await scrypt(password, salt, 64, { N, r, p, maxmem: 132 * N * r * p });
  return `scrypt:${N}:${r}:${p}$${salt}$${key.toString('hex')}`;
}

/** Verifies werkzeug "scrypt:" and "pbkdf2:" hashes, so users created by the old Flask app still log in. */
export async function checkPassword(stored, password) {
  if (typeof stored !== 'string' || typeof password !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length < 3) return false;

  const [method, salt] = parts;
  const expected = parts.slice(2).join('$');
  const m = method.split(':');

  let derived;
  try {
    if (m[0] === 'scrypt') {
      const N = parseInt(m[1] || '32768', 10);
      const r = parseInt(m[2] || '8', 10);
      const p = parseInt(m[3] || '1', 10);
      derived = await scrypt(password, salt, 64, { N, r, p, maxmem: 132 * N * r * p });
    } else if (m[0] === 'pbkdf2') {
      const algo = m[1] || 'sha256';
      const iterations = parseInt(m[2] || '600000', 10);
      const keylen = crypto.createHash(algo).update('').digest().length;
      derived = await pbkdf2(password, salt, iterations, keylen, algo);
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }

  const a = Buffer.from(derived.toString('hex'));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
