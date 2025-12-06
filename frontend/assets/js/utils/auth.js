// assets/js/utils/auth.js
export function saveToken(token) { localStorage.setItem('st_token', token); }
export function getToken() { return localStorage.getItem('st_token'); }
export function clearToken() { localStorage.removeItem('st_token'); }
export function requireAuthRedirect() {
  const token = getToken();
  console.debug('requireAuthRedirect: token?', !!token);
  if (!token) window.location.href = '/index.html';
}

// Return decoded JWT payload (without verification) or null
export function getUserFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url -> base64
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // pad base64 string
    while (payload.length % 4) payload += '=';
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (e) {
    console.debug('getUserFromToken decode failed', e && e.message ? e.message : e);
    return null;
  }
}
