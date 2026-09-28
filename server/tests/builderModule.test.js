const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Property = require('../models/Property');
const Inquiry = require('../models/Inquiry');

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

async function runBuilderModuleTests() {
  console.log('\n🏗️  Starting Complete Builder Management Module Verification Tests...\n');

  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/estatexplorer';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for tests at:', connStr);

    const testTime = Date.now();
    const builderEmail = `builder_dev_${testTime}@estatexplorer.in`;
    const buyerEmail = `buyer_lead_${testTime}@estatexplorer.in`;

    // 1. Create Builder with Profile
    const builder = await User.create({
      name: 'Godrej Properties Group',
      email: builderEmail,
      password: 'Password@123',
      role: 'builder',
      roles: ['buyer', 'builder'],
      phone: '+91 98765 43210',
      city: 'Mumbai',
      builderProfile: {
        companyName: 'Godrej Properties Ltd',
        displayName: 'Godrej Properties',
        yearEstablished: '1990',
        tagline: 'Brighter Living for Everyone',
        reraId: 'MAHARERA/P51800001234',
        reraState: 'Maharashtra',
        gst: '27AAAAA0000A1Z5',
        cin: 'L74120MH1985PLC035308',
        contactPerson: 'Aditya Godrej',
        designation: 'Managing Director',
        address: 'Godrej One, Pirojshanagar, Vikhroli East, Mumbai',
      },
    });

    assert(
      builder.builderProfile.companyName === 'Godrej Properties Ltd' && builder.role === 'builder',
      'Test 1: Builder registered with full corporate profile and RERA compliance data'
    );

    // 2. Builder creates a New Project (Housing Development)
    const project = await Property.create({
      title: 'Godrej Palm Retreat Phase 2',
      description: 'Ultra luxury resort-style green residences with 50+ wellness amenities.',
      type: '3 BHK Luxury Apartment',
      category: 'project',
      purpose: 'buy',
      price: 18500000,
      priceDisplay: '₹ 1.85 Cr',
      priceSub: '₹ 8,200 / Sq.Ft · 2,250 sq.ft',
      bhk: 3,
      area: 2250,
      location: {
        city: 'Noida',
        address: 'Sector 150, Express Highway, Noida',
        state: 'Uttar Pradesh',
      },
      status: 'uc',
      statusLabel: 'Under Construction',
      statusDate: 'Possession: Dec 2027',
      rera: true,
      reraId: 'UPRERAPRJ987654',
      images: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&auto=format&fit=crop',
      ],
      amenities: ['Olympic Swimming Pool', 'Clubhouse', 'Cricket Pitch', 'EV Station', 'Power Backup'],
      usps: ['80% open green landscapes', 'Low density sector', 'Near proposed Jewar Airport'],
      builder: builder._id,
      isActive: true,
    });

    assert(
      project.category === 'project' && project.builder.toString() === builder._id.toString(),
      'Test 2: Builder creates housing development project linked to builder ID in MongoDB'
    );

    // 3. Builder edits the project (Title, Pricing, RERA, USPs)
    project.title = 'Godrej Palm Retreat Luxury Phase 2';
    project.price = 19000000;
    project.priceDisplay = '₹ 1.90 Cr';
    project.usps.push('Pre-certified IGBC Gold rated green building');
    await project.save();

    const updatedProject = await Property.findById(project._id);
    assert(
      updatedProject.title === 'Godrej Palm Retreat Luxury Phase 2' &&
        updatedProject.price === 19000000 &&
        updatedProject.usps.length === 4,
      'Test 3: Builder successfully updates project specifications, pricing, and green certifications'
    );

    // 4. Buyer books a Site Visit on Builder's Project
    const siteVisitInquiry = await Inquiry.create({
      property: project._id,
      propertyTitle: project.title,
      propertyType: project.type,
      propertyLocation: 'Sector 150, Express Highway, Noida',
      builder: builder._id,
      name: 'Rohan Sharma',
      email: buyerEmail,
      phone: '+91 91234 56789',
      message: 'Looking for a 3BHK high floor unit. Would like a site visit.',
      visitRequested: true,
      visitDate: '2026-09-15',
      visitTime: '10:00 AM - 12:00 PM',
      status: 'visit',
    });

    assert(
      siteVisitInquiry.visitRequested === true && siteVisitInquiry.status === 'visit',
      'Test 4: Buyer site visit request created and linked to builder'
    );

    // 5. Builder queries all Inquiries and Site Visits for their developments
    const builderInquiries = await Inquiry.find({
      $or: [{ builder: builder._id }, { property: project._id }],
    });

    assert(
      builderInquiries.length === 1 && builderInquiries[0]._id.toString() === siteVisitInquiry._id.toString(),
      'Test 5: Builder retrieves all real-time buyer inquiries and site visit bookings'
    );

    // 6. Builder reschedules and confirms site visit appointment
    siteVisitInquiry.visitDate = '2026-09-18';
    siteVisitInquiry.visitTime = '02:00 PM - 04:00 PM';
    siteVisitInquiry.status = 'contacted';
    siteVisitInquiry.notes = 'Confirmed visit with buyer over phone call';
    await siteVisitInquiry.save();

    const recheckedVisit = await Inquiry.findById(siteVisitInquiry._id);
    assert(
      recheckedVisit.visitDate === '2026-09-18' &&
        recheckedVisit.visitTime === '02:00 PM - 04:00 PM' &&
        recheckedVisit.notes.includes('Confirmed visit'),
      'Test 6: Builder successfully reschedules appointment and logs CRM communication notes'
    );

    // 7. Builder marks lead as Closed / Booked
    recheckedVisit.status = 'closed';
    await recheckedVisit.save();

    const closedLead = await Inquiry.findById(siteVisitInquiry._id);
    assert(closedLead.status === 'closed', 'Test 7: Builder marks lead as Closed / Booked in CRM');

    // 8. Builder updates corporate profile details
    builder.builderProfile.totalProjects = 150;
    builder.builderProfile.experience = 35;
    builder.builderProfile.tagline = 'Redefining Luxury Living Across India';
    await builder.save();

    const updatedBuilderUser = await User.findById(builder._id);
    assert(
      updatedBuilderUser.builderProfile.totalProjects === 150 &&
        updatedBuilderUser.builderProfile.tagline === 'Redefining Luxury Living Across India',
      'Test 8: Builder updates company profile metadata and experience statistics'
    );

    // 9. Builder soft deletes a completed or obsolete listing
    project.isActive = false;
    await project.save();

    const softDeletedProject = await Property.findById(project._id);
    assert(softDeletedProject.isActive === false, 'Test 9: Builder soft deletes project listing safely');

    // Cleanup
    await User.deleteMany({ _id: builder._id });
    await Property.deleteMany({ _id: project._id });
    await Inquiry.deleteMany({ _id: siteVisitInquiry._id });

    console.log(`\n🎉 All ${passedTests} Builder Management Module Tests Passed Successfully!\n`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Builder Module Tests Failed:', error.message);
    process.exit(1);
  }
}

runBuilderModuleTests();
