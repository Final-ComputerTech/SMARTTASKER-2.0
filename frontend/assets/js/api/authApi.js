import { apiRequest } from '../utils/request.js';

export const authApi = {
  login: (email, password) => apiRequest('auth/login', 'POST', { email, password }, false),
  register: (payload) => apiRequest('auth/register', 'POST', payload, false)
};

// Add profile endpoints
export const authProfileApi = {
  me: () => apiRequest('auth/me', 'GET', null, true),
  updateMe: (payload) => apiRequest('auth/me', 'PUT', payload, true),
  uploadAvatar: (payload) => apiRequest('auth/me/avatar', 'PUT', payload, true)
};

// change password
export const authPasswordApi = {
  change: (currentPassword, newPassword) => apiRequest('auth/change-password', 'PUT', { currentPassword, newPassword }, true)
};

// delete account
export const authDeleteApi = {
  deleteMe: () => apiRequest('auth/me', 'DELETE', null, true)
};
