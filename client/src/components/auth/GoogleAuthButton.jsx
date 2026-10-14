import React, { useState, useEffect, useRef } from 'react';
import { Phone, X, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const RAW_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_ID =
  RAW_GOOGLE_CLIENT_ID &&
  !RAW_GOOGLE_CLIENT_ID.includes('your_google_') &&
  RAW_GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')
    ? RAW_GOOGLE_CLIENT_ID
    : '187470311176-40peqhlrvqs7e6dqckgfc9o62ub0vqom.apps.googleusercontent.com';

/**
 * Loads Google Identity Services (GIS) script.
 */
let gsiLoadingPromise = null;
const loadGsiScript = () => {
  if (window.google?.accounts?.id || window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gsiLoadingPromise) {
    return gsiLoadingPromise;
  }
  gsiLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts) {
        return resolve();
      }
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In script'));
    document.head.appendChild(script);
  });
  return gsiLoadingPromise;
};

const GoogleAuthButton = ({
  onSuccess,
  role = 'buyer',
  label = 'Continue with Google',
  intent = 'login',
  onNotRegistered,
  onAlreadyRegistered,
}) => {
  const { googleLogin, showToast } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const watchdogTimerRef = useRef(null);
  const focusListenerRef = useRef(null);

  const cleanupWatchers = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (focusListenerRef.current) {
      window.removeEventListener('focus', focusListenerRef.current);
      focusListenerRef.current = null;
    }
  };

  useEffect(() => {
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      loadGsiScript().catch((err) => {
        console.warn('Google Identity Services script load:', err.message);
      });
    }
    return () => {
      cleanupWatchers();
    };
  }, []);

  const handleClick = async () => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      showToast('Google Client ID is not configured', 'error');
      return;
    }

    cleanupWatchers();
    setLoading(true);

    // Watchdog: reset loading after 25s if abandoned
    watchdogTimerRef.current = setTimeout(() => {
      setLoading(false);
      cleanupWatchers();
    }, 25000);

    // Window focus watcher: when user closes or switches back from popup, cancel loading
    const handleWindowFocus = () => {
      setTimeout(() => {
        setLoading(false);
        cleanupWatchers();
      }, 1200);
    };

    try {
      await loadGsiScript();

      if (!window.google?.accounts) {
        throw new Error('Google Identity Services not ready');
      }

      // 1. Try Google OAuth2 Popup Token Flow
      if (window.google.accounts.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          error_callback: (err) => {
            console.warn('Google OAuth error callback:', err);
            setLoading(false);
            cleanupWatchers();
          },
          callback: async (tokenResponse) => {
            cleanupWatchers();
            if (!tokenResponse || tokenResponse.error) {
              setLoading(false);
              return;
            }

            try {
              // Fetch user profile from Google using the access token
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });
              const userInfo = await userInfoRes.json();

              if (!userInfo || !userInfo.email) {
                throw new Error('Failed to retrieve user information from Google');
              }

              const result = await googleLogin(
                {
                  email: userInfo.email,
                  name: userInfo.name || userInfo.email.split('@')[0],
                  picture: userInfo.picture || '',
                  googleId: userInfo.sub || `google_${userInfo.email}`,
                },
                role,
                intent
              );

              if (result?.requiresPhone) {
                setPendingGoogleUser(result.googleUser || {
                  email: userInfo.email,
                  name: userInfo.name || userInfo.email.split('@')[0],
                  picture: userInfo.picture || '',
                  googleId: userInfo.sub || `google_${userInfo.email}`,
                });
                setPhoneInput('');
                setPhoneError('');
                setShowPhoneModal(true);
                return;
              }

              if (result?.notRegistered && onNotRegistered) {
                onNotRegistered(result.email || userInfo.email);
                return;
              }

              if (result?.alreadyRegistered) {
                if (onAlreadyRegistered) {
                  onAlreadyRegistered(result.email || userInfo.email);
                } else {
                  showToast(result.message || 'An account with this email already exists. Please log in.', 'error');
                }
                return;
              }

              if (result?.success && onSuccess) {
                onSuccess();
              }
            } catch (authErr) {
              const resData = authErr.response?.data;
              if (resData?.requiresPhone) {
                setPendingGoogleUser(resData.googleUser || {
                  email: resData.email,
                  name: resData.name,
                  picture: resData.picture,
                  googleId: resData.googleId,
                });
                setPhoneInput('');
                setPhoneError('');
                setShowPhoneModal(true);
                return;
              }
              if (resData?.notRegistered && onNotRegistered) {
                onNotRegistered(resData.email || '');
                return;
              }
              if (resData?.alreadyRegistered) {
                if (onAlreadyRegistered) {
                  onAlreadyRegistered(resData.email || '');
                } else {
                  showToast(resData.message || 'An account with this email already exists. Please log in.', 'error');
                }
                return;
              }
              const msg = resData?.message || authErr.message || 'Google sign-in failed.';
              showToast(msg, 'error');
            } finally {
              setLoading(false);
            }
          },
        });

        // Attach focus listener right before launching popup
        focusListenerRef.current = handleWindowFocus;
        window.addEventListener('focus', handleWindowFocus);

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }

      // 2. Fallback to Google ID One Tap / Prompt
      if (window.google.accounts.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            cleanupWatchers();
            if (response.credential) {
              const result = await googleLogin(response.credential, role, intent);
              if (result?.requiresPhone) {
                setPendingGoogleUser(result.googleUser || { idToken: response.credential });
                setPhoneInput('');
                setPhoneError('');
                setShowPhoneModal(true);
                setLoading(false);
                return;
              }
              if (result?.notRegistered && onNotRegistered) {
                onNotRegistered(result.email || '');
                setLoading(false);
                return;
              }
              if (result?.alreadyRegistered) {
                if (onAlreadyRegistered) {
                  onAlreadyRegistered(result.email || '');
                } else {
                  showToast(result.message || 'An account with this email already exists. Please log in.', 'error');
                }
                setLoading(false);
                return;
              }
              if (result?.success && onSuccess) {
                onSuccess();
              }
            }
            setLoading(false);
          },
        });

        window.google.accounts.id.prompt((notification) => {
          if (
            notification.isNotDisplayed() ||
            notification.isSkippedMoment() ||
            notification.isDismissedMoment()
          ) {
            setLoading(false);
            cleanupWatchers();
          }
        });
      }
    } catch (err) {
      console.error('Google sign-in trigger error:', err);
      showToast('Unable to open Google sign-in window. Please try again.', 'error');
      setLoading(false);
      cleanupWatchers();
    }
  };

  const handlePhoneSubmit = async (e) => {
    if (e) e.preventDefault();
    const clean = phoneInput.replace(/\D/g, '').slice(-10);
    if (!clean || clean.length !== 10 || !/^[6-9]\d{9}$/.test(clean)) {
      setPhoneError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setPhoneSubmitting(true);
    setPhoneError('');

    try {
      const payload = typeof pendingGoogleUser === 'string'
        ? { idToken: pendingGoogleUser, phone: clean }
        : { ...pendingGoogleUser, phone: clean };

      const res = await googleLogin(payload, role, 'register');
      if (res?.success) {
        setShowPhoneModal(false);
        setPendingGoogleUser(null);
        if (onSuccess) onSuccess();
      } else {
        setPhoneError(res?.message || 'Registration failed with this mobile number.');
      }
    } catch (err) {
      setPhoneError(err.response?.data?.message || err.message || 'Failed to complete registration.');
    } finally {
      setPhoneSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200/90 rounded-xl bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold transition-all duration-150 shadow-xs hover:shadow active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
        )}
        <span>{loading ? 'Opening Google…' : label}</span>
      </button>

      {/* Google First-Time Registration Phone Number Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Complete Registration</h3>
                  <p className="text-xs text-slate-500">Provide your mobile number to set up your account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPhoneModal(false);
                  setPendingGoogleUser(null);
                  setLoading(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Google Profile Preview */}
            {pendingGoogleUser && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                {pendingGoogleUser.picture ? (
                  <img
                    src={pendingGoogleUser.picture}
                    alt={pendingGoogleUser.name || 'User'}
                    className="w-10 h-10 rounded-full border border-slate-300 object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                    {(pendingGoogleUser.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="font-bold text-slate-900 text-xs truncate">{pendingGoogleUser.name || 'Google User'}</div>
                  <div className="text-[11px] text-slate-500 truncate">{pendingGoogleUser.email}</div>
                  <div className="text-[10px] text-blue-600 font-semibold uppercase mt-0.5">Role: {role}</div>
                </div>
              </div>
            )}

            {phoneError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {phoneError}
              </div>
            )}

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative flex rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-600">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhoneInput(val);
                      if (phoneError) setPhoneError('');
                    }}
                    placeholder="9876543210"
                    className="w-full px-3 py-2.5 text-xs text-slate-900 focus:outline-hidden"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter your 10-digit mobile number for account verification &amp; updates.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={phoneSubmitting}
                  onClick={() => {
                    setShowPhoneModal(false);
                    setPendingGoogleUser(null);
                    setLoading(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={phoneSubmitting || phoneInput.length !== 10}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {phoneSubmitting ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleAuthButton;
