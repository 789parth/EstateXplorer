const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Property = require('../models/Property');
const User = require('../models/User');
const Partnership = require('../models/Partnership');
const partnershipService = require('../services/partnershipService');
const { generateAgentCode, requestPartnership, updatePartnershipStatus, getAgentPartnerships, getBuilderPartnerships } = partnershipService;

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Agent Property & Project Dual Acquisition Tests');
  console.log('======================================================\n');

  try {
    await connectDB();
    console.log('Connected to MongoDB.\n');

    const timestamp = Date.now();

    // 1. Create Owner User
    const ownerPhone = `+91 ${String(timestamp).slice(-10)}`;
    const owner = await User.create({
      name: `Test Owner ${timestamp}`,
      email: `owner_${timestamp}@testdomain.com`,
      password: 'Password123!',
      role: 'owner',
      roles: ['owner'],
      phone: ownerPhone,
    });

    // 2. Create Agent User
    const agentPhone = `+91 ${String(timestamp + 1).slice(-10)}`;
    const agent = await User.create({
      name: `Test Agent ${timestamp}`,
      email: `agent_${timestamp}@testdomain.com`,
      password: 'Password123!',
      role: 'agent',
      roles: ['agent'],
      phone: agentPhone,
      agencyName: 'Topline Realty Partners',
      reraNumber: 'RERA-TEST-998877',
      roleKycVerification: {
        agent: { status: 'verified' },
      },
    });

    // 3. Create Individual Property with allowAgentAcquisition: true
    const individualProperty = await Property.create({
      title: `Luxury Sea-Facing 3BHK Apartment ${timestamp}`,
      description: 'Spacious apartment with panoramic views',
      price: 15000000,
      priceDisplay: '₹ 1.5 Cr',
      location: {
        address: 'Worli Sea Face',
        city: 'Mumbai',
        state: 'Maharashtra',
      },
      category: 'property',
      type: 'apartment',
      purpose: 'buy',
      bhk: 3,
      area: 1650,
      user: owner._id,
      builder: owner._id,
      allowAgentAcquisition: true,
      networkEnabled: true,
      defaultCommissionRate: 2.0,
      images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00'],
    });

    console.log('✅ Created individual property with allowAgentAcquisition enabled');

    // 4. Agent Requests Selling Rights for the Individual Property
    const partnershipRequest = await requestPartnership(
      agent._id,
      individualProperty._id,
      'I have qualified buyers looking for 3BHKs in Worli'
    );

    console.log('✅ Agent successfully submitted partnership request for individual property');
    console.log(`   - Status: ${partnershipRequest.status}`);
    console.log(`   - Generated Agent Code: ${partnershipRequest.agentCode}`);
    console.log(`   - Seller ID recorded: ${partnershipRequest.builder}`);

    if (String(partnershipRequest.builder) !== String(owner._id)) {
      throw new Error(`Expected seller ID to be owner ${owner._id}, got ${partnershipRequest.builder}`);
    }

    // 5. Owner checks their incoming requests
    const ownerRequests = await getBuilderPartnerships(owner._id);
    const foundRequest = ownerRequests.find((r) => String(r._id) === String(partnershipRequest._id));
    if (!foundRequest) {
      throw new Error('Owner could not find incoming agent partnership request');
    }
    console.log('✅ Owner successfully retrieved incoming agent request');
    console.log(`   - Agent: ${foundRequest.agent?.name} (${foundRequest.agent?.agencyName})`);
    console.log(`   - Property Category: ${foundRequest.project?.category}`);

    // 6. Owner Approves the Agent Request
    const approvedPartnership = await updatePartnershipStatus(
      owner._id,
      partnershipRequest._id,
      'approved',
      2.5
    );

    console.log('✅ Owner successfully approved agent request');
    console.log(`   - New Status: ${approvedPartnership.status}`);
    console.log(`   - Commission Rate: ${approvedPartnership.commissionRate}%`);
    console.log(`   - Affiliate URL: ${approvedPartnership.affiliateUrl}`);

    if (approvedPartnership.status !== 'approved') {
      throw new Error('Partnership was not updated to approved status');
    }

    // 7. Agent checks their affiliations
    const agentAffiliations = await getAgentPartnerships(agent._id);
    const activeAffiliation = agentAffiliations.find((a) => String(a._id) === String(partnershipRequest._id));
    if (!activeAffiliation || activeAffiliation.status !== 'approved') {
      throw new Error('Agent could not find active approved affiliation');
    }
    console.log('✅ Agent successfully retrieved approved affiliation with tracking details');

    // Cleanup
    await Partnership.deleteMany({ _id: partnershipRequest._id });
    await Property.deleteMany({ _id: individualProperty._id });
    await User.deleteMany({ _id: { $in: [owner._id, agent._id] } });

    console.log('\n======================================================');
    console.log('🎉 ALL DUAL PROPERTY & PROJECT ACQUISITION TESTS PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
