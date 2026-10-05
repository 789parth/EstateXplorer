import api from './api';

// Inventory Units
export const getProjectUnits = async (projectId, params = {}) => {
  const response = await api.get(`/bookings/projects/${projectId}/units`, { params });
  return response.data;
};

export const createProjectUnits = async (projectId, units) => {
  const response = await api.post(`/bookings/projects/${projectId}/units`, { units });
  return response.data;
};

// Booking Execution
export const bookUnit = async (bookingData) => {
  const response = await api.post('/bookings/book', bookingData);
  return response.data;
};

export const getMyBookings = async () => {
  const response = await api.get('/bookings/my-bookings');
  return response.data;
};

export const markCommissionPaid = async (bookingId, transactionRef) => {
  const response = await api.patch(`/bookings/${bookingId}/commission-paid`, { transactionRef });
  return response.data;
};
