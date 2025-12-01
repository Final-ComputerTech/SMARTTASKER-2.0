import { apiRequest } from '../utils/request.js';

export const userApi = {
  list: () => apiRequest('users', 'GET', null, true),
  create: (payload) => apiRequest('users', 'POST', payload, true),
  get: (id) => apiRequest(`users/${id}`, 'GET', null, true),
  update: (id, payload) => apiRequest(`users/${id}`, 'PUT', payload, true)
};
