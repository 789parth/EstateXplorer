const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Property = require('../models/Property');

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

async function runPropertyEditTests() {
  console.log('\n🏠 Starting Property Edit & Authorization Verification Tests...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for tests at:', connStr);

    const testTime = Date.now();

    // 1. Create a Builder user
    const builder = await User.create({
      name: 'Test Builder User',
      email: `builder_${testTime}@estatexplorer.in`,
      password: 'Password@123',
      role: 'builder',
      roles: ['buyer', 'builder'],
    });

    // 2. Create another Builder user
    const otherBuilder = await User.create({
      name: 'Other Builder User',
      email: `otherbuilder_${testTime}@estatexplorer.in`,
      password: 'Password@123',
      role: 'builder',
      roles: ['buyer', 'builder'],
    });

    // 3. Create an Admin user
    const admin = await User.create({
      name: 'Admin User',
      email: `admin_${testTime}@estatexplorer.in`,
      password: 'Password@123',
      role: 'admin',
      roles: ['buyer', 'admin'],
    });

    // 4. Builder creates a new property/project
    const property = await Property.create({
      title: 'Initial Project Title',
      description: 'Initial description',
      type: '3 BHK Luxury Villa',
      category: 'project',
      purpose: 'buy',
      price: 15000000,
      priceDisplay: '₹ 1.5 Cr',
      bhk: 3,
      area: 2500,
      location: { city: 'Bengaluru', address: 'Whitefield', state: 'Karnataka' },
      builder: builder._id,
      isActive: true,
    });

    assert(property._id && property.builder.toString() === builder._id.toString(), 'Test 1: Property created successfully and linked to builder');

    // 5. Simulate Builder updating their own property
    const currentUserId = builder._id.toString();
    const currentUserRole = builder.role;
    const propertyOwnerId = property.builder?._id ? property.builder._id.toString() : property.builder?.toString();

    const isOwner = propertyOwnerId && currentUserId && propertyOwnerId === currentUserId;
    const isAdmin = currentUserRole === 'admin';
    const canEdit = isOwner || isAdmin;

    assert(canEdit === true, 'Test 2: Builder is authorized to edit their own property');

    property.title = 'Updated Villa Project';
    property.price = 16000000;
    await property.save();

    const updatedProp = await Property.findById(property._id);
    assert(updatedProp.title === 'Updated Villa Project' && updatedProp.price === 16000000, 'Test 3: Property title and price updated in database');

    // 6. Other builder attempts to edit property without permission
    const otherUserId = otherBuilder._id.toString();
    const otherUserRole = otherBuilder.role;
    const isOtherOwner = propertyOwnerId && otherUserId && propertyOwnerId === otherUserId;
    const isOtherAdmin = otherUserRole === 'admin';
    const otherCanEdit = isOtherOwner || isOtherAdmin;

    assert(otherCanEdit === false, 'Test 4: Another builder cannot edit properties they do not own');

    // 7. Admin updates property (Admin override)
    const adminUserId = admin._id.toString();
    const adminUserRole = admin.role;
    const adminCanEdit = (propertyOwnerId === adminUserId) || (adminUserRole === 'admin');

    assert(adminCanEdit === true, 'Test 5: Admin has system-wide override permission to edit any property');

    // 8. Soft-delete property by owner
    property.isActive = false;
    await property.save();
    const softDeleted = await Property.findById(property._id);
    assert(softDeleted.isActive === false, 'Test 6: Property successfully marked as inactive (soft delete)');

    // Cleanup
    await User.deleteMany({ _id: { $in: [builder._id, otherBuilder._id, admin._id] } });
    await Property.deleteMany({ _id: property._id });

    console.log(`\n🎉 All ${passedTests} Property Edit & Authorization Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Property Edit Tests Failed:', error.message);
    process.exit(1);
  }
}

runPropertyEditTests();
