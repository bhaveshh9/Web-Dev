import { ObjectId } from 'mongodb';

// Same behaviour as before: UTC + 5:30, stored as the "naive" IST time.
export const nowIST = () => new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "14 Oct 2026 09:04 AM"  (UTC getters on purpose: the stored value already is IST)
export function fmt(value) {
  if (!value) return null;
  const d = new Date(value);
  const h24 = d.getUTCHours();
  const h12 = String(h24 % 12 || 12).padStart(2, '0');
  return (
    `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ` +
    `${h12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
  );
}

// string -> ObjectId, or null when it is not a valid 24-char hex id
export function toOid(value) {
  if (value instanceof ObjectId) return value;
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value) ? new ObjectId(value) : null;
}

// same rules as werkzeug.utils.secure_filename
export function secureFilename(name) {
  let s = String(name || '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  s = s.replace(/[\\/]/g, ' ').trim().split(/\s+/).join('_');
  s = s.replace(/[^A-Za-z0-9_.-]/g, '').replace(/^[._]+|[._]+$/g, '');
  return s;
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
