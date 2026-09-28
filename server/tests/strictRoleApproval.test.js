const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const RoleRequest = require('../models/RoleRequest');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');

dotenv.config();

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAILED] ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`✅ [Passed] ${message}`);
    passedTests++;
  }
}

// Mock Express req, res, next helpers
function createMockReq(body = {}, params = {}, query = {}, user = null) {
  return {
    body,
    params,
    query,
    user,
    cookies: {},
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
    cookie() {
      return this;
    },
  };
  return res;
}

async function runStrictRoleApprovalTests() {
  console.log('\n🔒 Starting Strict Role Approval & Unapproved Role Blocking Tests...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for tests at:', connStr);

    const testTime = Date.now();
    const testEmail = `strictagent_${testTime}@gmail.com`;
    const adminEmail = `strictadmin_${testTime}@estatexplorer.in`;

    // 1. Create Admin User
    const admin = await User.create({
      name: 'Super Administrator',
      email: adminEmail,
      password: 'Password@123',
      role: 'admin',
      roles: ['buyer', 'admin'],
    });

    // 2. Test: Direct sign-up attempt with 'agent' role -> BLOCKED with 403 Forbidden!
    const registerAgentReq = createMockReq({
      name: 'Agent Applicant',
      email: testEmail,
      phone: '+91 9876543210',
      password: 'Password@123',
      role: 'agent',
    });
    const registerAgentRes = createMockRes();
    let registerAgentError = null;

    await authController.register(registerAgentReq, registerAgentRes, (err) => {
      registerAgentError = err;
    });

    assert(
      registerAgentError !== null && registerAgentError.statusCode === 403,
      'Test 1: Direct sign-up with unapproved "agent" role is strictly BLOCKED with 403 Forbidden'
    );

    // 3. Test: Sign-up as default 'buyer' -> SUCCEEDS (201 Created)!
    const registerBuyerReq = createMockReq({
      name: 'Agent Applicant',
      email: testEmail,
      phone: '+91 9876543210',
      password: 'Password@123',
      role: 'buyer',
    });
    const registerBuyerRes = createMockRes();
    let registerBuyerError = null;

    await authController.register(registerBuyerReq, registerBuyerRes, (err) => {
      registerBuyerError = err;
    });

    assert(!registerBuyerError && registerBuyerRes.statusCode === 201, 'Test 2: Sign-up as default "buyer" returns HTTP 201 Created');

    const createdUser = await User.findOne({ email: testEmail });
    assert(
      createdUser.role === 'buyer' &&
      createdUser.roles.length === 1 &&
      createdUser.roles[0] === 'buyer',
      'Test 3: User registered strictly as "buyer" and user.roles is ["buyer"]'
    );

    // 4. Test: Unapproved user attempts to login with 'agent' role -> BLOCKED with 403!
    const loginAgentReq = createMockReq({
      email: testEmail,
      password: 'Password@123',
      role: 'agent',
    });
    const loginAgentRes = createMockRes();
    let loginAgentError = null;

    await authController.login(loginAgentReq, loginAgentRes, (err) => {
      loginAgentError = err;
    });

    assert(
      loginAgentError !== null && loginAgentError.statusCode === 403,
      'Test 4: Login with unapproved "agent" role is strictly BLOCKED with 403 Forbidden'
    );

    // 5. Test: User submits role request for 'agent'
    const reqRoleReq = createMockReq(
      { requestedRole: 'agent' },
      {},
      {},
      { id: createdUser._id.toString() }
    );
    const reqRoleRes = createMockRes();
    let reqRoleError = null;

    await authController.requestRole(reqRoleReq, reqRoleRes, (err) => {
      reqRoleError = err;
    });

    assert(!reqRoleError && reqRoleRes.statusCode === 201, 'Test 5: User successfully submits role access request for "agent"');

    const pendingRequest = await RoleRequest.findOne({
      userId: createdUser._id,
      requestedRole: 'agent',
      status: 'PENDING',
    });
    assert(
      pendingRequest !== null && pendingRequest.status === 'PENDING',
      'Test 6: RoleRequest record exists in database with status PENDING'
    );

    // 6. Test: While request is PENDING, user tries to login with 'agent' -> BLOCKED with 403!
    let loginPendingError = null;
    await authController.login(loginAgentReq, loginAgentRes, (err) => {
      loginPendingError = err;
    });

    assert(
      loginPendingError !== null && loginPendingError.statusCode === 403,
      'Test 7: Login with PENDING "agent" role is strictly BLOCKED with 403 Forbidden'
    );

    // 7. Test: While request is PENDING, user tries to switch role to 'agent' -> BLOCKED with 403!
    const switchReq = createMockReq({ role: 'agent' }, {}, {}, { id: createdUser._id.toString() });
    const switchRes = createMockRes();
    let switchError = null;

    await authController.switchRole(switchReq, switchRes, (err) => {
      switchError = err;
    });

    assert(
      switchError !== null && switchError.statusCode === 403,
      'Test 8: Switching active role to PENDING "agent" role is strictly BLOCKED with 403 Forbidden'
    );

    // 8. Test: User can login normally as 'buyer' (default role)
    const loginBuyerReq = createMockReq({
      email: testEmail,
      password: 'Password@123',
      role: 'buyer',
    });
    const loginBuyerRes = createMockRes();
    let loginBuyerError = null;

    await authController.login(loginBuyerReq, loginBuyerRes, (err) => {
      loginBuyerError = err;
    });

    assert(
      !loginBuyerError && loginBuyerRes.statusCode === 200,
      'Test 9: User can successfully log in as "buyer" (default role)'
    );

    // 9. Test: Admin approves the 'agent' role request
    const approveReq = createMockReq(
      {},
      { id: pendingRequest._id.toString() },
      {},
      { id: admin._id.toString() }
    );
    const approveRes = createMockRes();
    let approveError = null;

    await adminController.approveRoleRequest(approveReq, approveRes, (err) => {
      approveError = err;
    });

    assert(
      !approveError && approveRes.statusCode === 200,
      'Test 10: Administrator successfully approves "agent" role request'
    );

    const approvedUser = await User.findById(createdUser._id);
    assert(
      approvedUser.roles.includes('agent'),
      'Test 11: Approved user.roles now contains "agent" role (["buyer", "agent"])'
    );

    // 10. Test: Approved user now logs in with role: 'agent' -> SUCCEEDS!
    const loginApprovedAgentReq = createMockReq({
      email: testEmail,
      password: 'Password@123',
      role: 'agent',
    });
    const loginApprovedAgentRes = createMockRes();
    let loginApprovedAgentError = null;

    await authController.login(loginApprovedAgentReq, loginApprovedAgentRes, (err) => {
      loginApprovedAgentError = err;
    });

    assert(
      !loginApprovedAgentError && loginApprovedAgentRes.statusCode === 200,
      'Test 12: User with approved role can now successfully log in as "agent"'
    );

    // 11. Test: Approved user switches between approved roles ('buyer' <-> 'agent') -> SUCCEEDS!
    const switchBackBuyerReq = createMockReq(
      { role: 'buyer' },
      {},
      {},
      { id: approvedUser._id.toString() }
    );
    const switchBackBuyerRes = createMockRes();
    let switchBackBuyerError = null;

    await authController.switchRole(switchBackBuyerReq, switchBackBuyerRes, (err) => {
      switchBackBuyerError = err;
    });

    assert(
      !switchBackBuyerError && switchBackBuyerRes.statusCode === 200,
      'Test 13: User can switch back to approved "buyer" role'
    );

    const switchAgentReq = createMockReq(
      { role: 'agent' },
      {},
      {},
      { id: approvedUser._id.toString() }
    );
    const switchAgentRes = createMockRes();
    let switchAgentErr = null;

    await authController.switchRole(switchAgentReq, switchAgentRes, (err) => {
      switchAgentErr = err;
    });

    assert(
      !switchAgentErr && switchAgentRes.statusCode === 200,
      'Test 14: User can switch to approved "agent" role'
    );

    // 12. Test: Attempting to login with an unapproved role (e.g. 'builder') -> BLOCKED with 403!
    const loginBuilderReq = createMockReq({
      email: testEmail,
      password: 'Password@123',
      role: 'builder',
    });
    const loginBuilderRes = createMockRes();
    let loginBuilderError = null;

    await authController.login(loginBuilderReq, loginBuilderRes, (err) => {
      loginBuilderError = err;
    });

    assert(
      loginBuilderError !== null && loginBuilderError.statusCode === 403,
      'Test 15: Login with unapproved "builder" role is strictly BLOCKED with 403 Forbidden'
    );

    // Clean up
    await User.deleteMany({ _id: { $in: [createdUser._id, admin._id] } });
    await RoleRequest.deleteMany({ userId: createdUser._id });

    console.log(`\n🎉 All ${passedTests} Strict Role Approval Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Strict Role Approval Tests Failed:', error.message);
    process.exit(1);
  }
}

runStrictRoleApprovalTests();
