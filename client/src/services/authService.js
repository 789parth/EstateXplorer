import api from './api';

export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const sendRegistrationOtpApi = async (userData) => {
  const response = await api.post('/auth/register-send-otp', userData);
  return response.data;
};

export const verifyRegistrationOtpApi = async (verifyPayload) => {
  const response = await api.post('/auth/register-verify-otp', verifyPayload);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const adminLoginUser = async (credentials) => {
  const response = await api.post('/auth/admin-secure-login', credentials);
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const forgotPasswordApi = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const verifyOtpApi = async (email, code) => {
  const response = await api.post('/auth/verify-otp', { email, code });
  return response.data;
};

export const resetPasswordApi = async (email, code, newPassword) => {
  const response = await api.post('/auth/reset-password', { email, code, newPassword });
  return response.data;
};

export const updateProfileApi = async (profileData) => {
  const response = await api.patch('/auth/update-profile', profileData);
  return response.data;
};

export const changePasswordApi = async (passwords) => {
  const response = await api.patch('/auth/change-password', passwords);
  return response.data;
};

export const googleAuthApi = async (payload, role, intent = 'login') => {
  const body = typeof payload === 'string' ? { idToken: payload, role, intent } : { ...payload, role, intent };
  const response = await api.post('/auth/google', body);
  return response.data;
};

export const deleteAccountApi = async () => {
  const response = await api.delete('/auth/delete-account');
  return response.data;
};

export const requestRoleApi = async (requestedRole) => {
  const response = await api.post('/auth/request-role', { requestedRole });
  return response.data;
};

export const getMyRoleRequestsApi = async () => {
  const response = await api.get('/auth/my-role-requests');
  return response.data;
};

export const switchRoleApi = async (role) => {
  const response = await api.post('/auth/switch-role', { role });
  return response.data;
};

export const verify2FALoginApi = async (email, code, role) => {
  const response = await api.post('/auth/verify-2fa', { email, code, role });
  return response.data;
};

export const resend2FAApi = async (email) => {
  const response = await api.post('/auth/resend-2fa', { email });
  return response.data;
};

export const toggleTwoFactorApi = async (enabled) => {
  const response = await api.patch('/auth/toggle-2fa', { enabled });
  return response.data;
};

export const sendVerifyEmailOtpApi = async () => {
  const response = await api.post('/auth/send-verify-email');
  return response.data;
};

export const verifyEmailOtpApi = async (code) => {
  const response = await api.post('/auth/verify-email', { code });
  return response.data;
};

export const sendPhoneOtpApi = async (phone) => {
  const response = await api.post('/auth/send-phone-otp', { phone });
  return response.data;
};

export const verifyPhoneOtpApi = async (code, phone) => {
  const response = await api.post('/auth/verify-phone-otp', { code, phone });
  return response.data;
};

export const sendTestSmsApi = async (phone) => {
  const response = await api.post('/notifications/test-sms', { phone });
  return response.data;
};

export const sendTestEmailApi = async (email) => {
  const response = await api.post('/notifications/test-email', { email });
  return response.data;
};

export const submitKycDocumentsApi = async (kycPayload) => {
  const response = await api.post('/auth/kyc/submit', kycPayload);
  return response.data;
};

export const getKycStatusApi = async () => {
  const response = await api.get('/auth/kyc/status');
  return response.data;
};


