import api from './api';

export const submitContactMessageApi = async (formData) => {
  const response = await api.post('/contact', formData);
  return response.data;
};

export const getContactMessagesApi = async () => {
  const response = await api.get('/contact');
  return response.data;
};

export const updateContactStatusApi = async (id, status) => {
  const response = await api.patch(`/contact/${id}`, { status });
  return response.data;
};

export const deleteContactMessageApi = async (id) => {
  const response = await api.delete(`/contact/${id}`);
  return response.data;
};

export const replyContactMessageApi = async (id, replyMessage) => {
  const response = await api.post(`/contact/${id}/reply`, { replyMessage });
  return response.data;
};


