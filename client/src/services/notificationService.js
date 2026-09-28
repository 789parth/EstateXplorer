import api from './api';

export const getNotificationLogsApi = async (params = {}) => {
  const response = await api.get('/notifications/logs', { params });
  return response.data;
};

export const markNotificationAsReadApi = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsAsReadApi = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data;
};

export const sendTestSmsApi = async (payload) => {
  const response = await api.post('/notifications/test-sms', payload);
  return response.data;
};

export const sendTestEmailApi = async (payload) => {
  const response = await api.post('/notifications/test-email', payload);
  return response.data;
};
