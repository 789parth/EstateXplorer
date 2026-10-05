/**
 * Verification Test Suite: Strict Phone & Email Uniqueness
 * Rule: Exactly 1 account per unique mobile number and unique email.
 */

const assert = require('assert');
const User = require('../models/User');
const authController = require('../controllers/authController');

function pass(name, detail = '') {
  console.log(`  ✅ [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runUniquePhoneAndEmailSuite() {
  console.log('\n🧪 Starting Strict Mobile & Email Uniqueness Verification Suite...\n');

  // Test 1: Verify Schema Indexes
  const phoneIndex = User.schema.indexes().find((idx) => idx[0] && idx[0].phone);
  assert.ok(phoneIndex, 'User schema must define a phone index');
  assert.strictEqual(phoneIndex[1].unique, true, 'Phone index must be unique');
  assert.ok(phoneIndex[1].partialFilterExpression, 'Phone index must specify partialFilterExpression');
  pass('User Schema Phone Index', 'Configured with unique: true and partialFilterExpression');

  // Test 2: Reject registration with duplicate email
  const existingUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'existing.user@gmail.com',
    phone: '+91 9876543210',
  };

  // Helper: returns a chainable query mock — supports .select().lean() chaining
  // used because the optimized code chains .select('_id').lean() on all findOne calls
  const origFindOne = User.findOne;
  const makeQueryMock = (value) => ({
    select: function() { return this; },
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  });

  // Mock User.findOne to simulate existing email
  User.findOne = (query) => {
    if (query.email === 'existing.user@gmail.com') {
      return makeQueryMock(existingUser);
    }
    return makeQueryMock(null);
  };

  let errorCaught = null;
  const mockReqDuplicateEmail = {
    body: {
      name: 'New User',
      email: 'existing.user@gmail.com',
      phone: '9123456780',
      password: 'StrongPassword123!',
      role: 'buyer',
    },
    ip: '127.0.0.1',
    headers: {},
  };

  await authController.register(
    mockReqDuplicateEmail,
    {},
    (err) => { errorCaught = err; }
  );

  assert.ok(errorCaught, 'Must return error for duplicate email');
  assert.strictEqual(errorCaught.statusCode, 400);
  assert.ok(errorCaught.message.includes('Email is already registered'), 'Message must indicate email already registered');
  pass('Duplicate Email Blocked in Registration', errorCaught.message);

  // Test 3: Reject registration with duplicate phone (different format, e.g. raw 10-digit)
  User.findOne = (query) => {
    if (query.phone && query.phone.test && query.phone.test(existingUser.phone)) {
      return makeQueryMock(existingUser);
    }
    return makeQueryMock(null);
  };

  errorCaught = null;
  const mockReqDuplicatePhone = {
    body: {
      name: 'Another User',
      email: 'newuniqueemail@gmail.com',
      phone: '9876543210', // matches existingUser.phone '+91 9876543210'
      password: 'StrongPassword123!',
      role: 'buyer',
    },
    ip: '127.0.0.1',
    headers: {},
  };

  await authController.register(
    mockReqDuplicatePhone,
    {},
    (err) => { errorCaught = err; }
  );

  assert.ok(errorCaught, 'Must return error for duplicate phone');
  assert.strictEqual(errorCaught.statusCode, 400);
  assert.ok(errorCaught.message.includes('Mobile number is already registered'), 'Message must indicate mobile already registered');
  pass('Duplicate Mobile Blocked in Registration', errorCaught.message);

  // Test 4: Reject registration OTP dispatch for duplicate mobile number
  errorCaught = null;
  const mockReqOtpDuplicatePhone = {
    body: {
      name: 'OTP User',
      email: 'otpunique@gmail.com',
      phone: '9876543210',
      role: 'buyer',
    },
    ip: '127.0.0.1',
    headers: {},
  };

  await authController.sendRegistrationOTP(
    mockReqOtpDuplicatePhone,
    {},
    (err) => { errorCaught = err; }
  );

  assert.ok(errorCaught, 'Must return error for duplicate phone in OTP dispatch');
  assert.strictEqual(errorCaught.statusCode, 400);
  assert.ok(errorCaught.message.includes('Mobile number is already registered'), 'Message must state mobile is registered');
  pass('Duplicate Mobile Blocked in OTP Dispatch', errorCaught.message);

  // Test 5: Reject profile update to an already existing phone number
  errorCaught = null;
  const mockReqUpdateProfile = {
    body: {
      phone: '9876543210',
    },
    user: {
      _id: '507f1f77bcf86cd799439099', // different user
      phone: '+91 9111111111',
    },
    ip: '127.0.0.1',
    headers: {},
  };

  await authController.updateProfile(
    mockReqUpdateProfile,
    {},
    (err) => { errorCaught = err; }
  );

  assert.ok(errorCaught, 'Must return error when updating to an existing mobile number');
  assert.strictEqual(errorCaught.statusCode, 400);
  assert.ok(errorCaught.message.includes('Mobile number is already registered'), 'Message must state mobile registered to another account');
  pass('Duplicate Mobile Blocked in Profile Update', errorCaught.message);

  // Restore mocks
  User.findOne = origFindOne;

  console.log('\n🎉 All Strict Mobile & Email Uniqueness Tests Passed Successfully!\n');
}

if (require.main === module) {
  runUniquePhoneAndEmailSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}

module.exports = runUniquePhoneAndEmailSuite;
