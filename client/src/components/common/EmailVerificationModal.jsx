import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, AlertCircle, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { sendVerifyEmailOtpApi, verifyEmailOtpApi } from '../../services/authService';

const EmailVerificationModal = ({
  isOpen,
  onClose,
  onVerified,
  actionType = 'visit', // 'visit' | 'inquiry' | 'project'
  propertyTitle = '',
}) => {
  const { user, setUser, refreshUser, showToast } = useAuth();
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setSuccessMsg('');
      setOtpCode('');
      // Auto-trigger OTP send if not already sent
      if (!otpSent) {
        handleSendOtp();
      }
    }
  }, [isOpen]);

  // Countdown timer for resend
  useEffect(() => {
    let timer = null;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    try {
      setSendingOtp(true);
      setErrorMsg('');
      const res = await sendVerifyEmailOtpApi();
      if (res.success) {
        setOtpSent(true);
        setCountdown(60);
        showToast('Verification code sent to your email!', 'info');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification code. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setVerifying(true);
      setErrorMsg('');
      const res = await verifyEmailOtpApi(otpCode.trim());
      if (res.success) {
        setSuccessMsg('Email verified successfully!');
        if (setUser) {
          setUser((prev) => (prev ? { ...prev, isVerified: true } : prev));
        }
        if (refreshUser) {
          refreshUser();
        }
        showToast('Email verified successfully! You can now proceed.', 'success');

        setTimeout(() => {
          onClose();
          if (onVerified) {
            onVerified();
          }
        }, 1200);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired verification code.';
      setErrorMsg(msg);
    } finally {
      setVerifying(false);
    }
  };

  const actionLabel = actionType === 'visit'
    ? 'Book Site Visits'
    : actionType === 'project'
    ? 'Book Project Inquiries'
    : 'Submit Inquiries';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative text-left border border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pb-2">
          <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-3.5 shadow-sm border border-blue-100">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Email Verification Required</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            To ensure genuine bookings and prevent spam, please verify your email address before you {actionLabel.toLowerCase()}
            {propertyTitle ? <span> for <strong className="text-slate-800">{propertyTitle}</strong></span> : ''}.
          </p>
        </div>

        {/* User Email Pill */}
        <div className="my-4 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-700 truncate">
            <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="font-semibold truncate">{user?.email || 'Your email address'}</span>
          </div>
          <span className="text-[0.68rem] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0">
            Unverified
          </span>
        </div>

        {/* Feedback banners */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* OTP Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-center">
              Enter 6-Digit Verification Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
              className="w-full text-center text-2xl font-bold tracking-[0.3em] py-3 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={verifying || otpCode.length !== 6}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow"
          >
            {verifying && <RefreshCw className="w-4 h-4 animate-spin" />}
            {verifying ? 'Verifying Code...' : 'Verify Email & Continue'}
          </button>

          <div className="text-center pt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Didn't receive the code?</span>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp || countdown > 0}
              className="font-semibold text-blue-600 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
            >
              {sendingOtp
                ? 'Sending OTP...'
                : countdown > 0
                ? `Resend in ${countdown}s`
                : 'Resend Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailVerificationModal;
