const assert = require('assert');
const { submitContactMessage } = require('../controllers/contactController');
const { submitInquiry } = require('../controllers/propertyController');
const { externalPrimaryProvider } = require('../services/security/registrationSecurityService');
const { clearCache } = require('../services/disposableEmailService');
const redisCacheService = require('../services/security/cache/redisCacheService');

console.log('🧪 Starting Inquiry & Booking Disposable Email Security Verification...\n');

let passedTests = 0;
let totalTests = 0;

function pass(name, details = '') {
  totalTests++;
  passedTests++;
  console.log(`  ✅ [PASS] ${name}${details ? ` — ${details}` : ''}`);
}

function fail(name, error) {
  totalTests++;
  console.error(`  ❌ [FAIL] ${name}`);
  console.error(error);
  process.exit(1);
}

// Helper to simulate Express req/res/next lifecycle
function mockHttp({ body = {}, params = {}, user = null, ip = '127.0.0.1', headers = {} } = {}) {
  let resStatus = null;
  let resJson = null;
  let nextError = null;

  const req = {
    body,
    params,
    user,
    ip,
    headers,
    connection: { remoteAddress: ip },
  };

  const res = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(payload) {
      resJson = payload;
      return this;
    },
  };

  const next = (err) => {
    nextError = err;
  };

  return {
    req,
    res,
    next,
    getResult: () => ({ status: resStatus, json: resJson, error: nextError }),
  };
}

async function runInquiryBookingSecuritySuite() {
  try {
    clearCache();
    redisCacheService.clearCache();

    // ── Test 1: Direct Contact Message With Known Disposable Email is Blocked ──
    const ctx1 = mockHttp({
      body: {
        name: 'Spam Bot',
        email: 'attacker@temp-mail.org',
        phone: '+91 9876543210',
        subject: 'General Inquiry',
        message: 'Looking for a flat in Mumbai.',
      },
    });

    await submitContactMessage(ctx1.req, ctx1.res, ctx1.next);
    const res1 = ctx1.getResult();

    assert.ok(res1.error, 'Must pass AppError to next()');
    assert.strictEqual(res1.error.statusCode, 400);
    assert.ok(
      res1.error.message.includes('Temporary or disposable email addresses cannot be used'),
      `Error message must explain disposable rejection: "${res1.error.message}"`
    );
    pass('Direct Message Blocked (Known Disposable)', 'attacker@temp-mail.org rejected with 400');

    // ── Test 2: Direct Contact Message With Burner Mail (findize.com) via Dynamic Intelligence ──
    externalPrimaryProvider.setMockHandler(async ({ domain }) => {
      if (domain === 'findize.com') {
        return { isDisposable: true, isTemporary: true, confidence: 95, provider: 'cloud_intel' };
      }
      return null;
    });

    const ctx2 = mockHttp({
      body: {
        name: 'Disposable Visitor',
        email: 'fofew27643@findize.com',
        phone: '+91 7600973093',
        subject: 'Legal & RERA Consultation',
        message: 'Can I verify this builder RERA number?',
      },
    });

    await submitContactMessage(ctx2.req, ctx2.res, ctx2.next);
    const res2 = ctx2.getResult();

    assert.ok(res2.error, 'Burner email must trigger error');
    assert.strictEqual(res2.error.statusCode, 400);
    pass('Direct Message Blocked (Dynamic Burner findize.com)', 'fofew27643@findize.com intercepted and rejected');

    // ── Test 3: Direct Contact Message With Malformed Syntax Email is Blocked ──
    const ctx3 = mockHttp({
      body: {
        name: 'Invalid User',
        email: 'invalid..format@broken-domain',
        phone: '+91 9876543210',
        subject: 'General Inquiry',
        message: 'Hello, need information.',
      },
    });

    await submitContactMessage(ctx3.req, ctx3.res, ctx3.next);
    const res3 = ctx3.getResult();

    assert.ok(res3.error, 'Malformed email must trigger error');
    assert.strictEqual(res3.error.statusCode, 400);
    pass('Direct Message Blocked (Invalid Syntax)', 'invalid..format@broken-domain rejected');

    // ── Test 4: Property Inquiry With Known Disposable Email is Blocked ──
    const ctx4 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      body: {
        name: 'Scraper Bot',
        email: 'scraper@mailinator.com',
        phone: '+91 9123456780',
        message: 'Send me all pricing details and unit numbers.',
        visitRequested: false,
      },
    });

    await submitInquiry(ctx4.req, ctx4.res, ctx4.next);
    const res4 = ctx4.getResult();

    assert.ok(res4.error, 'Property inquiry with disposable email must fail');
    assert.strictEqual(res4.error.statusCode, 400);
    assert.ok(
      res4.error.message.includes('disposable email addresses cannot be used'),
      `Error message: "${res4.error.message}"`
    );
    pass('Property Inquiry Blocked (mailinator.com)', 'scraper@mailinator.com rejected before database write');

    // ── Test 5: Property Site Visit Booking With Disposable Email is Blocked ──
    const ctx5 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      body: {
        name: 'Fake Appointment Lead',
        email: 'fakelead@guerrillamail.com',
        phone: '+91 9988776655',
        message: 'Book a site visit for Saturday morning.',
        visitRequested: true,
        visitDate: '2026-10-15',
        visitTime: 'Morning (10 AM - 1 PM)',
      },
    });

    await submitInquiry(ctx5.req, ctx5.res, ctx5.next);
    const res5 = ctx5.getResult();

    assert.ok(res5.error, 'Site visit booking with disposable email must fail');
    assert.strictEqual(res5.error.statusCode, 400);
    pass('Site Visit Booking Blocked (guerrillamail.com)', 'fakelead@guerrillamail.com prevented from booking appointments');

    // ── Test 6: Site Visit Booking With Burner Mail (findize.com) is Blocked ──
    const ctx6 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      body: {
        name: 'Burner Visit Booker',
        email: 'visittest@findize.com',
        phone: '+91 9876543210',
        message: 'I want to see the penthouse unit.',
        visitRequested: true,
        visitDate: '2026-10-16',
        visitTime: 'Afternoon (1 PM - 4 PM)',
      },
    });

    await submitInquiry(ctx6.req, ctx6.res, ctx6.next);
    const res6 = ctx6.getResult();

    assert.ok(res6.error);
    assert.strictEqual(res6.error.statusCode, 400);
    pass('Site Visit Booking Blocked (findize.com)', 'visittest@findize.com prevented from booking appointments');

    // ── Test 7: Legitimate Email Validation Check Passes ──
    externalPrimaryProvider.clearMockHandler();
    clearCache();
    redisCacheService.clearCache();

    const { isDisposableEmail } = require('../services/disposableEmailService');
    const legitBuyerCheck = await isDisposableEmail('rahul.mehta@gmail.com');
    assert.strictEqual(legitBuyerCheck.isDisposable, false);
    pass('Legitimate Email Allowed', 'rahul.mehta@gmail.com confirmed legitimate for inquiries and bookings');

    // ── Test 8: Unverified User Blocked From Submitting Property Inquiry ──
    const ctx8 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      user: { id: '60c72b2f9b1d8b2bad000099', email: 'unverified.buyer@gmail.com', isVerified: false },
      body: {
        name: 'Unverified Buyer',
        email: 'unverified.buyer@gmail.com',
        phone: '+91 9876543210',
        message: 'I want information on 3BHK flat.',
        visitRequested: false,
      },
    });

    await submitInquiry(ctx8.req, ctx8.res, ctx8.next);
    const res8 = ctx8.getResult();
    assert.strictEqual(res8.status, 403, 'Unverified user must receive 403 Forbidden');
    assert.strictEqual(res8.json?.requiresEmailVerification, true, 'Response must flag requiresEmailVerification');
    assert.ok(
      res8.json?.message?.includes('Email verification required'),
      `Expected verification required message, got: ${res8.json?.message}`
    );
    pass('Unverified User Inquiry Blocked', 'unverified.buyer@gmail.com blocked with 403 until email is verified');

    // ── Test 9: Unverified User Blocked From Booking Site Visit ──
    const ctx9 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      user: { id: '60c72b2f9b1d8b2bad000099', email: 'unverified.buyer@gmail.com', isVerified: false },
      body: {
        name: 'Unverified Buyer',
        email: 'unverified.buyer@gmail.com',
        phone: '+91 9876543210',
        message: 'Book visit for Sunday.',
        visitRequested: true,
        visitDate: '2026-10-20',
        visitTime: '10:00 AM - 12:00 PM',
      },
    });

    await submitInquiry(ctx9.req, ctx9.res, ctx9.next);
    const res9 = ctx9.getResult();
    assert.strictEqual(res9.status, 403, 'Unverified user site visit booking must receive 403 Forbidden');
    assert.strictEqual(res9.json?.requiresEmailVerification, true);
    assert.ok(
      res9.json?.message?.includes('Email verification required before booking a site visit') ||
      res9.json?.message?.includes('Email verification required'),
      `Expected verification message, got: ${res9.json?.message}`
    );
    pass('Unverified User Site Visit Blocked', 'Site visit booking rejected with 403 requiresEmailVerification: true');

    // ── Test 10: Dynamic MX / PTR Interception of olipii.com (Temp-Mail.io relay node) ──
    clearCache();
    redisCacheService.clearCache();
    const olipiiCheck = await isDisposableEmail('1jhqasmyiz@olipii.com');
    assert.strictEqual(olipiiCheck.isDisposable, true, '1jhqasmyiz@olipii.com must be flagged as disposable');
    assert.ok(
      olipiiCheck.publicMessage?.includes('Access Blocked'),
      `Expected Access Blocked in publicMessage, got: ${olipiiCheck.publicMessage}`
    );
    pass('Dynamic Temp-Mail Intercept (olipii.com)', '1jhqasmyiz@olipii.com detected as disposable via MX/PTR intelligence');

    // ── Test 11: Verified User Allowed to Book Site Visit ──
    const Property = require('../models/Property');
    const Inquiry = require('../models/Inquiry');
    const origPropFind = Property.findById;
    const origInqCreate = Inquiry.create;
    const origInqUpdateMany = Inquiry.updateMany;
    const origInqFindOne = Inquiry.findOne;

    Property.findById = async () => null;
    Inquiry.create = async (doc) => ({ ...doc, _id: 'mock_inquiry_id' });
    Inquiry.updateMany = async () => ({ modifiedCount: 0 });
    const mockFindOne = (retVal = null) => {
      return {
        sort: () => Promise.resolve(retVal),
        then: (resolve, reject) => Promise.resolve(retVal).then(resolve, reject),
      };
    };
    Inquiry.findOne = () => mockFindOne(null);

    const ctx11 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      user: { id: '60c72b2f9b1d8b2bad000077', email: 'verified.buyer@gmail.com', isVerified: true },
      body: {
        name: 'Verified Buyer',
        email: 'verified.buyer@gmail.com',
        phone: '+91 9876543210',
        message: 'Book confirmed visit for Monday.',
        visitRequested: true,
        visitDate: '2026-10-22',
        visitTime: '02:00 PM - 04:00 PM',
      },
    });

    await submitInquiry(ctx11.req, ctx11.res, ctx11.next);
    const res11 = ctx11.getResult();
    assert.strictEqual(res11.status, 200, 'Verified user must be accepted with 200 OK');
    assert.strictEqual(res11.json?.success, true);
    assert.ok(res11.json?.message?.includes('Site visit booked successfully'));
    pass('Verified User Site Visit Allowed', 'verified.buyer@gmail.com successfully books site visit');

    // ── Test 12: User Blocked From Submitting New Inquiry If Previous Inquiry is Pending ──
    Inquiry.findOne = () => mockFindOne({
      _id: 'pending_inq_1',
      status: 'new',
      propertyTitle: 'Luxury Skyline Villa',
      visitRequested: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // Within 7-day window
    });

    const ctx12 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000001' },
      user: { id: '60c72b2f9b1d8b2bad000077', email: 'verified.buyer@gmail.com', isVerified: true },
      body: {
        name: 'Verified Buyer',
        email: 'verified.buyer@gmail.com',
        phone: '+91 9876543210',
        message: 'Can I also inquire about this other unit?',
      },
    });

    await submitInquiry(ctx12.req, ctx12.res, ctx12.next);
    const res12 = ctx12.getResult();
    assert.strictEqual(res12.status, 400, 'Must block new inquiry when previous inquiry is still pending');
    assert.strictEqual(res12.json?.pendingInquiry, true);
    assert.ok(
      res12.json?.message?.includes('You already have a pending property inquiry') &&
      res12.json?.message?.includes('awaiting response'),
      `Expected sequential blocking message, got: ${res12.json?.message}`
    );
    pass('Pending Inquiry Sequential Blocking (Per Property, 7-day rule)', 'User cannot send another inquiry to same property while active inquiry is awaiting response');

    // ── Test 13: User Allowed To Submit Inquiry When Previous Inquiry is Answered (contacted/closed) ──
    Inquiry.findOne = () => mockFindOne(null); // Active query returns null because previous inquiry is status 'contacted' or 'closed'
    const ctx13 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000002' },
      user: { id: '60c72b2f9b1d8b2bad000077', email: 'verified.buyer@gmail.com', isVerified: true },
      body: {
        name: 'Verified Buyer',
        email: 'verified.buyer@gmail.com',
        phone: '+91 9876543210',
        message: 'Inquiring about another project now that previous was answered.',
      },
    });

    await submitInquiry(ctx13.req, ctx13.res, ctx13.next);
    const res13 = ctx13.getResult();
    assert.strictEqual(res13.status, 200, 'User should be allowed to submit when previous inquiry is answered');
    assert.strictEqual(res13.json?.success, true);
    pass('Answered Inquiry Allows Next Inquiry', 'User can submit next inquiry after previous one has been answered/contacted');

    // ── Test 14: Auto-Rejected Inquiry (>7 days) Allows Next Inquiry ──
    let updateManyCalled = false;
    Inquiry.updateMany = async () => {
      updateManyCalled = true;
      return { modifiedCount: 1 };
    };
    Inquiry.findOne = () => mockFindOne(null); // Auto-rejected inquiries are transitioned, so active query returns null

    const ctx14 = mockHttp({
      params: { id: '60c72b2f9b1d8b2bad000003' },
      user: { id: '60c72b2f9b1d8b2bad000077', email: 'verified.buyer@gmail.com', isVerified: true },
      body: {
        name: 'Verified Buyer',
        email: 'verified.buyer@gmail.com',
        phone: '+91 9876543210',
        message: 'Submitting new inquiry after previous one was auto-rejected after 7 days.',
      },
    });

    await submitInquiry(ctx14.req, ctx14.res, ctx14.next);
    const res14 = ctx14.getResult();
    assert.strictEqual(updateManyCalled, true, 'Auto-reject updateMany must be triggered on inquiry submission');
    assert.strictEqual(res14.status, 200, 'User should be allowed to submit when previous inquiry was auto-rejected');
    assert.strictEqual(res14.json?.success, true);
    pass('Auto-Rejected Inquiry (>7 days) Allows Next Inquiry', 'Inquiry auto-rejected after 7 days, allowing user to submit new inquiry for same property');


    // Restore original methods
    Property.findById = origPropFind;
    Inquiry.create = origInqCreate;
    Inquiry.updateMany = origInqUpdateMany;
    Inquiry.findOne = origInqFindOne;

    console.log(`\n🎉 All ${totalTests} Inquiry & Booking Disposable Email, Expiry & Sequential Inquiry Tests Passed Successfully!\n`);
  } catch (err) {
    fail('Inquiry & Booking Security Test Suite Encountered an Error', err);
  }
}

runInquiryBookingSecuritySuite();
