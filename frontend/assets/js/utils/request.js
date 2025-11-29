// assets/js/utils/request.js
// Use relative `/api` when frontend is served from the backend (same origin).
// If the frontend is served from a different origin (e.g. python simple server on port 8000),
// fall back to the backend URL so API requests go to the Express server.
const BACKEND_HOST = 'http://localhost:3000';
const API_BASE = (window.location.hostname === 'localhost' && window.location.port && window.location.port !== '3000')
  ? `${BACKEND_HOST}/api`
  : '/api';

async function apiRequest(endpoint, method = "GET", data = null, requireAuth = true) {
  const headers = { "Content-Type": "application/json" };
  if (requireAuth) {
    const token = localStorage.getItem("st_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const options = { method, headers };
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

export { apiRequest };
