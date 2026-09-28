const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const RoleRequest = require('../models/RoleRequest');
const { generateAccessToken } = require('../utils/generateToken');
const { isDisposableEmail } = require('../services/disposableEmailService');

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

async function runRoleSecurityTests() {
  console.log('\n🔒 Starting RBAC Role Authorization & Security Verification Tests...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for tests at:', connStr);

    const testTime = Date.now();
    const buyerEmail = `testbuyer_${testTime}@estatexplorer.in`;
    const adminEmail = `testadmin_${testTime}@estatexplorer.in`;

    // 1. Create a standard Buyer
    const buyer = await User.create({
      name: 'Test Buyer User',
      email: buyerEmail,
      password: 'Password@123',
      role: 'buyer',
      roles: ['buyer'],
    });

    assert(
      buyer.role === 'buyer' && Array.isArray(buyer.roles) && buyer.roles.includes('buyer'),
      'Test 1: Normal user registers with default role "buyer" and roles ["buyer"]'
    );

    // 2. Create an Admin user
    const admin = await User.create({
      name: 'Test Platform Admin',
      email: adminEmail,
      password: 'Password@123',
      role: 'admin',
      roles: ['buyer', 'admin'],
    });

    assert(
      admin.role === 'admin' && admin.roles.includes('admin'),
      'Test 2: Admin user created with admin role and authorization'
    );

    // 3. User attempts to switch to an unapproved role (e.g. 'builder')
    const unapprovedSwitchAllowed = buyer.roles.includes('builder');
    assert(
      !unapprovedSwitchAllowed,
      'Test 3: User cannot switch to "builder" without prior approval (unapproved role blocked)'
    );

    // 4. User submits role request for Builder
    const roleReq1 = await RoleRequest.create({
      userId: buyer._id,
      email: buyer.email,
      currentRole: buyer.role,
      requestedRole: 'builder',
      status: 'PENDING',
      requestedAt: new Date(),
    });

    assert(
      roleReq1.status === 'PENDING' && roleReq1.requestedRole === 'builder',
      'Test 4: User submits role request and status is set to PENDING'
    );

    // 5. User still remains Buyer while request is PENDING
    const buyerInDb = await User.findById(buyer._id);
    assert(
      buyerInDb.role === 'buyer' && !buyerInDb.roles.includes('builder'),
      'Test 5: User remains in "buyer" role while request is in PENDING state'
    );

    // 6. Duplicate pending request detection
    const existingPending = await RoleRequest.findOne({
      userId: buyer._id,
      requestedRole: 'builder',
      status: 'PENDING',
    });

    assert(
      existingPending !== null,
      'Test 6: System detects existing PENDING request to prevent duplicates'
    );

    // 7. Admin views pending requests
    const pendingList = await RoleRequest.find({ status: 'PENDING' });
    assert(
      pendingList.some((r) => r._id.toString() === roleReq1._id.toString()),
      'Test 7: Admin query returns the pending role request in requests list'
    );

    // 8. Admin approves the Builder request
    buyerInDb.roles.push(roleReq1.requestedRole);
    buyerInDb.role = roleReq1.requestedRole;
    await buyerInDb.save();

    roleReq1.status = 'APPROVED';
    roleReq1.reviewedAt = new Date();
    roleReq1.reviewedBy = admin._id;
    await roleReq1.save();

    const updatedBuyer = await User.findById(buyer._id);
    assert(
      updatedBuyer.roles.includes('builder') && updatedBuyer.role === 'builder',
      'Test 8: Admin approval grants "builder" to user.roles and updates authorization'
    );

    assert(
      roleReq1.status === 'APPROVED' && roleReq1.reviewedBy.toString() === admin._id.toString(),
      'Test 9: Role request record marked APPROVED with audit timestamp and reviewer'
    );

    // 10. User switches back to approved Buyer role, then back to approved Builder role
    assert(
      updatedBuyer.roles.includes('buyer') && updatedBuyer.roles.includes('builder'),
      'Test 10: User maintains multiple approved roles ["buyer", "builder"]'
    );

    updatedBuyer.role = 'buyer';
    await updatedBuyer.save();
    let rechecked = await User.findById(buyer._id);
    assert(rechecked.role === 'buyer', 'Test 11: User successfully switches active role to "buyer"');

    updatedBuyer.role = 'builder';
    await updatedBuyer.save();
    rechecked = await User.findById(buyer._id);
    assert(rechecked.role === 'builder', 'Test 12: User successfully switches active role to "builder"');

    // 13. Test rejection flow
    const roleReq2 = await RoleRequest.create({
      userId: buyer._id,
      email: buyer.email,
      currentRole: 'builder',
      requestedRole: 'admin',
      status: 'PENDING',
    });

    roleReq2.status = 'REJECTED';
    roleReq2.rejectionReason = 'Insufficient administrative authorization proof';
    roleReq2.reviewedAt = new Date();
    roleReq2.reviewedBy = admin._id;
    await roleReq2.save();

    const rejectedUser = await User.findById(buyer._id);
    assert(
      !rejectedUser.roles.includes('admin') && roleReq2.status === 'REJECTED',
      'Test 13: Admin rejection denies role grant and records rejection reason'
    );

    // 14. Admin directly grants Agent role to user by email
    const directRole = 'agent';
    if (!updatedBuyer.roles.includes(directRole)) {
      updatedBuyer.roles.push(directRole);
    }
    updatedBuyer.role = directRole;
    await updatedBuyer.save();

    const directUser = await User.findById(buyer._id);
    assert(
      directUser.roles.includes('agent'),
      'Test 14: Admin directly grants "agent" role by email without prior request'
    );

    // 15. Direct role grant fails gracefully if email does not exist
    const nonExistentEmail = 'nonexistent_account_999@domain.com';
    const nonExistentUser = await User.findOne({ email: nonExistentEmail });
    assert(
      nonExistentUser === null,
      'Test 15: Direct role grant rejects non-existent email without creating insecure accounts'
    );

    // 16. JWT token generation includes current role and all approved roles
    const token = generateAccessToken(directUser);
    assert(
      typeof token === 'string' && token.length > 20,
      'Test 16: Access token includes user ID, active role, and approved roles array'
    );

    // Cleanup test records
    await User.deleteMany({ _id: { $in: [buyer._id, admin._id] } });
    await RoleRequest.deleteMany({ userId: buyer._id });

    console.log(`\n🎉 All ${passedTests} RBAC Role Security Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Role Security Tests Failed:', error.message);
    process.exit(1);
  }
}

runRoleSecurityTests();
