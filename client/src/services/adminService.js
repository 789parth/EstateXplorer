import api from './api';

export const getRoleRequestsApi = async (status = '') => {
  const query = status ? `?status=${status}` : '';
  const response = await api.get(`/admin/role-requests${query}`);
  return response.data;
};

export const approveRoleRequestApi = async (id) => {
  const response = await api.patch(`/admin/role-requests/${id}/approve`);
  return response.data;
};

export const rejectRoleRequestApi = async (id, rejectionReason = '') => {
  const response = await api.patch(`/admin/role-requests/${id}/reject`, { rejectionReason });
  return response.data;
};

export const revokeRoleRequestApi = async (id, reason = '') => {
  const response = await api.patch(`/admin/role-requests/${id}/revoke`, { reason });
  return response.data;
};

export const grantRoleDirectlyApi = async (email, role) => {
  const response = await api.post('/admin/grant-role', { email, role });
  return response.data;
};

export const revokeRoleDirectlyApi = async (payload) => {
  const response = await api.post('/admin/revoke-role', payload);
  return response.data;
};

export const getAdminUsersApi = async (search = '', role = '') => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role) params.append('role', role);
  const response = await api.get(`/admin/users?${params.toString()}`);
  return response.data;
};

export const deleteUserApi = async (id) => {
  const response = await api.delete(`/admin/users/${id}`);
  return response.data;
};

export const toggleBlockUserApi = async (id, isBlocked, reason = '') => {
  const response = await api.patch(`/admin/users/${id}/toggle-block`, { isBlocked, reason });
  return response.data;
};

export const getKycRequestsApi = async (status = '', role = '') => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (role) params.append('role', role);
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get(`/admin/kyc-requests${query}`);
  return response.data;
};

export const approveKycRequestApi = async (userId, role = '') => {
  const response = await api.patch(`/admin/kyc-requests/${userId}/approve`, { role });
  return response.data;
};

export const rejectKycRequestApi = async (userId, rejectionReason = '', role = '') => {
  const response = await api.patch(`/admin/kyc-requests/${userId}/reject`, { rejectionReason, role });
  return response.data;
};


