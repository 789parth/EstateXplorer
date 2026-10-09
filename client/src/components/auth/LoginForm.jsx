import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Mail, Lock, ShieldCheck, ArrowLeft, RefreshCw, UserX, UserPlus, X, AlertTriangle, Lightbulb } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import RoleSelect from './RoleSelect';
import GoogleAuthButton from './GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';

const LoginForm = ({ onSuccess, onSwitchToRegister, onSwitchToForgot }) => {
  const navigate = useNavigate();
  const { login, verify2FALogin, resend2FA } = useAuth();
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // 2FA state
  const [require2FA, setRequire2FA] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorRole, setTwoFactorRole] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false);
  const [resending2FA, setResending2FA] = useState(false);

  // Not Registered Pop-up Modal state
  const [showNotRegisteredModal, setShowNotRegisteredModal] = useState(false);
  const [unregisteredEmail, setUnregisteredEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setServerError('');
    setSubmitting(true);
    const result = await login({
      ...data,
      role: selectedRole,
    });
    setSubmitting(false);

    if (result?.require2FA) {
      setRequire2FA(true);
      setTwoFactorEmail(result.email || data.email);
      setTwoFactorRole(result.role || selectedRole);
      return;
    }

    if (result?.notRegistered) {
      const emailNotFound = result.email || data.email;
      setUnregisteredEmail(emailNotFound);
      setShowNotRegisteredModal(true);
      setServerError(`No account found with ${emailNotFound}. Please register to continue.`);
      return;
    }

    if (result?.isAdminAccount) {
      // Per strict requirement: Only show pop up that user is invalid (admin cannot login through normal login), no persistent banner or other modals
      setServerError('');
      return;
    }

    if (result?.success && onSuccess) {
      onSuccess();
    } else if (!result?.success && result?.message) {
      setServerError(result.message);
    }
  };

  const handleProceedToRegister = () => {
    setShowNotRegisteredModal(false);
    if (onSwitchToRegister) {
      onSwitchToRegister(unregisteredEmail);
    } else {
      navigate('/register', { state: { email: unregisteredEmail } });
    }
  };

  const handleVerify2FACode = async (e) => {
    e.preventDefault();
    if (!twoFactorCode || twoFactorCode.trim().length !== 6) {
      setServerError('Please enter the complete 6-digit verification code');
      return;
    }
    setServerError('');
    setTwoFactorSubmitting(true);
    const result = await verify2FALogin(twoFactorEmail, twoFactorCode.trim(), twoFactorRole);
    setTwoFactorSubmitting(false);

    if (result?.success && onSuccess) {
      onSuccess();
    } else if (!result?.success && result?.message) {
      setServerError(result.message);
    }
  };

  const handleResendCode = async () => {
    setServerError('');
    setResending2FA(true);
    await resend2FA(twoFactorEmail);
    setResending2FA(false);
  };

  if (require2FA) {
    return (
      <div className="space-y-4 text-left">
        <div className="text-center pb-2">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Two-Factor Authentication</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            A 6-digit verification code has been sent to{' '}
            <strong className="text-slate-800">{twoFactorEmail}</strong>
          </p>
        </div>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 text-red-500 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleVerify2FACode} className="space-y-4">
          <div>
            <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              6-Digit Security Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoFocus
              className="w-full text-center text-2xl font-bold tracking-widest py-3 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={twoFactorSubmitting}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
          >
            Verify & Sign In
          </Button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => {
              setRequire2FA(false);
              setTwoFactorCode('');
              setServerError('');
            }}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </button>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={resending2FA}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending2FA ? 'animate-spin' : ''}`} />
            Resend Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      {serverError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-start gap-2.5">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-500" />
          <div className="flex-1">
            <span>{serverError}</span>
            {unregisteredEmail && (
              <button
                type="button"
                onClick={handleProceedToRegister}
                className="block mt-1.5 font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Create an account with this email &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Role Selection */}
      <RoleSelect
        selectedRole={selectedRole}
        onSelectRole={setSelectedRole}
        title="Select Role to Login As"
      />

      {/* Google Sign-In */}
      <GoogleAuthButton
        onSuccess={onSuccess}
        role={selectedRole}
        label="Continue with Google"
        intent="login"
        onNotRegistered={(email) => {
          setUnregisteredEmail(email || '');
          setShowNotRegisteredModal(true);
        }}
      />

      {/* Divider */}
      <div className="relative flex items-center my-3.5">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="shrink-0 px-3 text-[0.72rem] font-semibold tracking-wider uppercase text-slate-400 bg-white">
          or sign in with email
        </span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="name@example.com"
          icon={Mail}
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^\S+@\S+$/i,
              message: 'Please enter a valid email',
            },
          })}
        />

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider">
              Password
            </span>
            {onSwitchToForgot && (
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <Input
            type="password"
            placeholder="••••••••"
            icon={Lock}
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Minimum 6 characters required',
              },
            })}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={submitting}
          className="mt-3 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
        >
          Sign In
        </Button>
      </form>

      {onSwitchToRegister && (
        <p className="text-center text-xs sm:text-sm text-slate-500 mt-5 pt-1">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
          >
            Create Account
          </button>
        </p>
      )}

      {/* Not Registered Pop-up Modal */}
      {showNotRegisteredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 relative text-center">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowNotRegisteredModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Warning / User Icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/80 shadow-sm">
              <UserX className="w-8 h-8" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Account Not Registered
            </h3>

            {/* Explanation */}
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              We couldn't find an account registered with{' '}
              <strong className="text-slate-900 font-semibold break-all">{unregisteredEmail}</strong>.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 mb-6 text-left flex items-start gap-2.5">
              <Lightbulb size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <span>
                You haven't signed up on EstateXplorer yet. Create a free account now to browse, save properties, book site visits, or manage listings.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={handleProceedToRegister}
                className="py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Register New Account
              </Button>

              <button
                type="button"
                onClick={() => setShowNotRegisteredModal(false)}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Try Another Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
