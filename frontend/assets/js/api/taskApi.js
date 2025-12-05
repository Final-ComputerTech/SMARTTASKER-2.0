import { apiRequest } from '../utils/request.js';

export const taskApi = {
  list: (params = '') => apiRequest(`tasks?${params}`, 'GET', null, true),
  get: (id) => apiRequest(`tasks/${id}`, 'GET', null, true),
  changes: (id) => apiRequest(`tasks/${id}/changes`, 'GET', null, true),
  create: async (payload) => {
    const res = await apiRequest('tasks', 'POST', payload, true);
    try {
      const key = 'task:created';
      const payloadBroadcast = JSON.stringify({ task_id: res && res.task_id ? res.task_id : null, ts: Date.now() });
      localStorage.setItem(key, payloadBroadcast);
      setTimeout(() => { try { localStorage.removeItem(key); } catch (e) {} }, 200);
    } catch (e) { /* ignore */ }
    return res;
  },
  update: (id, payload) => apiRequest(`tasks/${id}`, 'PUT', payload, true),
  delete: (id) => apiRequest(`tasks/${id}`, 'DELETE', null, true),
  // for calendar:
  calendar: (from, to) => apiRequest(`tasks/calendar?from=${from}&to=${to}`, 'GET', null, true)
};

// assign/unassign users to tasks
taskApi.assign = (taskId, payload) => apiRequest(`tasks/${taskId}/assign`, 'POST', payload, true);
taskApi.unassign = (taskId, userId) => apiRequest(`tasks/${taskId}/assign/${userId}`, 'DELETE', null, true);
