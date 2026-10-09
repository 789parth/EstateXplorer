import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { setAccessTokenInMemory, getAccessTokenFromMemory } from '../services/api';
import {
  loginUser,
  adminLoginUser,
  registerUser,
  logoutUser,
  getCurrentUser,
  googleAuthApi,
  updateProfileApi,
  deleteAccountApi,
  requestRoleApi,
  getMyRoleRequestsApi,
  switchRoleApi,
  verify2FALoginApi,
  resend2FAApi,
  sendRegistrationOtpApi,
  verifyRegistrationOtpApi,
} from '../services/authService';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../utils/realtimeSync';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToastMessage({ msg, type, id: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Load/refresh user session from backend
  const refreshUser = useCallback(async () => {
    try {
      const res = await getCurrentUser();
      if (res.success) {
        setUser(res.data);
        return res.data;
      }
    } catch (err) {
      // Session expired or not found
    }
    return null;
  }, []);

  // Real-time synchronization for role updates, auth changes, and window focus (active sessions only)
  useRealtimeSync(
    [SYNC_EVENTS.ROLES, SYNC_EVENTS.AUTH],
    async () => {
      if (user || getAccessTokenFromMemory()) {
        await refreshUser();
      }
    },
    { revalidateOnFocus: true, intervalMs: 60000 }
  );

  // Try loading user session via cookie / refresh on app load
  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const res = await getCurrentUser();
        if (isMounted && res.success) {
          setUser(res.data);
        }
      } catch (err) {
        // Session not found or expired — this is expected on fresh visits, stay silent
        if (isMounted) {
          setUser(null);
          setAccessTokenInMemory(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (credentials) => {
    try {
      const res = await loginUser(credentials);
      if (res.require2FA) {
        return {
          success: true,
          require2FA: true,
          email: res.email,
          role: res.role,
          message: res.message,
        };
      }
      if (res.success) {
        setUser(res.data.user);
        setAccessToken(res.data.accessToken);
        setAccessTokenInMemory(res.data.accessToken);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'login', user: res.data.user });
        showToast(`Welcome back, ${res.data.user.name}!`, 'success');
        return { success: true };
      }
    } catch (error) {
      const isNotRegistered = Boolean(
        error.response?.data?.notRegistered ||
        error.response?.status === 404 ||
        error.response?.data?.message?.toLowerCase().includes('not registered') ||
        error.response?.data?.message?.toLowerCase().includes('no account found')
      );
      const isAdminAccount = Boolean(
        error.response?.data?.isAdminAccount ||
        (error.response?.data?.message &&
          /admin/i.test(error.response.data.message) &&
          /invalid|normal login|dedicated/i.test(error.response.data.message))
      );
      const msg = error.response?.data?.message || 'Login failed. Please check your credentials.';
      if (!isNotRegistered) {
        showToast(msg, 'error');
      }
      return {
        success: false,
        notRegistered: isNotRegistered,
        isAdminAccount,
        email: error.response?.data?.email || credentials?.email,
        message: msg,
      };
    }
  };

  const handleAdminLogin = async (credentials) => {
    try {
      const res = await adminLoginUser(credentials);
      if (res.require2FA) {
        return {
          success: true,
          require2FA: true,
          email: res.email,
          role: 'admin',
          message: res.message,
        };
      }
      if (res.success) {
        setUser(res.data.user);
        setAccessToken(res.data.accessToken);
        setAccessTokenInMemory(res.data.accessToken);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'login', user: res.data.user });
        showToast(`Welcome Administrator, ${res.data.user.name}!`, 'success');
        return { success: true };
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Administrative login failed. Access denied.';
      showToast(msg, 'error');
      return {
        success: false,
        message: msg,
      };
    }
  };

  const handleVerify2FALogin = async (email, code, role) => {
    try {
      const res = await verify2FALoginApi(email, code, role);
      if (res.success) {
        setUser(res.data.user);
        setAccessToken(res.data.accessToken);
        setAccessTokenInMemory(res.data.accessToken);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'login', user: res.data.user });
        showToast(`Welcome back, ${res.data.user.name}!`, 'success');
        return { success: true };
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid or expired verification code.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleResend2FA = async (email) => {
    try {
      const res = await resend2FAApi(email);
      showToast(res.message || 'New verification code sent!', 'info');
      return { success: true, message: res.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to resend code.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleRegister = async (userData) => {
    try {
      const res = await registerUser(userData);
      if (res.success) {
        setUser(res.data.user);
        setAccessToken(res.data.accessToken);
        setAccessTokenInMemory(res.data.accessToken);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'register', user: res.data.user });
        showToast('Account created successfully!', 'success');
        return { success: true };
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Registration failed. Please try again.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleSendRegistrationOtp = async (userData) => {
    try {
      const res = await sendRegistrationOtpApi(userData);
      return { success: true, message: res.message || 'Verification code sent to your email.' };
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to send verification code. Please check your details.';
      return { success: false, message: msg };
    }
  };

  const handleVerifyRegistrationOtp = async (verifyPayload) => {
    try {
      const res = await verifyRegistrationOtpApi(verifyPayload);
      if (res.success) {
        setUser(res.data.user);
        setAccessToken(res.data.accessToken);
        setAccessTokenInMemory(res.data.accessToken);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'register', user: res.data.user });
        showToast('Email verified and logged in successfully! Welcome to EstateXplorer!', 'success');
        return { success: true, user: res.data.user };
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid or expired verification code.';
      return { success: false, message: msg };
    }
  };

  const handleGoogleLogin = async (payload, role, intent = 'login') => {
    try {
      const res = await googleAuthApi(payload, role, intent);
      if (res.success) {
        setUser(res.data.user);
        setAccessToken(res.data.accessToken);
        setAccessTokenInMemory(res.data.accessToken);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'google_login', user: res.data.user });
        showToast(`Welcome, ${res.data.user.name}!`, 'success');
        return { success: true };
      }
    } catch (error) {
      if (error?._isSessionExpiry) return { success: false };
      const resData = error.response?.data;
      if (resData?.notRegistered) {
        return {
          success: false,
          notRegistered: true,
          email: resData.email,
          message: resData.message || 'Account does not exist. Please register first.',
        };
      }
      const serverMsg = resData?.message || '';
      const msg = serverMsg || error.message || 'Google sign-in failed. Please try again.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'logout' });
      setUser(null);
      setAccessToken(null);
      setAccessTokenInMemory(null);
      showToast('Logged out successfully', 'info');
      // Strictly redirect to home page index only
      window.location.href = '/';
    }
  };

  const handleUpdateProfile = async (profileData, options = {}) => {
    try {
      const res = await updateProfileApi(profileData);
      if (res.success) {
        setUser(res.data);
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'profile_updated', user: res.data });
        if (!options.silent) {
          showToast(options.successMessage || 'Profile updated successfully!', 'success');
        }
        return { success: true, data: res.data };
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update profile.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleSwitchRole = async (role) => {
    try {
      const res = await switchRoleApi(role);
      if (res.success) {
        setUser(res.data.user);
        if (res.data.accessToken) {
          setAccessToken(res.data.accessToken);
          setAccessTokenInMemory(res.data.accessToken);
        }
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'role_switched', user: res.data.user });
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'role_switched', user: res.data.user });
        showToast(`Switched active role to ${role.charAt(0).toUpperCase() + role.slice(1)}!`, 'success');
        return { success: true, user: res.data.user };
      }
    } catch (error) {
      // Sync fresh user roles from DB immediately
      await refreshUser();
      const msg = error.response?.data?.message || 'Failed to switch role.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleRequestRole = async (requestedRole) => {
    try {
      const res = await requestRoleApi(requestedRole);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'role_requested', role: requestedRole });
        showToast(res.message || 'Role request submitted for approval!', 'success');
        return { success: true, data: res.data, message: res.message };
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to submit role request.';
      showToast(msg, 'error');
      return { success: false, message: msg };
    }
  };

  const handleGetMyRoleRequests = async () => {
    try {
      const res = await getMyRoleRequestsApi();
      if (res.success) {
        return { success: true, data: res.data };
      }
    } catch (error) {
      return { success: false, data: [] };
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccountApi();
    } catch (err) {
      console.error('Delete account error:', err);
    } finally {
      setUser(null);
      setAccessToken(null);
      setAccessTokenInMemory(null);
      
      // Clear all local client state related to user (wishlist, inquiries, recently viewed, role state)
      try {
        if (typeof window !== 'undefined') {
          if (window.localStorage) {
            window.localStorage.removeItem('wishlist');
            window.localStorage.removeItem('myInquiries');
            window.localStorage.removeItem('recentlyViewed');
            window.localStorage.removeItem('booked_visits');
            window.localStorage.removeItem('activeRole');
          }
          if (window.sessionStorage) {
            window.sessionStorage.clear();
          }
        }
      } catch (storageErr) {
        console.warn('Error clearing local storage upon account deletion:', storageErr);
      }

      showToast('Your account and all associated data have been permanently deleted.', 'info');
      // Strictly navigate to Home Page
      window.location.replace('/');
    }
  };

  const contextValue = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      isAuthenticated: !!user,
      login: handleLogin,
      adminLogin: handleAdminLogin,
      verify2FALogin: handleVerify2FALogin,
      resend2FA: handleResend2FA,
      register: handleRegister,
      sendRegistrationOtp: handleSendRegistrationOtp,
      verifyRegistrationOtp: handleVerifyRegistrationOtp,
      googleLogin: handleGoogleLogin,
      logout: handleLogout,
      updateProfile: handleUpdateProfile,
      deleteAccount: handleDeleteAccount,
      switchRole: handleSwitchRole,
      requestRole: handleRequestRole,
      getMyRoleRequests: handleGetMyRoleRequests,
      refreshUser,
      toastMessage,
      showToast,
      hideToast,
      setUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, accessToken, loading, toastMessage]
  );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
};
