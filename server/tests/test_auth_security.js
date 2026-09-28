/**
 * EstateXplorer - Auth & Security Unit Verification Script
 * Validates:
 * 1. User schema fields: twoFactorEnabled, emailNotifications, smsNotifications
 * 2. OTP schema purpose: two_factor, email_verify, password_reset
 * 3. authController exports: verify2FALogin, resend2FA, toggleTwoFactor, sendVerifyEmailOTP, verifyEmail, updatePassword, updateProfile
 * 4. authRoutes route definitions: verify-2fa, resend-2fa, toggle-2fa, send-verify-email, verify-email, change-password
 */

const assert = require('assert');

console.log('--- Starting Auth & Security Verification ---');

// 1. Check User model
const User = require('../models/User');
const userPaths = User.schema.paths;
assert(userPaths.twoFactorEnabled, 'User schema must have twoFactorEnabled');
assert.strictEqual(userPaths.twoFactorEnabled.defaultValue, false, 'twoFactorEnabled must default to false');
assert(userPaths.emailNotifications, 'User schema must have emailNotifications');
assert.strictEqual(userPaths.emailNotifications.defaultValue, true, 'emailNotifications must default to true');
assert(userPaths.smsNotifications, 'User schema must have smsNotifications');
assert.strictEqual(userPaths.smsNotifications.defaultValue, false, 'smsNotifications must default to false');
console.log('✅ User schema fields verified.');

// 2. Check OTP model
const OTP = require('../models/OTP');
const otpPurposeEnum = OTP.schema.paths.purpose.enumValues;
assert(otpPurposeEnum.includes('two_factor'), 'OTP schema must include two_factor purpose');
assert(otpPurposeEnum.includes('email_verify'), 'OTP schema must include email_verify purpose');
assert(otpPurposeEnum.includes('password_reset'), 'OTP schema must include password_reset purpose');
console.log('✅ OTP schema purpose enum verified.');

// 3. Check authController exports
const authController = require('../controllers/authController');
const expectedFunctions = [
  'login',
  'register',
  'verify2FALogin',
  'resend2FA',
  'toggleTwoFactor',
  'sendVerifyEmailOTP',
  'verifyEmail',
  'sendRegistrationOTP',
  'verifyRegistrationOTP',
  'sendPhoneVerificationOTP',
  'verifyPhoneOTP',
  'updatePassword',
  'updateProfile',
  'getMe',
  'refresh',
];

for (const fn of expectedFunctions) {
  assert(typeof authController[fn] === 'function', `authController.${fn} must be a function`);
}
console.log('✅ authController exported functions verified.');

// 4. Check authRoutes
const authRoutes = require('../routes/authRoutes');
const routes = [];
authRoutes.stack.forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
    routes.push(`${methods} ${layer.route.path}`);
  }
});

const requiredRoutes = [
  'POST /verify-2fa',
  'POST /resend-2fa',
  'PATCH /toggle-2fa',
  'POST /send-verify-email',
  'POST /verify-email',
  'POST /send-phone-otp',
  'POST /verify-phone-otp',
  'POST /register-send-otp',
  'POST /register-verify-otp',
  'PATCH /change-password',
  'PUT /change-password',
  'PATCH /update-profile',
  'PUT /profile',
];

for (const reqRoute of requiredRoutes) {
  assert(
    routes.includes(reqRoute),
    `Route ${reqRoute} must be registered in authRoutes. Registered: ${routes.join('; ')}`
  );
}
console.log('✅ All required auth routes verified:');
requiredRoutes.forEach(r => console.log('   - ' + r));

// 5. Test login returns 404 notRegistered when user is not in database
let mockResStatus = null;
let mockResJson = null;
const mockRes = {
  status(code) {
    mockResStatus = code;
    return {
      json(data) {
        mockResJson = data;
        return data;
      },
    };
  },
};
const mockReq = {
  body: {
    email: 'unregistered_test_user_xyz@testdomain123.com',
    password: 'password123',
    role: 'buyer',
  },
};

// Stub User.findOne to resolve to null (simulating user not in database)
User.findOne = () => ({
  select: () => Promise.resolve(null),
});

authController
  .login(mockReq, mockRes, (err) => {
    if (err) console.error('Next called with error:', err);
  })
  .then(() => {
    assert.strictEqual(mockResStatus, 404, 'Status must be 404 for unregistered user');
    assert.strictEqual(mockResJson.notRegistered, true, 'Response must include notRegistered: true');
    console.log('✅ login unregistered user test passed: returns 404 with notRegistered: true');
    console.log('--- ALL AUTH & SECURITY TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
