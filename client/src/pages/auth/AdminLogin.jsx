import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ShieldAlert, ShieldCheck, Lock, Mail, KeyRound, AlertTriangle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { adminLogin, verify2FALogin, resend2FA, user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // 2FA state
  const [require2FA, setRequire2FA] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSubmitting, setTwoFactorSubmitting] = useState(false);
  const [resending2FA, setResending2FA] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // If already authenticated as admin, directly navigate to /admin
  React.useEffect(() => {
    if (user && (user.role === 'admin' || user.roles?.includes('admin'))) {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (data) => {
    setServerError('');
    setSubmitting(true);
    const result = await adminLogin({
      email: data.email,
      password: data.password,
    });
    setSubmitting(false);

    if (result?.require2FA) {
      setRequire2FA(true);
      setTwoFactorEmail(result.email || data.email);
      return;
    }

    if (result?.success) {
      navigate('/admin', { replace: true });
    } else if (result?.message) {
      setServerError(result.message);
    }
  };

  const handleVerify2FACode = async (e) => {
    e.preventDefault();
    if (!twoFactorCode || twoFactorCode.trim().length !== 6) {
      setServerError('Please enter the complete 6-digit administrative verification code');
      return;
    }
    setServerError('');
    setTwoFactorSubmitting(true);
    const result = await verify2FALogin(twoFactorEmail, twoFactorCode.trim(), 'admin');
    setTwoFactorSubmitting(false);

    if (result?.success) {
      navigate('/admin', { replace: true });
    } else if (result?.message) {
      setServerError(result.message);
    }
  };

  const handleResendCode = async () => {
    setServerError('');
    setResending2FA(true);
    const res = await resend2FA(twoFactorEmail);
    setResending2FA(false);
    if (res?.success) {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* High-security cryptographic ambient pattern with Blue & Green glows */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-r from-blue-600/15 via-emerald-500/15 to-teal-500/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[450px] h-[300px] bg-emerald-600/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Top Security Header */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-mono font-bold text-sm tracking-wider text-white uppercase">
              EstateXplorer Internal Portal
            </div>
            <div className="text-[10px] font-mono text-emerald-400 font-semibold tracking-widest uppercase flex items-center gap-1.5">
              <span>Level 4 Restricted Area</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-blue-400">Auth Guard Active</span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-emerald-500/30 text-[11px] font-mono text-slate-300 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          <span>SYSTEM_ONLINE: SECURE_CHANNEL_TLS</span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-[460px] bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl p-6 sm:p-8 relative">
          {/* Internal Security Badge with Material Blue/Green/White */}
          <div className="flex items-center justify-center mb-6">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-blue-500/15 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2 font-mono">
              Administrative Console
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              This entrance is strictly restricted to designated system administrators. Unauthorized access attempts are monitored and recorded.
            </p>
          </div>

          {serverError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">A new administrative 2FA verification code has been dispatched to your email.</div>
            </div>
          )}

          {!require2FA ? (
            /* Admin Password Login Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  Admin Identity / Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder="admin@estatexplorer.com"
                    autoComplete="username"
                    {...register('email', {
                      required: 'Administrative email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid administrative email address',
                      },
                    })}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono transition-all"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-400 mt-1 font-mono">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  Security Passkey / Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    {...register('password', {
                      required: 'Administrative password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 font-mono transition-all"
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-400 mt-1 font-mono">{errors.password.message}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:via-teal-500 hover:to-blue-500 text-white font-mono font-bold text-sm shadow-lg shadow-emerald-950/50 border border-emerald-400/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Admin Portal</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* 2FA Verification Form */
            <form onSubmit={handleVerify2FACode} className="space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono mb-2">
                Verification token sent to: <span className="text-emerald-400 font-bold">{twoFactorEmail}</span>
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  6-Digit Admin Security OTP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-center text-lg tracking-[0.4em] font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRequire2FA(false);
                    setServerError('');
                  }}
                  className="text-slate-400 hover:text-slate-200 font-mono transition-colors cursor-pointer"
                >
                  &larr; Re-enter credentials
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending2FA}
                  className="text-blue-400 hover:text-blue-300 font-mono disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {resending2FA && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Resend Security Code
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={twoFactorSubmitting || twoFactorCode.length !== 6}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:via-teal-500 hover:to-blue-500 text-white font-mono font-bold text-sm shadow-lg shadow-emerald-950/50 border border-emerald-400/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {twoFactorSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying Token...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Validate & Establish Session</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer note inside card */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 font-mono">
              IP & Device Fingerprint Logged for Audit Compliance
            </p>
          </div>
        </div>
      </main>

      {/* Security Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800/60 bg-slate-950/40 px-6 py-3 text-center">
        <p className="text-[11px] text-slate-500 font-mono">
          EstateXplorer Administrative Infrastructure &bull; Confidential &bull; All Rights Reserved
        </p>
      </footer>
    </div>
  );
};

export default AdminLogin;
