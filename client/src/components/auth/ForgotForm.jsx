import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import { forgotPasswordApi } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';

const ForgotForm = ({ onOtpSent, onBackToLogin, onSuccess }) => {
  const { showToast } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await forgotPasswordApi(data.email);
      if (res.success) {
        showToast(res.message || 'If the account exists, a password reset email has been sent.', 'success');
        if (onOtpSent) onOtpSent(data.email);
        if (onSuccess) onSuccess(data.email);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send OTP email', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      <p className="text-xs text-muted leading-relaxed">
        Enter your registered email address below and we'll send you a 6-digit OTP to reset your password.
      </p>

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

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={submitting}
        className="mt-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
      >
        Send Reset OTP
      </Button>

      {onBackToLogin && (
        <p className="text-center text-xs sm:text-sm text-slate-500 mt-4 pt-1">
          Remember password?{' '}
          <button
            type="button"
            onClick={onBackToLogin}
            className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
          >
            Back to Login
          </button>
        </p>
      )}
    </form>
  );
};

export default ForgotForm;
