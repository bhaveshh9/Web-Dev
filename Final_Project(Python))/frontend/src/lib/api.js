// Small fetch wrapper. All backend calls go through here.
const BASE = import.meta.env.VITE_API_URL || '';

export const apiUrl = (path) => `${BASE}/api${path}`;

export async function api(path, { method = 'GET', json, form } = {}) {
  const opts = { method, credentials: 'include', headers: {} };

  if (json !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(json);
  }
  if (form) opts.body = form;

  const res = await fetch(apiUrl(path), opts);

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* non-JSON response */
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// If the session expired / wrong role, go where the server says.
export function handleAuthError(err, navigate) {
  if (err && (err.status === 401 || err.status === 403)) {
    navigate((err.data && err.data.redirect) || '/login', { replace: true });
    return true;
  }
  return false;
}
