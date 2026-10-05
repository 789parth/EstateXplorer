/**
 * Verification Test Suite: KYC Mandatory Document Verification at Property Creation
 * Rule:
 * 1. User registers freely and can log in as any role (buyer, builder, agent, owner).
 * 2. When builder, agent, or owner creates a property/project, they MUST have KYC verified by admin.
 * 3. Builder requires Aadhar, PAN, (optional Company doc).
 * 4. Agent requires Aadhar, PAN, (optional Agency doc).
 * 5. Owner requires Aadhar, PAN.
 * 6. Admin can view submissions, approve, and reject.
 */

const assert = require('assert');
const User = require('../models/User');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const propertyController = require('../controllers/propertyController');

function pass(name, detail = '') {
  console.log(`  ✅ [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

// Helpers for mock req/res
function createMockReq(body = {}, params = {}, query = {}, user = null) {
  return {
    body,
    params,
    query,
    user,
    headers: {},
    ip: '127.0.0.1',
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
  };
  return res;
}

async function runKycVerificationSuite() {
  console.log('\n🧪 Starting KYC Mandatory Document Verification Test Suite...\n');

  // Test 1: User schema defines kycVerification with unverified default
  const user = new User({
    name: 'Test Builder',
    email: 'test.builder@example.com',
    phone: '9876543210',
    password: 'password123',
    role: 'builder',
  });

  assert.strictEqual(user.kycVerification?.status, 'unverified', 'KYC status must default to unverified');
  assert.ok(user.roles.includes('builder'), 'User must have builder role enabled');
  assert.ok(user.roles.includes('agent'), 'User must have agent role enabled');
  assert.ok(user.roles.includes('owner'), 'User must have owner role enabled');
  assert.ok(user.roles.includes('buyer'), 'User must have buyer role enabled');
  pass('User Schema & Default Roles', 'Defaults roles to all 4 standard roles and kycStatus to unverified');

  // Test 2: Unverified builder cannot create property -> 403 requiresKyc
  const mockUserDoc = {
    _id: '507f1f77bcf86cd799439011',
    role: 'builder',
    kycVerification: { status: 'unverified' },
  };

  const origFindById = User.findById;
  User.findById = (id) => ({
    select: () => Promise.resolve(mockUserDoc),
  });

  const unverifiedReq = createMockReq(
    { title: 'Skyline Heights', category: 'project', price: 5000000 },
    {},
    {},
    { id: '507f1f77bcf86cd799439011', role: 'builder' }
  );
  const unverifiedRes = createMockRes();

  let nextCalled = false;
  await propertyController.createProperty(unverifiedReq, unverifiedRes, (err) => {
    nextCalled = true;
  });

  assert.strictEqual(unverifiedRes.statusCode, 403, 'Must return 403 status');
  assert.strictEqual(unverifiedRes.data?.requiresKyc, true, 'Must indicate requiresKyc: true');
  assert.strictEqual(unverifiedRes.data?.kycStatus, 'unverified', 'Must return kycStatus unverified');
  pass('Unverified Builder Blocked', 'createProperty blocked with 403 requiresKyc: true');

  // Test 3: KYC Submission rejects missing Aadhar or PAN
  const invalidKycReq = createMockReq(
    { aadharCard: { url: '' }, panCard: { url: 'https://example.com/pan.pdf' } },
    {},
    {},
    { id: '507f1f77bcf86cd799439011', role: 'builder' }
  );
  const invalidKycRes = createMockRes();
  let kycErr = null;

  User.findById = (id) => Promise.resolve({
    _id: id,
    role: 'builder',
    save: async () => {},
  });

  await authController.submitKycDocuments(invalidKycReq, invalidKycRes, (err) => {
    kycErr = err;
  });

  assert.ok(kycErr && kycErr.statusCode === 400, 'Must reject missing Aadhar with 400');
  pass('Mandatory Documents Enforced', 'submitKycDocuments requires both Aadhar and PAN');

  // Test 4: Admin approvals updates kyc status to verified
  const targetUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Builder John',
    email: 'john@builder.com',
    role: 'builder',
    kycVerification: {
      status: 'pending',
      aadharCard: { url: 'https://example.com/aadhar.jpg', status: 'pending' },
      panCard: { url: 'https://example.com/pan.jpg', status: 'pending' },
    },
    save: async function() { return this; },
  };

  User.findById = (id) => Promise.resolve(targetUser);

  const approveReq = createMockReq({}, { userId: '507f1f77bcf86cd799439011' }, {}, { id: 'admin_id' });
  const approveRes = createMockRes();

  await adminController.approveKycRequest(approveReq, approveRes, (err) => {});
  assert.strictEqual(approveRes.statusCode, 200, 'Admin approval returns 200');
  assert.strictEqual(targetUser.kycVerification.status, 'verified', 'KYC status updated to verified');
  assert.strictEqual(targetUser.kycVerification.aadharCard.status, 'verified', 'Aadhar marked verified');
  assert.strictEqual(targetUser.kycVerification.panCard.status, 'verified', 'PAN marked verified');
  pass('Admin Approval Flow', 'Admin successfully verifies KYC documents');

  // Restore mocks
  User.findById = origFindById;

  console.log('\n🎉 All KYC Mandatory Document Verification Tests Passed Successfully!\n');
}

runKycVerificationSuite().catch((err) => {
  console.error('❌ KYC Test Failed:', err);
  process.exit(1);
});
