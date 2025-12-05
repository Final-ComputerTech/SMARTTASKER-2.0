import { apiRequest } from '../utils/request.js';

export const userApi = {
  list: (params) => apiRequest('users' + (params ? '?' + new URLSearchParams(params).toString() : ''), 'GET', null, true),
  create: (payload) => apiRequest('users', 'POST', payload, true),
  get: (id) => apiRequest(`users/${id}`, 'GET', null, true),
  update: (id, payload) => apiRequest(`users/${id}`, 'PUT', payload, true),
  stats: () => apiRequest('users/stats', 'GET', null, true),
  setRole: (id, role) => apiRequest(`users/${id}/role`, 'POST', { role }, true),
  suspend: (id) => apiRequest(`users/${id}/suspend`, 'POST', null, true),
  generateTemp: (id) => apiRequest(`users/${id}/generate-temp`, 'POST', null, true),
  remove: (id) => apiRequest(`users/${id}`, 'DELETE', null, true),
  // Try both `/users/logs/:id` and `/users/:id/logs` to be tolerant of backend routing
  logs: async (id) => {
    try {
      return await apiRequest(`users/logs/${id}`, 'GET', null, true);
    } catch (e) {
      // fallback to original path
      return await apiRequest(`users/${id}/logs`, 'GET', null, true);
    }
  }
};
