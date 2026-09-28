const mongoose = require('mongoose');
const Property = require('../models/Property');
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const { replyToPropertyInquiry } = require('../controllers/propertyController');

async function runTests() {
  console.log('🧪 Starting Inquiry Email Reply & Automatic Deletion Verification...\n');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB Connected for tests\n');

  try {
    // 1. Create a dummy builder user
    const testTimestamp = Date.now();
    const builder = await User.create({
      name: `Test Builder ${testTimestamp}`,
      email: `testbuilder_${testTimestamp}@example.com`,
      password: 'password123',
      role: 'builder',
      isVerified: true,
      builderProfile: {
        companyName: 'Apex Developments',
      },
    });

    // 2. Create a dummy property
    const property = await Property.create({
      title: `Apex Grand Towers ${testTimestamp}`,
      description: 'Luxury high-rise apartments in Prime City',
      price: 15000000,
      priceDisplay: '₹1.50 Cr',
      type: 'Apartment',
      category: 'project',
      status: 'ready',
      images: ['https://example.com/test.jpg'],
      builder: builder._id,
      location: {
        address: 'MG Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
      },
    });

    // 3. Create an inquiry for this property
    const inquiry = await Inquiry.create({
      property: property._id,
      propertyTitle: property.title,
      builder: builder._id,
      name: 'Priya Sharma',
      email: `buyer_${testTimestamp}@example.com`,
      phone: '+91 9876543210',
      message: 'Could you please send me the floor plan and payment schedule for 3BHK units?',
      status: 'new',
    });

    console.log(`✅ [SETUP] Created inquiry ${inquiry._id} for property "${property.title}"`);

    // 4. Test validation: Empty reply message rejected with 400
    let rejectedAsExpected = false;
    const mockReqEmpty = {
      params: { id: inquiry._id.toString() },
      body: { replyMessage: '' },
      user: { id: builder._id.toString(), _id: builder._id, role: 'builder', name: builder.name, email: builder.email },
    };
    const mockResEmpty = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        return this;
      },
    };
    const mockNextEmpty = (err) => {
      if (err && err.statusCode === 400) {
        rejectedAsExpected = true;
      }
    };

    await replyToPropertyInquiry(mockReqEmpty, mockResEmpty, mockNextEmpty);
    if (!rejectedAsExpected) {
      throw new Error('Expected empty reply message to be rejected with 400');
    }
    console.log('✅ [PASS] Empty reply message rejected with 400 validation error');

    // 5. Test successful reply: sends email and deletes from database
    let replySuccess = false;
    let responseData = null;
    const mockReqValid = {
      params: { id: inquiry._id.toString() },
      body: {
        replyMessage: 'Dear Priya, thank you for your inquiry. The 3BHK brochure and 20:80 payment plan have been prepared for you. Please let us know if you wish to visit this Saturday.',
      },
      user: {
        id: builder._id.toString(),
        _id: builder._id,
        role: 'builder',
        name: builder.name,
        email: builder.email,
        builderProfile: { companyName: 'Apex Developments' },
      },
    };
    const mockResValid = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.body = data;
        if (this.statusCode === 200 && data.success) {
          replySuccess = true;
          responseData = data;
        }
        return this;
      },
    };

    await replyToPropertyInquiry(mockReqValid, mockResValid, (err) => {
      if (err) throw err;
    });

    if (!replySuccess || !responseData?.data?.deleted) {
      throw new Error(`Reply did not return success 200 or deleted: true. Got: ${JSON.stringify(responseData)}`);
    }
    console.log(`✅ [PASS] Reply email sent successfully to ${inquiry.email}`);

    // 6. Verify that inquiry is indeed DELETED from MongoDB
    const checkDeleted = await Inquiry.findById(inquiry._id);
    if (checkDeleted !== null) {
      throw new Error(`Inquiry ${inquiry._id} still exists in MongoDB after reply! Auto-deletion failed.`);
    }
    console.log(`✅ [PASS] Inquiry ${inquiry._id} was automatically deleted from MongoDB database`);

    // Clean up test builder and property
    await Property.findByIdAndDelete(property._id);
    await User.findByIdAndDelete(builder._id);
    console.log('✅ [CLEANUP] Test builder and property cleaned up\n');

    // 7. Test Owner replying to property inquiry and auto-deletion
    console.log('--- Testing Property Owner Flow ---');
    const owner = await User.create({
      name: `Test Owner ${testTimestamp}`,
      email: `testowner_${testTimestamp}@example.com`,
      password: 'password123',
      role: 'owner',
      isVerified: true,
    });

    const ownerProperty = await Property.create({
      title: `Serene Villa ${testTimestamp}`,
      description: 'Private 4BHK Villa with lawn',
      price: 25000000,
      priceDisplay: '₹2.50 Cr',
      type: 'Villa',
      category: 'property',
      status: 'ready',
      builder: owner._id,
      images: ['https://example.com/owner-prop.jpg'],
      location: { city: 'Bengaluru', state: 'Karnataka', address: 'Indiranagar 100ft Road' },
    });

    const ownerInquiry = await Inquiry.create({
      property: ownerProperty._id,
      propertyTitle: ownerProperty.title,
      builder: owner._id,
      name: 'Rohan Gupta',
      email: `rohan_${testTimestamp}@example.com`,
      phone: '+91 9988776655',
      message: 'Is the property furnished? Can we negotiate on the token amount?',
      status: 'new',
    });

    let ownerReplySuccess = false;
    const mockReqOwner = {
      params: { id: ownerInquiry._id.toString() },
      body: { replyMessage: 'Hello Rohan, yes the villa comes semi-furnished with modular kitchen. Token amount is negotiable upon meeting.' },
      user: { id: owner._id.toString(), _id: owner._id, role: 'owner', name: owner.name, email: owner.email },
    };
    const mockResOwner = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) {
        if (this.statusCode === 200 && data.success) ownerReplySuccess = true;
        return this;
      }
    };

    await replyToPropertyInquiry(mockReqOwner, mockResOwner, (err) => { if (err) throw err; });
    if (!ownerReplySuccess) throw new Error('Owner reply failed');

    const checkOwnerInquiryDeleted = await Inquiry.findById(ownerInquiry._id);
    if (checkOwnerInquiryDeleted !== null) throw new Error('Owner inquiry not auto-deleted from DB!');
    console.log('✅ [PASS] Owner reply sent via email and inquiry automatically deleted from DB');

    await Property.findByIdAndDelete(ownerProperty._id);
    await User.findByIdAndDelete(owner._id);

    // 8. Test Real Estate Agent replying to property inquiry and auto-deletion
    console.log('\n--- Testing Real Estate Agent Flow ---');
    const agent = await User.create({
      name: `Test Agent ${testTimestamp}`,
      email: `testagent_${testTimestamp}@example.com`,
      password: 'password123',
      role: 'agent',
      isVerified: true,
      agentProfile: { agencyName: 'Premier Realty' },
    });

    const agentProperty = await Property.create({
      title: `Skyline Heights Penthouse ${testTimestamp}`,
      description: 'Exclusive penthouse with panoramic view',
      price: 32000000,
      priceDisplay: '₹3.20 Cr',
      type: 'Penthouse',
      category: 'project',
      status: 'ready',
      builder: agent._id,
      images: ['https://example.com/agent-prop.jpg'],
      location: { city: 'Mumbai', state: 'Maharashtra', address: 'Bandra West Linking Road' },
    });

    const agentInquiry = await Inquiry.create({
      property: agentProperty._id,
      propertyTitle: agentProperty.title,
      agent: agent._id,
      name: 'Ananya Verma',
      email: `ananya_${testTimestamp}@example.com`,
      phone: '+91 9123456780',
      message: 'Can you provide the floor plan and maintenance cost per sq ft?',
      status: 'new',
    });

    let agentReplySuccess = false;
    const mockReqAgent = {
      params: { id: agentInquiry._id.toString() },
      body: { replyMessage: 'Hi Ananya, floor plan and maintenance sheet have been emailed. Happy to arrange a private walkthrough.' },
      user: { id: agent._id.toString(), _id: agent._id, role: 'agent', name: agent.name, email: agent.email, agentProfile: { agencyName: 'Premier Realty' } },
    };
    const mockResAgent = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) {
        if (this.statusCode === 200 && data.success) agentReplySuccess = true;
        return this;
      }
    };

    await replyToPropertyInquiry(mockReqAgent, mockResAgent, (err) => { if (err) throw err; });
    if (!agentReplySuccess) throw new Error('Agent reply failed');

    const checkAgentInquiryDeleted = await Inquiry.findById(agentInquiry._id);
    if (checkAgentInquiryDeleted !== null) throw new Error('Agent inquiry not auto-deleted from DB!');
    console.log('✅ [PASS] Agent reply sent via email and inquiry automatically deleted from DB');

    await Property.findByIdAndDelete(agentProperty._id);
    await User.findByIdAndDelete(agent._id);

    console.log('\n🎉 All Builder, Owner, and Agent Email Reply & Auto-Deletion Tests Passed Successfully!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
