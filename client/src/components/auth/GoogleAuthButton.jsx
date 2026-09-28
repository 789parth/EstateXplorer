import React, { useState, useEffect, useRef } from 'react';
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
}) => {
  const { googleLogin, showToast } = useAuth();
  const [loading, setLoading] = useState(false);
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

              if (result?.notRegistered && onNotRegistered) {
                onNotRegistered(result.email || userInfo.email);
                return;
              }

              if (result?.success && onSuccess) {
                onSuccess();
              }
            } catch (authErr) {
              const resData = authErr.response?.data;
              if (resData?.notRegistered && onNotRegistered) {
                onNotRegistered(resData.email || '');
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
              if (result?.notRegistered && onNotRegistered) {
                onNotRegistered(result.email || '');
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

  return (
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
  );
};

export default GoogleAuthButton;
