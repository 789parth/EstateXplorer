import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  Edit3,
  Check,
  X,
  Info,
} from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import RoleSelect from './RoleSelect';
import GoogleAuthButton from './GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';

const RegisterForm = ({ onSuccess, onSwitchToLogin, initialEmail = '' }) => {
  const { sendRegistrationOtp, verifyRegistrationOtp } = useAuth();
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // OTP Step state
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [pendingData, setPendingData] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);

  // Password focus and confirmation state
  const [passwordFocused, setPasswordFocused] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, touchedFields },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      email: initialEmail || '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password', '') || '';
  const confirmPasswordValue = watch('confirmPassword', '') || '';

  // Google password requirements:
  // 1. At least 8 characters
  // 2. Contains uppercase & lowercase letters
  // 3. Contains numbers
  // 4. Contains symbols
  const passwordCriteria = [
    {
      id: 'length',
      label: 'At least 8 characters',
      valid: passwordValue.length >= 8,
    },
    {
      id: 'mixed',
      label: 'Mix of letters (uppercase & lowercase)',
      valid: /[a-z]/.test(passwordValue) && /[A-Z]/.test(passwordValue),
    },
    {
      id: 'number',
      label: 'At least one number (0-9)',
      valid: /\d/.test(passwordValue),
    },
    {
      id: 'symbol',
      label: 'At least one symbol (!@#$%^&*...)',
      valid: /[^A-Za-z0-9]/.test(passwordValue),
    },
  ];

  const validCount = passwordCriteria.filter((c) => c.valid).length;
  const isPasswordValid = validCount === 4;

  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Strong'];
  const strengthColors = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-emerald-500',
  ];
  const strengthTextColor = [
    'text-rose-600',
    'text-amber-600',
    'text-blue-600',
    'text-emerald-600',
  ];

  useEffect(() => {
    if (initialEmail) {
      setValue('email', initialEmail);
    }
  }, [initialEmail, setValue]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer = null;
    if (step === 'otp' && resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, resendCountdown]);

  const mountTimeRef = useRef(Date.now());

  // Step 1: Submit user registration data & request email OTP
  const onSubmitForm = async (data) => {
    setServerError('');
    setSubmitting(true);
    const formTimeMs = Date.now() - mountTimeRef.current;
    const { confirmPassword, ...cleanData } = data;
    const payload = {
      ...cleanData,
      role: selectedRole,
      formTimeMs,
    };

    const result = await sendRegistrationOtp(payload);
    setSubmitting(false);

    if (result.success) {
      setPendingData(payload);
      setStep('otp');
      setResendCountdown(60);
      setOtpCode('');
      setServerError('');
    } else if (result.message) {
      setServerError(result.message);
    }
  };

  // Step 2: Verify OTP code & complete account creation (auto-logs in)
  const handleVerifyOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setServerError('Please enter the full 6-digit verification code.');
      return;
    }

    setServerError('');
    setVerifyingOtp(true);

    const payload = {
      ...pendingData,
      code: otpCode.trim(),
    };

    const result = await verifyRegistrationOtp(payload);
    setVerifyingOtp(false);

    if (result.success) {
      if (onSuccess) {
        onSuccess();
      }
    } else if (result.message) {
      setServerError(result.message);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendingOtp || resendCountdown > 0 || !pendingData) return;
    setServerError('');
    setResendingOtp(true);

    const result = await sendRegistrationOtp(pendingData);
    setResendingOtp(false);

    if (result.success) {
      setResendCountdown(60);
      setOtpCode('');
    } else if (result.message) {
      setServerError(result.message);
    }
  };

  const isTempMailBlocked = Boolean(
    serverError && /block|disposable|temporary|throwaway|provider/i.test(serverError)
  );
  const isMailboxNotExists = Boolean(
    serverError && /not exist|cannot receive|undeliverable|mail server/i.test(serverError)
  );

  // ──────────────────────────────────────────
  // VIEW: STEP 2 - OTP VERIFICATION
  // ──────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="space-y-4 text-left animate-in fade-in duration-200">
        <div className="text-center pb-1">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Verify Your Email</h2>
          <p className="text-xs text-slate-500 mt-1">
            We sent a 6-digit verification code to
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-800">
            <Mail size={13} className="text-slate-500" />
            <span>{pendingData?.email}</span>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setServerError('');
              }}
              title="Change email"
              className="text-blue-600 hover:text-blue-800 ml-1 p-0.5 cursor-pointer"
            >
              <Edit3 size={12} />
            </button>
          </div>
        </div>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
              Enter 6-Digit Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              autoFocus
              className="w-full text-center text-2xl font-bold tracking-[0.35em] py-3 px-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-900 bg-white shadow-inner font-mono"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={verifyingOtp}
            disabled={otpCode.length !== 6 || verifyingOtp}
            className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {verifyingOtp ? 'Verifying & Creating Account...' : 'Verify & Complete Registration'}
          </Button>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setServerError('');
            }}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to details
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendingOtp || resendCountdown > 0}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resendingOtp ? 'animate-spin' : ''}`} />
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend Code'}
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────
  // VIEW: STEP 1 - REGISTRATION DETAILS FORM
  // ──────────────────────────────────────────
  return (
    <div className="space-y-3 text-left">
      {serverError && (
        isTempMailBlocked ? (
          <div className="p-3.5 bg-red-50/90 border border-red-300 rounded-xl text-left space-y-1 shadow-sm">
            <div className="flex items-center gap-2 text-red-700 font-bold text-xs tracking-wide">
              <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
              <span>Access Blocked: Temporary Email Detected</span>
            </div>
            <p className="text-xs text-red-600 font-medium leading-relaxed pl-6">
              {serverError}
            </p>
            <p className="text-[0.72rem] text-slate-500 pl-6">
              Please use a verified permanent email address (e.g. Gmail, Outlook, Yahoo) to create your account.
            </p>
          </div>
        ) : isMailboxNotExists ? (
          <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl text-left space-y-1 shadow-sm">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs tracking-wide">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
              <span>Email Address Does Not Exist</span>
            </div>
            <p className="text-xs text-amber-700 font-medium leading-relaxed pl-6">
              {serverError}
            </p>
            <p className="text-[0.72rem] text-slate-500 pl-6">
              Please check for typos or enter an active email account that can receive incoming emails.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span>{serverError}</span>
          </div>
        )
      )}

      {/* Role Selection */}
      <RoleSelect
        selectedRole={selectedRole}
        onSelectRole={setSelectedRole}
        title="Select Role to Sign Up As"
      />

      {/* Google Sign-Up */}
      <GoogleAuthButton
        onSuccess={onSuccess}
        role={selectedRole}
        label="Continue with Google"
        intent="register"
      />

      {/* Divider */}
      <div className="relative flex items-center my-3.5">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="shrink-0 px-3 text-[0.72rem] font-semibold tracking-wider uppercase text-slate-400 bg-white">
          or register with email
        </span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-3.5">
        {/* Invisible anti-automation bot trap */}
        <input
          type="text"
          name="hp_website"
          tabIndex={-1}
          autoComplete="off"
          style={{ display: 'none', opacity: 0, position: 'absolute', left: '-9999px', height: 0, width: 0 }}
          {...register('hp_website')}
        />

        <Input
          label="Full Name"
          type="text"
          required
          placeholder="Priya Sharma"
          icon={User}
          error={errors.name?.message}
          {...register('name', {
            required: 'Full name is required',
            minLength: { value: 2, message: 'Minimum 2 characters' },
          })}
        />

        <Input
          label="Email Address"
          type="email"
          required
          placeholder="priya@example.com"
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

        <Input
          label="Phone Number"
          type="tel"
          required
          placeholder="9876543210"
          icon={Phone}
          error={errors.phone?.message}
          {...register('phone', {
            required: 'Phone number is required',
            validate: (val) => {
              const digits = val.replace(/\D/g, '');
              if (digits.length < 10 || digits.length > 13) {
                return 'Please enter a valid 10-digit phone number';
              }
              return true;
            },
          })}
        />

        {/* Password input with Google-standard validation */}
        <div className="space-y-1.5">
          <Input
            label="Password"
            type="password"
            required
            placeholder="••••••••"
            icon={Lock}
            error={errors.password?.message}
            onFocus={() => setPasswordFocused(true)}
            {...register('password', {
              required: 'Password is required',
              validate: {
                minLength: (v) => v.length >= 8 || 'Use 8 characters or more for your password',
                mixedCase: (v) =>
                  (/[a-z]/.test(v) && /[A-Z]/.test(v)) ||
                  'Use a mix of uppercase and lowercase letters',
                hasNumber: (v) => /\d/.test(v) || 'Include at least one number',
                hasSymbol: (v) =>
                  /[^A-Za-z0-9]/.test(v) || 'Include at least one symbol (!@#$%^&*)',
              },
            })}
          />

          {/* Google-like helper text when empty and not yet focused */}
          {!passwordValue && !errors.password && (
            <p className="text-[0.72rem] text-slate-500 pl-1 flex items-center gap-1.5">
              <Info size={12} className="text-slate-400 shrink-0" />
              <span>Use 8 or more characters with a mix of letters, numbers & symbols</span>
            </p>
          )}

          {/* Live Strength Meter & Google Requirement Checklist */}
          {passwordValue && (
            <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5 mt-1.5 transition-all">
              {/* Strength bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[0.7rem] font-semibold">
                  <span className="text-slate-500">Password strength:</span>
                  <span className={strengthTextColor[Math.max(0, validCount - 1)]}>
                    {strengthLabels[Math.max(0, validCount - 1)]}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`h-full rounded-full transition-colors duration-200 ${
                        idx < validCount
                          ? strengthColors[Math.max(0, validCount - 1)]
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Requirement Checklist */}
              <div className="pt-1 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[0.72rem]">
                {passwordCriteria.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-1.5 transition-colors ${
                      c.valid ? 'text-emerald-700 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {c.valid ? (
                      <Check size={12} className="text-emerald-600 shrink-0 stroke-[2.5]" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1 mr-0.5 shrink-0" />
                    )}
                    <span className={c.valid ? 'text-emerald-700' : 'text-slate-500'}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password input */}
        <Input
          label="Confirm Password"
          type="password"
          required
          placeholder="••••••••"
          icon={Lock}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (val) => {
              if (val !== passwordValue) {
                return 'Passwords do not match';
              }
              return true;
            },
          })}
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={submitting}
          className="mt-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
        >
          Create Account
        </Button>
      </form>

      {onSwitchToLogin && (
        <p className="text-center text-xs sm:text-sm text-slate-500 mt-5 pt-1">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
          >
            Sign In
          </button>
        </p>
      )}
    </div>
  );
};

export default RegisterForm;
