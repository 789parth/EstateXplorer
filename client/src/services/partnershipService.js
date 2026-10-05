import api from './api';

// Discovery & Applications (Agent)
export const discoverProjects = async (params = {}) => {
  const response = await api.get('/partnerships/discover', { params });
  return response.data;
};

export const requestPartnership = async (projectId, message = '') => {
  const response = await api.post('/partnerships/request', { projectId, message });
  return response.data;
};

export const getMyPartnerships = async () => {
  const response = await api.get('/partnerships/my-partnerships');
  return response.data;
};

export const getProjectPartnership = async (projectId) => {
  const response = await api.get(`/partnerships/project/${projectId}`);
  return response.data;
};

// Approvals & Management (Builder)
export const getBuilderPartnerships = async (projectId = null) => {
  const params = projectId ? { projectId } : {};
  const response = await api.get('/partnerships/builder-partnerships', { params });
  return response.data;
};

export const updatePartnershipStatus = async (id, status, commissionRate = null, rejectionReason = '') => {
  const response = await api.patch(`/partnerships/${id}/status`, { status, commissionRate, rejectionReason });
  return response.data;
};

export const bulkApprovePartnerships = async (partnershipIds) => {
  const response = await api.post('/partnerships/bulk-approve', { partnershipIds });
  return response.data;
};
