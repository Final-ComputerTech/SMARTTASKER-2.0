import { apiRequest } from '../utils/request.js';

export const projectApi = {
  summary: () => apiRequest('projects/summary', 'GET', null, true),
  list: () => apiRequest('projects', 'GET', null, true)
};

// create endpoint (requires manager/admin on backend)
projectApi.create = (payload) => apiRequest('projects', 'POST', payload, true);
projectApi.update = (id, payload) => apiRequest(`projects/${id}`, 'PUT', payload, true);
projectApi.delete = (id) => apiRequest(`projects/${id}`, 'DELETE', null, true);
projectApi.addCollaborator = (projectId, payload) => apiRequest(`projects/${projectId}/collaborators`, 'POST', payload, true);
projectApi.removeCollaborator = (projectId, userId) => apiRequest(`projects/${projectId}/collaborators/${userId}`, 'DELETE', null, true);
projectApi.updateCollaborator = (projectId, userId, payload) => apiRequest(`projects/${projectId}/collaborators/${userId}`, 'PUT', payload, true);
