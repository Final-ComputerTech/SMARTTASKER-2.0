import { apiRequest } from '../utils/request.js';

export const authApi = {
  login: (email, password) => apiRequest('auth/login', 'POST', { email, password }, false),
  register: (payload) => apiRequest('auth/register', 'POST', payload, false)
};
