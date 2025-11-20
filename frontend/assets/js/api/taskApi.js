import { apiRequest } from '../utils/request.js';

export const taskApi = {
  list: (params = '') => apiRequest(`tasks?${params}`, 'GET', null, true),
  get: (id) => apiRequest(`tasks/${id}`, 'GET', null, true),
  create: (payload) => apiRequest('tasks', 'POST', payload, true),
  update: (id, payload) => apiRequest(`tasks/${id}`, 'PUT', payload, true),
  delete: (id) => apiRequest(`tasks/${id}`, 'DELETE', null, true),
  // for calendar:
  calendar: (from, to) => apiRequest(`tasks/calendar?from=${from}&to=${to}`, 'GET', null, true)
};
