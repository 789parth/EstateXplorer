const assert = require('assert');
const {
  normalizePhoneNumber,
  sendSmsGateway,
  notifySellerOnNewLead,
  notifyBuyerOnStatusChange,
} = require('../services/smsNotificationService');
const NotificationLog = require('../models/NotificationLog');

console.log('Starting SMS Alert Gateway Verification...');
let passedTests = 0;

function pass(name, details) {
  passedTests++;
  console.log('  PASS: ' + name + (details ? ' - ' + details : ''));
}

async function runTests() {
  // Ensure test runs in simulated sandbox mode without external network calls
  const origFast2sms = process.env.FAST2SMS_API_KEY;
  const origTwilioSid = process.env.TWILIO_ACCOUNT_SID;
  const origTwilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const origVerifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  delete process.env.FAST2SMS_API_KEY;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_VERIFY_SERVICE_SID;

  assert.strictEqual(normalizePhoneNumber('9876543210'), '9876543210');
  assert.strictEqual(normalizePhoneNumber('+91 98765 43210'), '9876543210');
  assert.strictEqual(normalizePhoneNumber('+919876543210'), '9876543210');
  assert.strictEqual(normalizePhoneNumber('09876543210'), '9876543210');
  pass('Phone Number Normalization', 'Correctly formats 10-digit Indian standard');

  const invalidRes = await sendSmsGateway({ phone: '123', message: 'Test message' });
  assert.strictEqual(invalidRes.success, false);
  assert.strictEqual(invalidRes.reason, 'INVALID_PHONE_NUMBER');
  pass('Invalid Phone Rejection', 'Safely rejects short / malformed phone numbers');

  const origCreate = NotificationLog.create;
  let loggedPayload = null;
  NotificationLog.create = async (doc) => {
    loggedPayload = doc;
    return { ...doc, _id: 'mock_log_id' };
  };

  const simResult = await sendSmsGateway({
    phone: '9876543210',
    message: 'EstateXplorer Alert: Test alert payload',
    type: 'TEST_ALERT',
    recipient: { _id: 'seller_123', name: 'John Seller' },
    metadata: { test: true },
  });
  assert.strictEqual(simResult.success, true);
  assert.strictEqual(simResult.status, 'SIMULATED');
  assert.strictEqual(simResult.gateway, 'simulated');
  assert.strictEqual(simResult.phone, '9876543210');
  assert(simResult.gatewayMessageId.startsWith('SIM_'));
  assert.strictEqual(loggedPayload.recipientPhone, '9876543210');
  assert.strictEqual(loggedPayload.channel, 'sms');
  assert.strictEqual(loggedPayload.type, 'TEST_ALERT');
  pass('Simulated SMS Gateway Dispatch & Audit Log', 'Builds NotificationLog record');

  const disabledSeller = { _id: 'seller_disabled', phone: '9876543210', smsNotifications: false };
  const inquiryData = { _id: 'inq_1', name: 'Buyer Bob', phone: '9123456780', visitRequested: true, visitDate: '2026-09-25', visitTime: '11:00 AM' };
  const propData = { _id: 'prop_1', title: 'Skyline Luxury Villa' };

  const skippedResult = await notifySellerOnNewLead({ sellerUser: disabledSeller, inquiry: inquiryData, property: propData });
  assert.strictEqual(skippedResult.skipped, true);
  assert.strictEqual(skippedResult.reason, 'SMS_DISABLED_OR_NO_PHONE');
  pass('Seller SMS Opt-Out Compliance', 'Skips SMS when sellerUser.smsNotifications is false');

  const enabledSeller = { _id: 'seller_enabled', name: 'Builder Apex', phone: '9876543210', smsNotifications: true };
  loggedPayload = null;
  const leadAlertResult = await notifySellerOnNewLead({ sellerUser: enabledSeller, inquiry: inquiryData, property: propData });
  assert.strictEqual(leadAlertResult.success, true);
  assert.strictEqual(leadAlertResult.status, 'SIMULATED');
  assert.strictEqual(loggedPayload.type, 'SITE_VISIT_BOOKED');
  assert(loggedPayload.message.includes('New Site Visit booked by Buyer Bob'));
  assert(loggedPayload.message.includes('Skyline Luxury Villa'));
  pass('Site Visit Alert Notification to Seller', 'Delivers to seller');

  const buyerUser = { _id: 'buyer_1', name: 'Buyer Bob', phone: '9123456780', smsNotifications: true };
  loggedPayload = null;
  const buyerConfirmResult = await notifyBuyerOnStatusChange({
    buyerUser,
    inquiry: inquiryData,
    property: propData,
    newStatus: 'closed',
  });
  assert.strictEqual(buyerConfirmResult.success, true);
  assert.strictEqual(loggedPayload.type, 'SITE_VISIT_CONFIRMED');
  assert(loggedPayload.message.includes('marked confirmed & completed'));
  pass('Buyer Tour Confirmation Notification', 'Dispatches confirmation SMS to buyer');

  loggedPayload = null;
  const buyerScheduleResult = await notifyBuyerOnStatusChange({
    buyerUser,
    inquiry: inquiryData,
    property: propData,
    newStatus: 'visit',
    extraData: { visitDate: '2026-09-30', visitTime: '3:00 PM' },
  });
  assert.strictEqual(buyerScheduleResult.success, true);
  assert.strictEqual(loggedPayload.type, 'SITE_VISIT_RESCHEDULED');
  assert(loggedPayload.message.includes('2026-09-30 at 3:00 PM'));
  pass('Buyer Tour Reschedule Notification', 'Dispatches updated appointment time SMS');

  const buyerOptedOut = { _id: 'buyer_2', name: 'Opt Out', phone: '9123456780', smsNotifications: false };
  const optOutResult = await notifyBuyerOnStatusChange({
    buyerUser: buyerOptedOut,
    inquiry: inquiryData,
    property: propData,
    newStatus: 'visit',
  });
  assert.strictEqual(optOutResult.skipped, true);
  assert.strictEqual(optOutResult.reason, 'BUYER_SMS_DISABLED');
  pass('Buyer Opt-Out Compliance', 'Respects buyerUser.smsNotifications === false');

  NotificationLog.create = origCreate;
  if (origFast2sms) process.env.FAST2SMS_API_KEY = origFast2sms;
  if (origTwilioSid) process.env.TWILIO_ACCOUNT_SID = origTwilioSid;
  if (origTwilioAuth) process.env.TWILIO_AUTH_TOKEN = origTwilioAuth;
  if (origVerifySid) process.env.TWILIO_VERIFY_SERVICE_SID = origVerifySid;
  console.log('All ' + passedTests + ' SMS Gateway Tests Passed Successfully!');
}
runTests().catch(e => { console.error(e); process.exit(1); });