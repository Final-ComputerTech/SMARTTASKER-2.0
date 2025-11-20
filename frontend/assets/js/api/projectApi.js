import { apiRequest } from '../utils/request.js';

export const projectApi = {
  summary: () => apiRequest('projects/summary', 'GET', null, true),
  list: () => apiRequest('projects', 'GET', null, true)
};
