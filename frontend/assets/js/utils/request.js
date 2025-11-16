// assets/js/utils/request.js
const API_BASE = "http://localhost:5000/api";

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
