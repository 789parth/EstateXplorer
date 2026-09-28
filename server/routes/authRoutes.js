const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  logout,
  refresh,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
  updateProfile,
  changePassword,
  googleAuth,
  deleteAccount,
  requestRole,
  getMyRoleRequests,
  switchRole,
  verify2FALogin,
  resend2FA,
  toggleTwoFactor,
  sendVerifyEmailOTP,
  verifyEmail,
  sendRegistrationOTP,
  verifyRegistrationOTP,
  sendPhoneVerificationOTP,
  verifyPhoneOTP,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validateMiddleware');
const { authRateLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

router.post(
  '/register',
  authRateLimiter,
  [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 chars'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['buyer', 'owner', 'builder', 'agent', 'admin']).withMessage('Invalid role'),
    validate,
  ],
  register
);

router.post(
  '/register-send-otp',
  authRateLimiter,
  [
    body('name').notEmpty().withMessage('Name is required').isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 chars'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['buyer', 'owner', 'builder', 'agent', 'admin']).withMessage('Invalid role'),
    validate,
  ],
  sendRegistrationOTP
);

router.post(
  '/register-verify-otp',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('name').notEmpty().withMessage('Name is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('code').optional().isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verifyRegistrationOTP
);

router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').optional().isIn(['buyer', 'owner', 'builder', 'agent', 'admin']).withMessage('Invalid role'),
    validate,
  ],
  login
);

router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', protect, getMe);
router.delete('/delete-account', protect, deleteAccount);

router.post(
  '/forgot-password',
  authRateLimiter,
  [body('email').isEmail().withMessage('Please provide a valid email'), validate],
  forgotPassword
);

router.post(
  '/verify-otp',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate,
  ],
  verifyOtp
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate,
  ],
  resetPassword
);

router.patch('/update-profile', protect, updateProfile);
router.put('/profile', protect, updateProfile);

router.patch(
  '/change-password',
  [
    protect,
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body().custom((value, { req }) => {
      if (!req.body.oldPassword && !req.body.currentPassword) {
        throw new Error('Current password is required');
      }
      return true;
    }),
    validate,
  ],
  changePassword
);
router.put(
  '/change-password',
  [
    protect,
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body().custom((value, { req }) => {
      if (!req.body.oldPassword && !req.body.currentPassword) {
        throw new Error('Current password is required');
      }
      return true;
    }),
    validate,
  ],
  changePassword
);

// Two-Factor Authentication
router.post(
  '/verify-2fa',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verify2FALogin
);
router.post(
  '/resend-2fa',
  authRateLimiter,
  [body('email').isEmail().withMessage('Please provide a valid email'), validate],
  resend2FA
);
router.patch('/toggle-2fa', protect, toggleTwoFactor);

// Email Verification
router.post('/send-verify-email', protect, authRateLimiter, sendVerifyEmailOTP);
router.post(
  '/verify-email',
  protect,
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verifyEmail
);

// Mobile Phone OTP Verification (Twilio)
router.post('/send-phone-otp', protect, authRateLimiter, sendPhoneVerificationOTP);
router.post(
  '/verify-phone-otp',
  protect,
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
    validate,
  ],
  verifyPhoneOTP
);

// Role access request and switching
router.post('/request-role', protect, requestRole);
router.get('/my-role-requests', protect, getMyRoleRequests);
router.post('/switch-role', protect, switchRole);

// Google OAuth
router.post('/google', googleAuth);

module.exports = router;
