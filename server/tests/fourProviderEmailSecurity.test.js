const assert = require('assert');
const {
  evaluateConsensus,
  executeParallelValidation,
  providers: {
    zeroBounceProvider,
    kickboxProvider,
    sendGridProvider,
    briteVerifyProvider,
  },
} = require('../services/security/consensusEngine');
const { evaluateRegistrationRisk } = require('../services/security/registrationSecurityService');
const { isDisposableEmail, clearCache } = require('../services/disposableEmailService');
const { sendRegistrationOTP } = require('../controllers/authController');

console.log('🧪 Starting 4-Provider Enterprise Email Existence & Disposable Prevention Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function pass(name, details = '') {
  totalTests++;
  passedTests++;
  console.log(`  ✅ [PASS] Test ${totalTests}: ${name}${details ? ` — ${details}` : ''}`);
}

function fail(name, error) {
  totalTests++;
  console.error(`  ❌ [FAIL] Test ${totalTests}: ${name}`);
  console.error(error);
  process.exit(1);
}

// Helper to simulate Express request/response/next
function mockHttp({ body = {}, params = {}, ip = '127.0.0.1', headers = {} } = {}) {
  let resStatus = null;
  let resJson = null;
  let nextError = null;

  const req = {
    body,
    params,
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

async function runFourProviderTestSuite() {
  try {
    clearCache();

    // ── Test 1: ZeroBounce Provider Normalization & Mock Execution ──
    zeroBounceProvider.setMockHandler(async () => ({
      mailboxStatus: 'LIKELY_EXISTS',
      isDisposable: false,
      isCatchAll: false,
      confidence: 96,
      rawStatus: 'valid',
    }));

    const zbResult = await zeroBounceProvider.evaluate({
      email: 'corp.executive@company.com',
      domain: 'company.com',
      normalizedEmail: 'corp.executive@company.com',
    });
    assert.strictEqual(zbResult.provider, 'zerobounce');
    assert.strictEqual(zbResult.mailboxStatus, 'LIKELY_EXISTS');
    assert.strictEqual(zbResult.isDisposable, false);
    pass('ZeroBounce Provider Evaluation', 'Successfully evaluates deliverable mailbox');

    // ── Test 2: Kickbox Provider Normalization & Mock Execution ──
    kickboxProvider.setMockHandler(async () => ({
      mailboxStatus: 'LIKELY_EXISTS',
      isDisposable: false,
      isCatchAll: false,
      confidence: 94,
      rawStatus: 'deliverable',
    }));

    const kbResult = await kickboxProvider.evaluate({
      email: 'corp.executive@company.com',
      domain: 'company.com',
      normalizedEmail: 'corp.executive@company.com',
    });
    assert.strictEqual(kbResult.provider, 'kickbox');
    assert.strictEqual(kbResult.mailboxStatus, 'LIKELY_EXISTS');
    pass('Kickbox Provider Evaluation', 'Normalized deliverable mailbox signals');

    // ── Test 3: Twilio SendGrid Provider Normalization & Mock Execution ──
    sendGridProvider.setMockHandler(async () => ({
      mailboxStatus: 'LIKELY_EXISTS',
      isDisposable: false,
      confidence: 92,
      rawStatus: 'valid',
    }));

    const sgResult = await sendGridProvider.evaluate({
      email: 'corp.executive@company.com',
      domain: 'company.com',
      normalizedEmail: 'corp.executive@company.com',
    });
    assert.strictEqual(sgResult.provider, 'sendgrid');
    assert.strictEqual(sgResult.mailboxStatus, 'LIKELY_EXISTS');
    pass('SendGrid Provider Evaluation', 'Normalized SendGrid verdict: valid');

    // ── Test 4: Validity BriteVerify Provider Normalization & Mock Execution ──
    briteVerifyProvider.setMockHandler(async () => ({
      mailboxStatus: 'LIKELY_EXISTS',
      isDisposable: false,
      confidence: 95,
      rawStatus: 'valid',
    }));

    const bvResult = await briteVerifyProvider.evaluate({
      email: 'corp.executive@company.com',
      domain: 'company.com',
      normalizedEmail: 'corp.executive@company.com',
    });
    assert.strictEqual(bvResult.provider, 'briteverify');
    assert.strictEqual(bvResult.mailboxStatus, 'LIKELY_EXISTS');
    pass('BriteVerify Provider Evaluation', 'Normalized BriteVerify status: valid');

    // ── Test 5: Strict Consensus: 4 Valid Providers -> ALLOW_TO_VERIFICATION ──
    const consensus5 = evaluateConsensus({
      providerResults: [zbResult, kbResult, sgResult, bvResult],
      localSignals: { syntaxValid: true, domainValid: true, mxValid: true, isNullMx: false, isLocalDisposable: false },
    });
    assert.strictEqual(consensus5.decision, 'ALLOW_WITH_VERIFICATION');
    assert.strictEqual(consensus5.mailboxLikelyExists, true);
    assert.strictEqual(consensus5.rejectionCategory, null);
    pass('Strong 4-Provider Consensus', 'All 4 providers agreeing valid permits progression to email OTP verification');

    // ── Test 6: ZeroBounce Disposable Flag Triggers Immediate BLOCK ──
    const disposableZB = {
      provider: 'zerobounce',
      mailboxStatus: 'UNKNOWN',
      isDisposable: true,
      rawStatus: 'disposable',
    };
    const consensus6 = evaluateConsensus({
      providerResults: [disposableZB, kbResult, sgResult, bvResult],
      localSignals: { syntaxValid: true, domainValid: true, mxValid: true },
    });
    assert.strictEqual(consensus6.decision, 'BLOCK');
    assert.strictEqual(consensus6.rejectionCategory, 'DISPOSABLE');
    assert.ok(consensus6.formattedErrorMessage.includes('Temporary or disposable email addresses are not permitted'));
    pass('ZeroBounce Disposable Immediate Block', 'Any provider flagging disposable triggers immediate block');

    // ── Test 7: Kickbox Undeliverable / Mailbox Not Found Triggers BLOCK with Proper Error ──
    const notFoundKB = {
      provider: 'kickbox',
      mailboxStatus: 'NOT_FOUND',
      isDisposable: false,
      rawStatus: 'undeliverable',
    };
    const consensus7 = evaluateConsensus({
      providerResults: [zbResult, notFoundKB, sgResult, bvResult],
      localSignals: { syntaxValid: true, domainValid: true, mxValid: true },
    });
    assert.strictEqual(consensus7.decision, 'BLOCK');
    assert.strictEqual(consensus7.rejectionCategory, 'MAILBOX_NOT_FOUND');
    assert.ok(
      consensus7.formattedErrorMessage.includes('This email address does not exist or cannot receive emails'),
      `Expected does not exist message, got: ${consensus7.formattedErrorMessage}`
    );
    pass('Mailbox Existence Enforcement', 'Provider detecting mailbox not found returns "This email address does not exist"');

    // ── Test 8: Spam Trap / Toxic Signal Triggers Immediate BLOCK ──
    const toxicBV = {
      provider: 'briteverify',
      mailboxStatus: 'INVALID',
      isDisposable: false,
      isToxic: true,
      rawStatus: 'toxic',
    };
    const consensus8 = evaluateConsensus({
      providerResults: [zbResult, kbResult, sgResult, toxicBV],
      localSignals: { syntaxValid: true, domainValid: true, mxValid: true },
    });
    assert.strictEqual(consensus8.decision, 'BLOCK');
    assert.strictEqual(consensus8.rejectionCategory, 'SPAM_TRAP_TOXIC');
    pass('Toxic & Spam Trap Immediate Block', 'Toxic / Spam Trap signals strictly blocked');

    // ── Test 9: Multiple Invalid Providers Trigger BLOCK ──
    const invalidSG = { provider: 'sendgrid', mailboxStatus: 'INVALID', rawStatus: 'invalid' };
    const invalidBV = { provider: 'briteverify', mailboxStatus: 'INVALID', rawStatus: 'invalid' };
    const consensus9 = evaluateConsensus({
      providerResults: [zbResult, kbResult, invalidSG, invalidBV],
      localSignals: { syntaxValid: true, domainValid: true, mxValid: true },
    });
    assert.strictEqual(consensus9.decision, 'BLOCK');
    assert.strictEqual(consensus9.rejectionCategory, 'MAILBOX_NOT_FOUND');
    pass('Multiple Invalid Provider Consensus', 'Two or more invalid responses trigger hard block');

    // ── Test 10: Catch-All Domain Requires Ownership Verification ──
    const catchAllZB = { provider: 'zerobounce', mailboxStatus: 'LIKELY_EXISTS', isCatchAll: true, rawStatus: 'catch-all' };
    const consensus10 = evaluateConsensus({
      providerResults: [catchAllZB, kbResult, sgResult, bvResult],
      localSignals: { syntaxValid: true, domainValid: true, mxValid: true },
    });
    assert.strictEqual(consensus10.decision, 'VERIFY');
    assert.strictEqual(consensus10.catchAll, true);
    pass('Catch-All Domain Verification Policy', 'Catch-all domain requires email ownership verification');

    // ── Test 11: Parallel Timeout Resilience ──
    // Simulate a slow provider taking 10,000ms; parallel executor must return within timeoutMs without hanging
    zeroBounceProvider.setMockHandler(async () => {
      await new Promise((r) => setTimeout(r, 8000));
      return { mailboxStatus: 'LIKELY_EXISTS' };
    });
    const start11 = Date.now();
    const parallel11 = await executeParallelValidation(
      { email: 'fast.test@gmail.com', domain: 'gmail.com', normalizedEmail: 'fast.test@gmail.com' },
      500 // 500ms timeout
    );
    const duration11 = Date.now() - start11;
    assert.ok(duration11 < 1500, `Parallel validation must finish promptly, took ${duration11}ms`);
    const zbSlow = parallel11.find((p) => p.provider === 'zerobounce');
    assert.strictEqual(zbSlow.rawStatus, 'parallel_timeout');
    pass('Parallel Timeout Isolation', `Slow provider safely timed out in ${duration11}ms`);

    // ── Test 12: Sign-Up Endpoint Blocks Non-Existent Email (No OTP Created) ──
    clearCache();
    // Configure mock to indicate non-existent mailbox
    kickboxProvider.setMockHandler(async () => ({
      mailboxStatus: 'NOT_FOUND',
      isDisposable: false,
      confidence: 95,
      rawStatus: 'undeliverable',
    }));
    zeroBounceProvider.setMockHandler(null);
    sendGridProvider.setMockHandler(null);
    briteVerifyProvider.setMockHandler(null);

    const ctx12 = mockHttp({
      body: {
        name: 'Prospective Buyer',
        email: 'definitely.does.not.exist.9873429@microsoft.com',
        phone: '+91 9876543210',
        password: 'SecurePassword123!',
      },
    });

    await sendRegistrationOTP(ctx12.req, ctx12.res, ctx12.next);
    const res12 = ctx12.getResult();
    assert.ok(res12.error, 'Sign-up must fail when email does not exist');
    assert.strictEqual(res12.error.statusCode, 400);
    assert.ok(
      res12.error.message.includes('This email address does not exist or cannot receive emails'),
      `Expected non-existent email message, got: ${res12.error.message}`
    );
    pass('Sign-Up Rejection on Non-Existent Email', 'Halted execution and returned proper error for non-existent mailbox');

    // ── Test 13: Sign-Up Endpoint Blocks Disposable Mail (No OTP Created) ──
    clearCache();
    // Configure mock to flag disposable
    zeroBounceProvider.setMockHandler(async () => ({
      mailboxStatus: 'UNKNOWN',
      isDisposable: true,
      confidence: 99,
      rawStatus: 'disposable',
    }));
    kickboxProvider.setMockHandler(null);

    const ctx13 = mockHttp({
      body: {
        name: 'Attacker Temp User',
        email: 'stealthinbox@yopmail.com',
        phone: '+91 9876543210',
        password: 'SecurePassword123!',
      },
    });

    await sendRegistrationOTP(ctx13.req, ctx13.res, ctx13.next);
    const res13 = ctx13.getResult();
    assert.ok(res13.error, 'Sign-up must fail when disposable mail is submitted');
    assert.strictEqual(res13.error.statusCode, 403);
    assert.ok(
      res13.error.message.includes('Temporary or disposable email addresses are not permitted'),
      `Expected disposable error message, got: ${res13.error.message}`
    );
    pass('Sign-Up Rejection on Temporary/Disposable Mail', 'Halted execution and returned proper error for disposable email');

    // ── Test 14: Sign-Up Endpoint Blocks Domains With No Valid Mail Servers ──
    clearCache();
    zeroBounceProvider.setMockHandler(null);
    kickboxProvider.setMockHandler(null);
    sendGridProvider.setMockHandler(async () => ({
      mailboxStatus: 'INVALID',
      isDisposable: false,
      confidence: 98,
      rawStatus: 'no_dns_entries',
      reason: 'no_dns_entries',
    }));

    const ctx14 = mockHttp({
      body: {
        name: 'Invalid Domain User',
        email: 'user@nonexistent-fake-domain-999888.org',
        phone: '+91 9876543210',
        password: 'SecurePassword123!',
      },
    });

    await sendRegistrationOTP(ctx14.req, ctx14.res, ctx14.next);
    const res14 = ctx14.getResult();
    assert.ok(res14.error, 'Sign-up must fail when domain has no mail servers');
    assert.strictEqual(res14.error.statusCode, 400);
    assert.ok(
      res14.error.message.includes('The email domain does not have valid mail servers') ||
      res14.error.message.includes('Please provide a valid email address'),
      `Expected invalid mail servers message, got: ${res14.error.message}`
    );
    pass('Sign-Up Rejection on Invalid Mail Server / Domain', 'Halted execution and rejected domain without valid mail routing');

    // Clean up all mock handlers
    zeroBounceProvider.clearMockHandler();
    kickboxProvider.clearMockHandler();
    sendGridProvider.clearMockHandler();
    briteVerifyProvider.clearMockHandler();
    clearCache();

    console.log(`\n🎉 All ${totalTests} 4-Provider Enterprise Email Existence & Disposable Tests Passed Successfully!\n`);
  } catch (err) {
    fail('Test suite execution error', err);
  }
}

runFourProviderTestSuite();
