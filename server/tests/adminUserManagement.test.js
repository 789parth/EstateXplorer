const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const RoleRequest = require('../models/RoleRequest');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { generateAccessToken } = require('../utils/generateToken');

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

function createMockReq(body = {}, params = {}, query = {}, user = null, headers = {}) {
  return {
    body,
    params,
    query,
    user,
    headers,
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

async function runAdminUserManagementTests() {
  console.log('\n👥 Starting Admin User Management (Delete & Block) Tests...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for tests at:', connStr);

    const testTime = Date.now();
    const adminEmail = `admin_mgmt_${testTime}@estatexplorer.in`;
    const targetEmail = `target_user_${testTime}@gmail.com`;

    // 1. Create Admin User
    const admin = await User.create({
      name: 'System Admin',
      email: adminEmail,
      password: 'Password@123',
      role: 'admin',
      roles: ['buyer', 'admin'],
    });

    // 2. Create Target User
    const targetUser = await User.create({
      name: 'Test Target User',
      email: targetEmail,
      password: 'Password@123',
      role: 'buyer',
      roles: ['buyer'],
    });

    // Test 1: Admin fetches users list
    const getUsersReq = createMockReq({}, {}, {}, { id: admin._id.toString() });
    const getUsersRes = createMockRes();
    let getUsersError = null;

    await adminController.getUsers(getUsersReq, getUsersRes, (err) => {
      getUsersError = err;
    });

    assert(!getUsersError && getUsersRes.statusCode === 200, 'Test 1: Admin successfully retrieves users list');
    const userInList = getUsersRes.data.data.find((u) => u.email === targetEmail);
    assert(userInList && userInList.isBlocked === false, 'Test 2: Target user appears in users list with isBlocked: false');

    // Test 3: Admin blocks the target user
    const blockReq = createMockReq(
      { isBlocked: true, reason: 'Suspicious activities' },
      { id: targetUser._id.toString() },
      {},
      { id: admin._id.toString() }
    );
    const blockRes = createMockRes();
    let blockError = null;

    await adminController.toggleBlockUser(blockReq, blockRes, (err) => {
      blockError = err;
    });

    assert(!blockError && blockRes.statusCode === 200, 'Test 3: Admin successfully blocks user account');

    const updatedBlockedUser = await User.findById(targetUser._id);
    assert(
      updatedBlockedUser.isBlocked === true && updatedBlockedUser.blockedReason === 'Suspicious activities',
      'Test 4: User document in MongoDB has isBlocked: true and blockedReason recorded'
    );

    // Test 5: Blocked user attempts login -> BLOCKED with 403!
    const loginReq = createMockReq({
      email: targetEmail,
      password: 'Password@123',
      role: 'buyer',
    });
    const loginRes = createMockRes();
    let loginError = null;

    await authController.login(loginReq, loginRes, (err) => {
      loginError = err;
    });

    assert(loginError !== null && loginError.statusCode === 403, 'Test 5: Blocked user login is strictly BLOCKED with 403 Forbidden');

    // Test 6: Blocked user attempts to use existing token on protected route -> BLOCKED with 403!
    const token = generateAccessToken(updatedBlockedUser);
    const protectReq = createMockReq({}, {}, {}, null, { authorization: `Bearer ${token}` });
    const protectRes = createMockRes();
    let protectError = null;

    await protect(protectReq, protectRes, (err) => {
      protectError = err;
    });

    assert(protectError !== null && protectError.statusCode === 403, 'Test 6: Blocked user is denied access to protected endpoints with 403 Forbidden');

    // Test 7: Admin unblocks the user
    const unblockReq = createMockReq(
      { isBlocked: false },
      { id: targetUser._id.toString() },
      {},
      { id: admin._id.toString() }
    );
    const unblockRes = createMockRes();
    let unblockError = null;

    await adminController.toggleBlockUser(unblockReq, unblockRes, (err) => {
      unblockError = err;
    });

    assert(!unblockError && unblockRes.statusCode === 200, 'Test 7: Admin successfully unblocks target user');

    const unblockedUser = await User.findById(targetUser._id);
    assert(unblockedUser.isBlocked === false, 'Test 8: Database reflects isBlocked: false');

    // Test 9: Unblocked user can log in again
    let unblockedLoginError = null;
    await authController.login(loginReq, loginRes, (err) => {
      unblockedLoginError = err;
    });

    assert(!unblockedLoginError && loginRes.statusCode === 200, 'Test 9: Unblocked user can log in successfully');

    // Test 10: Admin deletes target user permanently
    const deleteReq = createMockReq({}, { id: targetUser._id.toString() }, {}, { id: admin._id.toString() });
    const deleteRes = createMockRes();
    let deleteError = null;

    await adminController.deleteUser(deleteReq, deleteRes, (err) => {
      deleteError = err;
    });

    assert(!deleteError && deleteRes.statusCode === 200, 'Test 10: Admin successfully deletes target user account');

    const deletedUserCheck = await User.findById(targetUser._id);
    assert(deletedUserCheck === null, 'Test 11: User document permanently removed from MongoDB');

    // Test 12: Admin cannot delete or block self
    const selfDeleteReq = createMockReq({}, { id: admin._id.toString() }, {}, { id: admin._id.toString() });
    const selfDeleteRes = createMockRes();
    let selfDeleteError = null;

    await adminController.deleteUser(selfDeleteReq, selfDeleteRes, (err) => {
      selfDeleteError = err;
    });

    assert(selfDeleteError !== null && selfDeleteError.statusCode === 403, 'Test 12: Admin self-deletion is strictly prohibited with 403 Forbidden');

    // Clean up
    await User.findByIdAndDelete(admin._id);

    console.log(`\n🎉 All ${passedTests} Admin User Management Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Admin User Management Tests Failed:', error.message);
    process.exit(1);
  }
}

runAdminUserManagementTests();
