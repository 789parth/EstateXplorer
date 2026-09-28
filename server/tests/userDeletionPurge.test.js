const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Property = require('../models/Property');
const RoleRequest = require('../models/RoleRequest');
const Inquiry = require('../models/Inquiry');
const Booking = require('../models/Booking');
const Partnership = require('../models/Partnership');
const Attribution = require('../models/Attribution');
const ProjectUnit = require('../models/ProjectUnit');
const LeadAuditLog = require('../models/LeadAuditLog');
const Contact = require('../models/Contact');
const OTP = require('../models/OTP');
const authController = require('../controllers/authController');

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

function createMockReq(user = null, cookies = {}) {
  return {
    user,
    cookies,
    body: {},
    params: {},
    query: {},
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    cookiesCleared: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
    cookie(name, val, opts) {
      if (val === '' && opts?.expires) {
        this.cookiesCleared.push(name);
      }
      return this;
    },
  };
  return res;
}

async function runUserDeletionAndDataPurgeTests() {
  console.log('\n🗑️ Starting Comprehensive User Deletion & Complete Data Purge Verification...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for tests at:', connStr);

    const testTime = Date.now();
    const testEmail = `purgetest_${testTime}@example.com`;
    const builderEmail = `purgebldr_${testTime}@example.com`;

    // 1. Create a user (User A) who will own properties, inquiries, role requests, bookings, etc.
    const userA = await User.create({
      name: 'Purge Candidate User',
      email: testEmail,
      password: 'Password@123',
      role: 'builder',
      roles: ['buyer', 'builder'],
    });

    const builderB = await User.create({
      name: 'Other Builder',
      email: builderEmail,
      password: 'Password@123',
      role: 'builder',
      roles: ['buyer', 'builder'],
    });

    // 2. Create User A's Property
    const propA = await Property.create({
      title: 'User A Mega Residency',
      description: 'Luxury apartments in prime location',
      type: '2 BHK Apartment',
      category: 'project',
      purpose: 'buy',
      price: 8500000,
      priceDisplay: '₹ 85.00 L',
      location: { city: 'Anand', address: 'Borsad Crossroads' },
      images: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c'],
      builder: userA._id,
    });

    // 3. Create ProjectUnit for User A's property
    const unitA = await ProjectUnit.create({
      project: propA._id,
      builder: userA._id,
      unitNumber: `T1-${testTime}`,
      bhk: 2,
      price: 8500000,
      status: 'booked',
    });

    // 4. Create Role Request for User A
    const roleReqA = await RoleRequest.create({
      userId: userA._id,
      email: testEmail,
      currentRole: 'buyer',
      requestedRole: 'agent',
      status: 'PENDING',
    });

    // 5. Create Inquiry associated with User A
    const inqA = await Inquiry.create({
      property: propA._id,
      propertyTitle: propA.title,
      builder: userA._id,
      user: userA._id,
      name: userA.name,
      email: testEmail,
      phone: '9876543210',
      message: 'Interested in unit booking',
    });

    // 6. Create Lead Audit Log for that inquiry
    await LeadAuditLog.create({
      lead: inqA._id,
      actor: userA._id,
      actorRole: 'builder',
      action: 'STATUS_TRANSITION',
      newStage: 'contacted',
    });

    // 7. Create Booking for User A
    await Booking.create({
      bookingNumber: `BK-${testTime}`,
      project: propA._id,
      unit: unitA._id,
      builder: userA._id,
      buyer: userA._id,
      buyerName: userA.name,
      buyerPhone: '9876543210',
      buyerEmail: testEmail,
      basePrice: 8500000,
      agreementValue: 8500000,
    });

    // 8. Create Partnership for User A
    await Partnership.create({
      builder: userA._id,
      agent: builderB._id,
      project: propA._id,
      status: 'approved',
      agentCode: `AGT-${testTime}`,
    });

    // 9. Create Attribution
    await Attribution.create({
      fingerprint: `fp-${testTime}`,
      buyer: userA._id,
      agent: builderB._id,
      project: propA._id,
      agentCode: `AGT-${testTime}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // 10. Create Contact submission and OTP with this email
    await Contact.create({
      name: userA.name,
      email: testEmail,
      phone: '9876543210',
      subject: 'Inquiry support',
      message: 'Please reach back out',
    });

    await OTP.create({
      email: testEmail,
      code: '654321',
      purpose: 'email_verify',
      expiresAt: new Date(Date.now() + 600000),
    });

    // Verify all records exist prior to deletion
    assert(await User.findById(userA._id) !== null, 'Pre-condition: User A exists');
    assert(await Property.findById(propA._id) !== null, 'Pre-condition: Property A exists');
    assert(await Inquiry.findById(inqA._id) !== null, 'Pre-condition: Inquiry A exists');
    assert(await RoleRequest.findById(roleReqA._id) !== null, 'Pre-condition: RoleRequest A exists');
    assert(await Contact.findOne({ email: testEmail }) !== null, 'Pre-condition: Contact A exists');

    // Execute DELETE /api/auth/delete-account
    console.log('\nExecuting deleteAccount API endpoint for User A...');
    const req = createMockReq({ id: userA._id.toString(), email: testEmail });
    const res = createMockRes();
    let deleteError = null;

    await authController.deleteAccount(req, res, (err) => {
      deleteError = err;
    });

    assert(!deleteError && res.statusCode === 200, 'Test 1: deleteAccount controller executes cleanly with HTTP 200');
    assert(res.cookiesCleared.includes('refreshToken'), 'Test 2: Refresh token cookie is cleared upon account deletion');

    // Verify COMPLETE PURGE across all collections
    const userCheck = await User.findById(userA._id);
    const userEmailCheck = await User.findOne({ email: testEmail });
    assert(userCheck === null && userEmailCheck === null, 'Test 3: User record permanently erased from MongoDB');

    const propCheck = await Property.find({ builder: userA._id });
    assert(propCheck.length === 0, 'Test 4: All properties belonging to user purged');

    const inqCheck = await Inquiry.find({ $or: [{ user: userA._id }, { email: testEmail }] });
    assert(inqCheck.length === 0, 'Test 5: All inquiries and leads associated with user/email purged');

    const roleReqCheck = await RoleRequest.find({ $or: [{ userId: userA._id }, { email: testEmail }] });
    assert(roleReqCheck.length === 0, 'Test 6: All role requests associated with user/email purged');

    const bookingCheck = await Booking.find({ $or: [{ buyer: userA._id }, { buyerEmail: testEmail }] });
    assert(bookingCheck.length === 0, 'Test 7: All bookings associated with user/email purged');

    const partnershipCheck = await Partnership.find({ $or: [{ builder: userA._id }, { agent: userA._id }] });
    assert(partnershipCheck.length === 0, 'Test 8: All partnerships associated with user purged');

    const attrCheck = await Attribution.find({ $or: [{ buyer: userA._id }, { agent: userA._id }] });
    assert(attrCheck.length === 0, 'Test 9: All attribution records purged');

    const contactCheck = await Contact.find({ email: testEmail });
    assert(contactCheck.length === 0, 'Test 10: All contact messages for that email purged');

    const otpCheck = await OTP.find({ email: testEmail });
    assert(otpCheck.length === 0, 'Test 11: All OTP codes for that email purged');

    // TEST RE-REGISTRATION / RE-LOGIN WITH SAME EMAIL:
    // When a user logs in / registers again with the deleted email, it must be completely fresh (no legacy data)
    console.log('\n[TEST 12] Re-registering user with the same email...');
    const reRegisteredUser = await User.create({
      name: 'Brand New User',
      email: testEmail,
      password: 'Password@123',
      role: 'buyer',
      roles: ['buyer'],
    });

    assert(reRegisteredUser !== null, 'Test 12: User can register fresh account with same email');

    // Query all collections for this newly registered user email
    const reCheckProps = await Property.find({ builder: reRegisteredUser._id });
    const reCheckInq = await Inquiry.find({ $or: [{ user: reRegisteredUser._id }, { email: testEmail }] });
    const reCheckBookings = await Booking.find({ $or: [{ buyer: reRegisteredUser._id }, { buyerEmail: testEmail }] });
    const reCheckRoles = await RoleRequest.find({ $or: [{ userId: reRegisteredUser._id }, { email: testEmail }] });

    assert(reCheckProps.length === 0, 'Test 13: Re-registered user has ZERO previous properties');
    assert(reCheckInq.length === 0, 'Test 14: Re-registered user has ZERO previous inquiries/leads');
    assert(reCheckBookings.length === 0, 'Test 15: Re-registered user has ZERO previous bookings');
    assert(reCheckRoles.length === 0, 'Test 16: Re-registered user has ZERO previous role requests');

    // Clean up temporary builder B and re-registered user
    await User.deleteMany({ _id: { $in: [builderB._id, reRegisteredUser._id] } });

    console.log(`\n🎉 All ${passedTests} User Deletion & Complete Data Purge Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ User Deletion Tests Failed:', error);
    process.exit(1);
  }
}

runUserDeletionAndDataPurgeTests();
