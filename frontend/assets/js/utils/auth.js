// assets/js/utils/auth.js
export function saveToken(token) { localStorage.setItem('st_token', token); }
export function getToken() { return localStorage.getItem('st_token'); }
export function clearToken() { localStorage.removeItem('st_token'); }
export function requireAuthRedirect() {
  if (!getToken()) window.location.href = '/index.html';
}
