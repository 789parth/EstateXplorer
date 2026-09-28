const assert = require('assert');
const { maskPhone, maskEmail, projectLeadForUser, projectLeadsForUser } = require('../services/leadPrivacyService');

async function runTests() {
  console.log('\n🔒 Starting Enterprise Channel Partner Lead Privacy & Two-Way Masking Test Suite...');

  // Test 1: Masking functions
  console.log('\n[TEST 1] Phone and Email Masking Utilities');
  const maskedPhone1 = maskPhone('+919876543210');
  const maskedPhone2 = maskPhone('9876543210');
  const maskedEmail1 = maskEmail('buyer.vip@example.com');
  const maskedEmail2 = maskEmail('test@gmail.com');

  assert.strictEqual(maskedPhone1.includes('******'), true, 'Masked phone should conceal trailing digits');
  assert.strictEqual(maskedEmail1.startsWith('b***@example.com'), true, 'Masked email should conceal username');
  assert.strictEqual(maskedEmail2.startsWith('t***@gmail.com'), true, 'Masked email should conceal username');
  console.log('✅ Phone and Email masking utilities working accurately');

  // Mock Leads
  const attributedLead = {
    _id: 'lead-101',
    name: 'Rohit Sharma',
    email: 'rohit@cricket.com',
    phone: '9876543210',
    builder: 'builder-1',
    agent: 'agent-1',
    agentCode: 'CP-ROHIT01',
    isAttributed: true,
    lifecycleStage: 'contacted',
  };

  const directLead = {
    _id: 'lead-102',
    name: 'Virat Kohli',
    email: 'virat@cricket.com',
    phone: '9876543211',
    builder: 'builder-1',
    agent: null,
    agentCode: null,
    isAttributed: false,
    lifecycleStage: 'new',
  };

  // Test 2: Attributed Lead projected for Builder (MUST BE MASKED)
  console.log('\n[TEST 2] Attributed Lead Projected for Builder (Two-Way Masking Invariant)');
  const builderUser = { _id: 'builder-1', role: 'builder' };
  const builderProjected = projectLeadForUser(attributedLead, builderUser);

  assert.strictEqual(builderProjected.isContactMasked, true, 'isContactMasked must be true for builder on attributed lead');
  assert.strictEqual(builderProjected.phone.includes('******'), true, 'Builder must see masked phone');
  assert.strictEqual(builderProjected.email.includes('***@'), true, 'Builder must see masked email');
  console.log('✅ Builder receives masked contact details for attributed leads');

  // Test 3: Attributed Lead projected for Assigned Agent (MUST BE FULL CONTACT)
  console.log('\n[TEST 3] Attributed Lead Projected for Assigned Channel Partner Agent');
  const agentUser = { _id: 'agent-1', role: 'agent' };
  const agentProjected = projectLeadForUser(attributedLead, agentUser);

  assert.strictEqual(agentProjected.isContactMasked, false, 'isContactMasked must be false for assigned agent');
  assert.strictEqual(agentProjected.phone, '9876543210', 'Agent must see unmasked phone');
  assert.strictEqual(agentProjected.email, 'rohit@cricket.com', 'Agent must see unmasked email');
  console.log('✅ Assigned Agent receives 100% full contact details');

  // Test 4: Direct Unattributed Lead projected for Builder (MUST BE 100% FULL CONTACT)
  console.log('\n[TEST 4] Direct Organic Lead Projected for Builder');
  const directProjected = projectLeadForUser(directLead, builderUser);

  assert.strictEqual(directProjected.isContactMasked, false, 'isContactMasked must be false for direct leads to builder');
  assert.strictEqual(directProjected.phone, '9876543211', 'Builder must see full unmasked phone for direct leads');
  assert.strictEqual(directProjected.email, 'virat@cricket.com', 'Builder must see full unmasked email for direct leads');
  console.log('✅ Builder receives 100% full contact details for direct organic leads');

  // Test 5: Admin projection (Complete visibility)
  console.log('\n[TEST 5] Admin Complete Visibility');
  const adminUser = { _id: 'admin-1', role: 'admin' };
  const adminProjected = projectLeadForUser(attributedLead, adminUser);

  assert.strictEqual(adminProjected.phone, '9876543210', 'Admin must see unmasked phone');
  assert.strictEqual(adminProjected.email, 'rohit@cricket.com', 'Admin must see unmasked email');
  console.log('✅ Admin has complete audit visibility');

  console.log('\n🎉 ALL TWO-WAY MASKING & PRIVACY INVARIANTS VERIFIED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Privacy Test Suite Failed:', err);
  process.exit(1);
});
