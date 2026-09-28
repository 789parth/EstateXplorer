import api from './api';

export const getSecurityStatsApi = async (hours = 24) => {
  const response = await api.get(`/security/stats?hours=${hours}`);
  return response.data;
};

export const getAuditLogsApi = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const response = await api.get(`/security/audit-logs?${query}`);
  return response.data;
};

export const getSecurityListsApi = async (type = '') => {
  const query = type ? `?type=${type}` : '';
  const response = await api.get(`/security/lists${query}`);
  return response.data;
};

export const addSecurityListEntryApi = async (data) => {
  const response = await api.post('/security/lists', data);
  return response.data;
};

export const removeSecurityListEntryApi = async (id) => {
  const response = await api.delete(`/security/lists/${id}`);
  return response.data;
};

export const getSecurityPolicyApi = async () => {
  const response = await api.get('/security/policy');
  return response.data;
};

export const updateSecurityPolicyApi = async (data) => {
  const response = await api.patch('/security/policy', data);
  return response.data;
};

export const checkEmailRiskApi = async (email) => {
  const response = await api.post('/security/check-email', { email });
  return response.data;
};
