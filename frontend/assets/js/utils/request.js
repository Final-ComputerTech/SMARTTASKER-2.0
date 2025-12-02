// assets/js/utils/request.js
// Use relative `/api` when the frontend is served by the backend (same origin).
// If the frontend is served from a different origin/port (e.g. python simple server on port 8000
// or opening files via `127.0.0.1:8000`), fall back to the backend absolute URL so requests reach
// the Express server instead of the static server (which returns 405 for POSTs).
const BACKEND_HOST = 'http://localhost:3000';
// If the current page is served on a different port than the backend, use the backend host.
// This uses port-detection (not hostname) so `127.0.0.1:8000`, `localhost:8000` and similar
// will correctly fall back to the backend API.
const API_BASE = (window.location.port && window.location.port !== '3000')
  ? `${BACKEND_HOST}/api`
  : '/api';

async function apiRequest(endpoint, method = "GET", data = null, requireAuth = true) {
  const headers = { "Content-Type": "application/json" };
  if (requireAuth) {
    const token = localStorage.getItem("st_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const options = { method, headers };
  // prevent aggressive browser caching for API calls
  options.cache = 'no-store';
  if (data) options.body = JSON.stringify(data);

  const resp = await fetch(`${API_BASE}/${endpoint}`, options);
  const text = await resp.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { throw new Error("Invalid JSON"); }
  if (!resp.ok) {
    const err = json.error || json.message || 'API error';
    throw new Error(err);
  }
  return json;
}

async function apiUpload(endpoint, formData, requireAuth = true, method = 'POST') {
  const headers = {};
  if (requireAuth) {
    const token = localStorage.getItem('st_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers, body: formData, cache: 'no-store' };
  const resp = await fetch(`${API_BASE}/${endpoint}`, options);
  const text = await resp.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (e) { throw new Error('Invalid JSON'); }
  if (!resp.ok) {
    const err = json.error || json.message || 'API error';
    throw new Error(err);
  }
  return json;
}

export { apiRequest, apiUpload, API_BASE };
