import { apiRequest } from '../utils/request.js';

export const notificationApi = {
  list: () => apiRequest('notifications', 'GET', null, true),
  markRead: (id) => apiRequest(`notifications/${id}/read`, 'PUT', null, true),
  markAllRead: () => apiRequest('notifications/mark-all', 'PUT', null, true)
};
