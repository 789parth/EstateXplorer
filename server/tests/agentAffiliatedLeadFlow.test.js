const assert = require('assert');
const { maskPhone, maskEmail, projectLeadForUser } = require('../services/leadPrivacyService');
const { computeFingerprint } = require('../services/attributionEngine');

async function testAgentAffiliatedLeadFlow() {
  console.log('\n🚀 Starting Agent-Affiliated Lead Flow & Attribution Privacy Verification...');

  // 1. Verify Phone Masking matches +91******1234
  console.log('\n[TEST 1] Masked Buyer Contact Format Verification');
  const testPhone1 = '9876541234';
  const testPhone2 = '+91 9876541234';
  const testPhone3 = '+919876541234';
  const testPhone4 = '8123459999';

  assert.strictEqual(maskPhone(testPhone1), '+91******1234', '10-digit phone must format as +91******1234');
  assert.strictEqual(maskPhone(testPhone2), '+91******1234', 'Spaced +91 phone must format as +91******1234');
  assert.strictEqual(maskPhone(testPhone3), '+91******1234', 'Unspaced +91 phone must format as +91******1234');
  assert.strictEqual(maskPhone(testPhone4), '+91******9999', 'Other 10-digit number must retain last 4 digits');
  console.log('✅ Masked Buyer Contact format strictly verified as +91******1234');

  // 2. Buyer submits Inquiry via Agent Affiliated Link
  console.log('\n[TEST 2] Inquiry via Agent Affiliated Link');
  const agentLead = {
    _id: 'inq-001',
    projectName: 'Skyline Heights',
    propertyTitle: 'Tower A - 3 BHK Deluxe',
    project: 'proj-001',
    property: 'prop-001',
    builder: 'builder-101',
    agent: 'agent-202',
    agentCode: 'CP-ALPHA01',
    isAttributed: true,
    visitRequested: false,
    name: 'Rahul Mehta',
    phone: '9876541234',
    email: 'rahul.mehta@example.com',
    message: 'I am interested in Tower A 3 BHK.',
    status: 'new',
    lifecycleStage: 'new',
  };

  // Projected for Builder
  const builderUser = { _id: 'builder-101', role: 'builder' };
  const builderLeadView = projectLeadForUser(agentLead, builderUser);

  assert.strictEqual(builderLeadView.isContactMasked, true, 'Builder must see contact masked for agent-affiliated lead');
  assert.strictEqual(builderLeadView.phone, '+91******1234', 'Builder must see phone strictly masked as +91******1234');
  assert.strictEqual(builderLeadView.email.includes('***@'), true, 'Builder must see email masked');
  assert.strictEqual(builderLeadView.agentCode, 'CP-ALPHA01', 'Builder must be able to identify the Agent who generated the lead');
  assert.strictEqual(builderLeadView.projectName, 'Skyline Heights', 'Project name must be visible');
  assert.strictEqual(builderLeadView.propertyTitle, 'Tower A - 3 BHK Deluxe', 'Property title must be visible');
  console.log('✅ Builder Dashboard receives masked contact (+91******1234) and identifies the Agent for affiliated inquiries');

  // Projected for Agent
  const agentUser = { _id: 'agent-202', role: 'agent' };
  const agentLeadView = projectLeadForUser(agentLead, agentUser);

  assert.strictEqual(agentLeadView.isContactMasked, false, 'Agent must receive 100% full contact details for their lead');
  assert.strictEqual(agentLeadView.phone, '9876541234', 'Agent sees unmasked phone number');
  assert.strictEqual(agentLeadView.email, 'rahul.mehta@example.com', 'Agent sees unmasked email');
  assert.strictEqual(agentLeadView.projectName, 'Skyline Heights', 'Agent sees Project');
  assert.strictEqual(agentLeadView.propertyTitle, 'Tower A - 3 BHK Deluxe', 'Agent sees Property');
  console.log('✅ Agent Dashboard receives full contact details and lead info for affiliated inquiries');

  // 3. Buyer books Site Visit via Agent Affiliated Link
  console.log('\n[TEST 3] Site Visit Booking via Agent Affiliated Link');
  const agentVisit = {
    _id: 'visit-001',
    projectName: 'Skyline Heights',
    propertyTitle: 'Tower A - 3 BHK Deluxe',
    project: 'proj-001',
    property: 'prop-001',
    builder: 'builder-101',
    agent: 'agent-202',
    agentCode: 'CP-ALPHA01',
    isAttributed: true,
    visitRequested: true,
    visitDate: '2026-10-15',
    visitTime: 'Morning (10 AM - 1 PM)',
    name: 'Priya Sharma',
    phone: '9988771234',
    email: 'priya.sharma@example.com',
    message: 'Site visit for weekend tour.',
    status: 'visit',
    lifecycleStage: 'site_visit_scheduled',
  };

  const builderVisitView = projectLeadForUser(agentVisit, builderUser);
  assert.strictEqual(builderVisitView.isContactMasked, true, 'Builder must see contact masked for agent site visit');
  assert.strictEqual(builderVisitView.phone, '+91******1234', 'Builder must see masked phone (+91******1234)');
  assert.strictEqual(builderVisitView.visitRequested, true, 'Visit requested flag preserved');
  assert.strictEqual(builderVisitView.visitDate, '2026-10-15', 'Visit date preserved');
  assert.strictEqual(builderVisitView.visitTime, 'Morning (10 AM - 1 PM)', 'Visit time preserved');
  console.log('✅ Builder Dashboard receives agent-generated site visit with masked contact and visit schedule');

  const agentVisitView = projectLeadForUser(agentVisit, agentUser);
  assert.strictEqual(agentVisitView.isContactMasked, false, 'Agent gets full contact details for site visit');
  assert.strictEqual(agentVisitView.phone, '9988771234', 'Agent sees unmasked phone for site visit');
  assert.strictEqual(agentVisitView.visitDate, '2026-10-15', 'Agent sees scheduled visit date');
  console.log('✅ Agent Dashboard receives full contact details and booking schedule for site visit');

  // 4. Buyer comes Directly (No Agent Link)
  console.log('\n[TEST 4] Direct Organic Traffic (No Agent Link)');
  const directLead = {
    _id: 'inq-002',
    projectName: 'Skyline Heights',
    propertyTitle: 'Tower B - Penthouse',
    project: 'proj-001',
    property: 'prop-002',
    builder: 'builder-101',
    agent: null,
    agentCode: null,
    isAttributed: false,
    visitRequested: false,
    name: 'Ananya Roy',
    phone: '9123456789',
    email: 'ananya@example.com',
    message: 'Direct website inquiry.',
    status: 'new',
    lifecycleStage: 'new',
  };

  const builderDirectView = projectLeadForUser(directLead, builderUser);
  assert.strictEqual(builderDirectView.isContactMasked, false, 'Direct leads must NOT be masked for builder');
  assert.strictEqual(builderDirectView.phone, '9123456789', 'Builder sees full unmasked phone');
  assert.strictEqual(builderDirectView.email, 'ananya@example.com', 'Builder sees full unmasked email');
  assert.strictEqual(builderDirectView.agent, null, 'No agent associated with direct lead');
  assert.strictEqual(builderDirectView.agentCode, null, 'No agentCode associated with direct lead');
  console.log('✅ Direct website inquiries go directly to Builder with full unmasked contact details and no agent associated');

  console.log('\n🎉 ALL AGENT-AFFILIATED LEAD FLOW & PRIVACY TESTS PASSED SUCCESSFULLY!\n');
}

testAgentAffiliatedLeadFlow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
