import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { KeyRound, Lock } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import { resetPasswordApi } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';

const ResetForm = ({ email, onSuccess, onBackToLogin }) => {
  const { showToast, setUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { email },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await resetPasswordApi(email, data.code, data.newPassword);
      if (res.success) {
        if (res.data?.user) setUser(res.data.user);
        showToast('Password reset successfully!', 'success');
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Invalid or expired OTP code', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      <p className="text-xs text-muted leading-relaxed">
        Enter the 6-digit OTP code sent to <strong className="text-navy">{email}</strong> and set your new password.
      </p>

      <Input
        label="6-Digit OTP Code"
        type="text"
        placeholder="123456"
        icon={KeyRound}
        maxLength={6}
        error={errors.code?.message}
        {...register('code', {
          required: 'OTP code is required',
          minLength: { value: 6, message: 'Must be 6 digits' },
          maxLength: { value: 6, message: 'Must be 6 digits' },
        })}
      />

      <Input
        label="New Password"
        type="password"
        placeholder="••••••••"
        icon={Lock}
        error={errors.newPassword?.message}
        {...register('newPassword', {
          required: 'New password is required',
          minLength: { value: 6, message: 'Minimum 6 characters' },
        })}
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={submitting}
        className="mt-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99]"
      >
        Reset Password
      </Button>

      {onBackToLogin && (
        <p className="text-center text-xs sm:text-sm text-slate-500 mt-4 pt-1">
          Back to{' '}
          <button
            type="button"
            onClick={onBackToLogin}
            className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
          >
            Login
          </button>
        </p>
      )}
    </form>
  );
};

export default ResetForm;
