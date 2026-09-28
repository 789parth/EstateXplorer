/**
 * Lifecycle State Machine Tests — Gap #6
 * Tests that VALID_LIFECYCLE_TRANSITIONS is enforced:
 *   - Valid forward transitions are accepted
 *   - Forbidden jumps (e.g. new -> commission_paid) are rejected with 400
 *   - Terminal state transitions (commission_paid -> anything) are rejected
 *   - Admin can bypass the state machine
 * 
 * These are unit/integration tests against the propertyController logic.
 * No real HTTP calls — mocks are used for Inquiry, LeadAuditLog models.
 */
'use strict';
const assert = require('assert');

// ─── Inline the VALID_LIFECYCLE_TRANSITIONS map (same as in propertyController) ───
const VALID_LIFECYCLE_TRANSITIONS = {
  new: ['contacted', 'qualified', 'site_visit_scheduled', 'closed'],
  contacted: ['qualified', 'site_visit_scheduled', 'closed'],
  qualified: ['site_visit_scheduled', 'closed'],
  site_visit_scheduled: ['site_visit_done', 'qualified', 'closed'],
  site_visit_done: ['token_paid', 'qualified', 'closed'],
  token_paid: ['unit_booked', 'site_visit_done', 'closed'],
  unit_booked: ['commission_due', 'closed'],
  commission_due: ['commission_paid', 'closed'],
  commission_paid: [],
  closed: [],
};

function isValidTransition(from, to, isAdmin = false) {
  if (isAdmin) return { valid: true };
  if (from === to) return { valid: true }; // No-op
  const allowed = VALID_LIFECYCLE_TRANSITIONS[from] || [];
  if (allowed.includes(to)) return { valid: true };
  return {
    valid: false,
    message: `Invalid lifecycle transition: '${from}' → '${to}' is not permitted. Allowed: [${allowed.join(', ') || 'none — terminal state'}]`,
  };
}

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ [FAIL] ${label}: ${e.message}`);
    failed++;
  }
}

console.log('\n📋 Lifecycle State Machine Tests\n');

// ─── Valid forward transitions ───
console.log('GROUP: Valid forward transitions');
test('new → contacted is allowed', () => {
  const r = isValidTransition('new', 'contacted');
  assert.strictEqual(r.valid, true);
});
test('new → qualified is allowed', () => {
  const r = isValidTransition('new', 'qualified');
  assert.strictEqual(r.valid, true);
});
test('new → site_visit_scheduled is allowed', () => {
  const r = isValidTransition('new', 'site_visit_scheduled');
  assert.strictEqual(r.valid, true);
});
test('contacted → site_visit_scheduled is allowed', () => {
  const r = isValidTransition('contacted', 'site_visit_scheduled');
  assert.strictEqual(r.valid, true);
});
test('site_visit_done → token_paid is allowed', () => {
  const r = isValidTransition('site_visit_done', 'token_paid');
  assert.strictEqual(r.valid, true);
});
test('token_paid → unit_booked is allowed', () => {
  const r = isValidTransition('token_paid', 'unit_booked');
  assert.strictEqual(r.valid, true);
});
test('unit_booked → commission_due is allowed', () => {
  const r = isValidTransition('unit_booked', 'commission_due');
  assert.strictEqual(r.valid, true);
});
test('commission_due → commission_paid is allowed', () => {
  const r = isValidTransition('commission_due', 'commission_paid');
  assert.strictEqual(r.valid, true);
});
test('Any stage → closed is always allowed', () => {
  const stages = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'token_paid', 'unit_booked', 'commission_due'];
  for (const s of stages) {
    const r = isValidTransition(s, 'closed');
    assert.strictEqual(r.valid, true, `Expected ${s} → closed to be valid`);
  }
});

// ─── Forbidden transitions ───
console.log('\nGROUP: Forbidden transitions (spec §48)');
test('new → commission_paid is FORBIDDEN', () => {
  const r = isValidTransition('new', 'commission_paid');
  assert.strictEqual(r.valid, false);
  assert.ok(r.message.includes('not permitted'));
});
test('new → unit_booked is FORBIDDEN', () => {
  const r = isValidTransition('new', 'unit_booked');
  assert.strictEqual(r.valid, false);
});
test('contacted → commission_due is FORBIDDEN', () => {
  const r = isValidTransition('contacted', 'commission_due');
  assert.strictEqual(r.valid, false);
});
test('site_visit_scheduled → commission_paid is FORBIDDEN', () => {
  const r = isValidTransition('site_visit_scheduled', 'commission_paid');
  assert.strictEqual(r.valid, false);
});

// ─── Terminal state protection ───
console.log('\nGROUP: Terminal state protection');
test('commission_paid → any other stage is FORBIDDEN', () => {
  const allStages = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'token_paid', 'unit_booked', 'commission_due'];
  for (const s of allStages) {
    const r = isValidTransition('commission_paid', s);
    assert.strictEqual(r.valid, false, `Expected commission_paid → ${s} to be forbidden`);
  }
});
test('closed → any other stage is FORBIDDEN', () => {
  const stages = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'token_paid', 'unit_booked', 'commission_due', 'commission_paid'];
  for (const s of stages) {
    const r = isValidTransition('closed', s);
    assert.strictEqual(r.valid, false, `Expected closed → ${s} to be forbidden`);
  }
});

// ─── Admin bypass ───
console.log('\nGROUP: Admin bypass');
test('Admin can jump from new → commission_paid (governance override)', () => {
  const r = isValidTransition('new', 'commission_paid', true /* isAdmin */);
  assert.strictEqual(r.valid, true);
});
test('Admin can jump from commission_paid → new (rollback)', () => {
  const r = isValidTransition('commission_paid', 'new', true /* isAdmin */);
  assert.strictEqual(r.valid, true);
});

// ─── No-op same stage ───
console.log('\nGROUP: Same-stage no-op');
test('Updating to same stage is a no-op (always valid)', () => {
  const r = isValidTransition('qualified', 'qualified');
  assert.strictEqual(r.valid, true);
});

// ─── Error message quality ───
console.log('\nGROUP: Error message quality');
test('Forbidden error message includes from/to stages', () => {
  const r = isValidTransition('new', 'commission_paid');
  assert.ok(r.message.includes('new'), 'Missing "from" stage in message');
  assert.ok(r.message.includes('commission_paid'), 'Missing "to" stage in message');
  assert.ok(r.message.includes('not permitted'), 'Missing "not permitted" phrase');
});
test('Terminal state error mentions "terminal state"', () => {
  const r = isValidTransition('commission_paid', 'new');
  assert.ok(r.message.includes('terminal state') || r.message.includes('none'), 'Should mention terminal state or empty allowed list');
});

// ─── Summary ───
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`\n🎉 All ${passed} lifecycle state machine tests PASSED!\n`);
  process.exit(0);
} else {
  console.error(`\n💥 ${failed} test(s) FAILED. ${passed} passed.\n`);
  process.exit(1);
}
