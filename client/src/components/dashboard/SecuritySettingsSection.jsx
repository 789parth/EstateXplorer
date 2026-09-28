import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  KeyRound,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Bell,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  toggleTwoFactorApi,
  sendVerifyEmailOtpApi,
  verifyEmailOtpApi,
  changePasswordApi,
} from '../../services/authService';

const SecuritySettingsSection = () => {
  const { user, setUser, showToast, updateProfile } = useAuth();

  // 2FA state
  const [twoFactorActive, setTwoFactorActive] = useState(user?.twoFactorEnabled || false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Email Verification state
  const [emailVerified, setEmailVerified] = useState(user?.isVerified || false);
  const [sendingVerifyOtp, setSendingVerifyOtp] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Alert preferences state
  const [emailAlerts, setEmailAlerts] = useState(
    typeof user?.emailNotifications === 'boolean' ? user.emailNotifications : true
  );
  const [updatingAlert, setUpdatingAlert] = useState(false);

  useEffect(() => {
    if (user) {
      setTwoFactorActive(user.twoFactorEnabled || false);
      setEmailVerified(user.isVerified || false);
      if (typeof user.emailNotifications === 'boolean') {
        setEmailAlerts(user.emailNotifications);
      }
    }
  }, [user]);

  // Toggle 2FA
  const handleToggle2FA = async () => {
    try {
      setTwoFactorLoading(true);
      const res = await toggleTwoFactorApi(!twoFactorActive);
      if (res.success) {
        const nextVal = res.data?.twoFactorEnabled ?? !twoFactorActive;
        setTwoFactorActive(nextVal);
        if (setUser) {
          setUser((prev) => (prev ? { ...prev, twoFactorEnabled: nextVal } : prev));
        }
        showToast(
          nextVal
            ? 'Two-Factor Authentication enabled! 6-digit OTP will be required on sign in.'
            : 'Two-Factor Authentication disabled.',
          'success'
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update 2FA status.';
      showToast(msg, 'error');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // Send Email Verification OTP
  const handleSendVerifyOtp = async () => {
    try {
      setSendingVerifyOtp(true);
      setVerifyError('');
      const res = await sendVerifyEmailOtpApi();
      if (res.success) {
        setShowVerifyModal(true);
        showToast(res.message || 'Verification code sent to your email!', 'info');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification code.';
      showToast(msg, 'error');
    } finally {
      setSendingVerifyOtp(false);
    }
  };

  // Submit Email Verification OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setVerifyError('Please enter the 6-digit verification code.');
      return;
    }
    try {
      setVerifyingOtp(true);
      setVerifyError('');
      const res = await verifyEmailOtpApi(otpCode.trim());
      if (res.success) {
        setEmailVerified(true);
        if (setUser) {
          setUser((prev) => (prev ? { ...prev, isVerified: true } : prev));
        }
        setShowVerifyModal(false);
        setOtpCode('');
        showToast('Email verified successfully!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired verification code.';
      setVerifyError(msg);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!oldPassword) {
      setPasswordError('Current password is required.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await changePasswordApi({
        oldPassword,
        newPassword,
      });
      if (res.success) {
        setPasswordSuccess('Password updated successfully!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast('Password updated successfully!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password. Check current password.';
      setPasswordError(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  // Toggle Email Alerts
  const handleToggleAlert = async () => {
    const nextEmailAlerts = !emailAlerts;

    // Optimistic UI state update
    setEmailAlerts(nextEmailAlerts);
    setUpdatingAlert(true);

    try {
      const res = await updateProfile(
        {
          emailNotifications: nextEmailAlerts,
        },
        { silent: true }
      );

      if (res?.success) {
        showToast(
          nextEmailAlerts
            ? 'Email alerts enabled! You will receive lead and inquiry notifications.'
            : 'Email alerts disabled.',
          'success'
        );
      } else {
        // Rollback on failure
        setEmailAlerts(!nextEmailAlerts);
        showToast(res?.message || 'Failed to update alert preferences.', 'error');
      }
    } catch (err) {
      setEmailAlerts(!nextEmailAlerts);
      const errMsg = err.response?.data?.message || 'Failed to update alert preferences.';
      showToast(errMsg, 'error');
    } finally {
      setUpdatingAlert(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Account Security & Verification Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Account Security &amp; Verification</h3>
              <p className="text-xs text-slate-500">Manage email verification status and multi-factor authentication</p>
            </div>
          </div>
        </div>

        {/* Email Verification Row */}
        <div className="py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Email Address</span>
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3 h-3" /> Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email || 'No email associated'}</p>
            </div>
          </div>

          {!emailVerified && (
            <button
              type="button"
              onClick={handleSendVerifyOtp}
              disabled={sendingVerifyOtp}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {sendingVerifyOtp && <RefreshCw className="w-3 h-3 animate-spin" />}
              Verify Email
            </button>
          )}
        </div>

        {/* Two-Factor Authentication Row */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Two-Factor Authentication (2FA)</span>
                {twoFactorActive ? (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Require a 6-digit one-time code sent to your registered email on every sign-in.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle2FA}
            disabled={twoFactorLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
              twoFactorActive ? 'bg-blue-600' : 'bg-slate-200'
            } disabled:opacity-50`}
            role="switch"
            aria-checked={twoFactorActive}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                twoFactorActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. Change Password Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Change Password</h3>
            <p className="text-xs text-slate-500">Update your account password to maintain maximum security</p>
          </div>
        </div>

        {passwordError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4 max-w-lg">
          <div>
            <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Current Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={changingPassword}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {changingPassword && <RefreshCw className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>

      {/* 3. Alert & Notification Preferences */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-3.5 shadow-sm">
        <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Alert &amp; Notification Preferences</h3>
            <p className="text-xs text-slate-500">Configure how and when EstateXplorer notifies you</p>
          </div>
        </div>

        <div className="pt-3.5 pb-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
              <Mail className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900">Email Notifications</p>
                {emailAlerts && (
                  <span className="inline-flex items-center gap-1 text-[0.68rem] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Check className="w-3 h-3" /> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Receive lead alerts, inquiry updates, and status notices</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleAlert}
            disabled={updatingAlert}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 self-center ${
              emailAlerts ? 'bg-blue-600' : 'bg-slate-200'
            } ${updatingAlert ? 'opacity-50' : ''}`}
            role="switch"
            aria-checked={emailAlerts}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                emailAlerts ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Inline Email Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => {
                setShowVerifyModal(false);
                setVerifyError('');
                setOtpCode('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pb-2">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Verify Your Email Address</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter the 6-digit code sent to <strong className="text-slate-800">{user?.email}</strong>
              </p>
            </div>

            {verifyError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
                className="w-full text-center text-2xl font-bold tracking-widest py-3 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {verifyingOtp && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirm &amp; Verify
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleSendVerifyOtp}
                  disabled={sendingVerifyOtp}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SecuritySettingsSection;
