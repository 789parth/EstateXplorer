const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');

dotenv.config();

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ [FAILED] ${msg}`);
    failed++;
    throw new Error(msg);
  } else {
    console.log(`✅ [Passed] ${msg}`);
    passed++;
  }
}

async function runGoogleAuthTests() {
  console.log('\n🌐 Starting Google Auth Verification Tests...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);

    const testTime = Date.now();
    const testGoogleEmail = `google_user_${testTime}@gmail.com`;

    // 1. Simulate Google Auth Create User with Role
    const user = await User.create({
      name: 'Priya Sharma',
      email: testGoogleEmail,
      googleId: `google_oauth_${testTime}`,
      authProvider: 'google',
      role: 'builder',
      roles: ['buyer', 'builder'],
      avatar: 'https://lh3.googleusercontent.com/a/test-avatar',
      isVerified: true,
    });

    assert(user.authProvider === 'google' && user.role === 'builder', 'Test 1: Google account created with Builder role');

    // 2. Generate Tokens for Google User
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    assert(Boolean(accessToken) && Boolean(refreshToken), 'Test 2: Access & Refresh tokens generated for Google user');

    // 3. Update existing Google User on second login
    user.role = 'agent';
    if (!user.roles.includes('agent')) user.roles.push('agent');
    await user.save();

    const reloadedUser = await User.findById(user._id);
    assert(reloadedUser.roles.includes('agent') && reloadedUser.role === 'agent', 'Test 3: Existing Google user switches role on login');

    // Cleanup
    await User.deleteMany({ _id: user._id });

    console.log(`\n🎉 All ${passed} Google Auth Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Google Auth Test Failed:', error.message);
    process.exit(1);
  }
}

runGoogleAuthTests();
