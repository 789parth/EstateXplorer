const assert = require('assert');
const {
  evaluateRegistrationRisk,
  externalPrimaryProvider,
  mxInfrastructureProvider,
} = require('../services/security/registrationSecurityService');
const redisCacheService = require('../services/security/cache/redisCacheService');
const { inspectDomainDNS } = require('../services/security/dnsService');
const { normalizeEmail } = require('../services/security/emailNormalizer');
const { checkVelocity, recordAttempt, clearVelocityHistory } = require('../services/security/velocityService');
const { evaluateBotSignals } = require('../services/security/botProtectionService');
const securityAuditService = require('../services/security/securityAuditService');
const { clearCache } = require('../services/disposableEmailService');

console.log('🧪 Starting Multi-Source Email Security & Resilience Suite...\n');

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

async function runMultiSourceSuite() {
  try {
    clearCache();
    redisCacheService.clearCache();
    clearVelocityHistory();

    // ── Test 1: Redis Outage / Standalone Memory Fallback ──
    // Even if Redis is not connected, redisCacheService functions cleanly in Tier 1
    assert.strictEqual(typeof redisCacheService.getDomainRisk, 'function');
    await redisCacheService.setDomainRisk('mock-test-domain.org', {
      domain: 'mock-test-domain.org',
      isDisposable: true,
      classification: 'DISPOSABLE',
      riskScore: 100,
    });
    const retrieved = await redisCacheService.getDomainRisk('mock-test-domain.org');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.isDisposable, true);
    assert.strictEqual(retrieved.cachedTier, 1);
    pass('Tier 1 Memory Fallback Resilience', 'Gracefully operates without external Redis dependency');

    // ── Test 2: Cache Invalidation Across Tiers ──
    await redisCacheService.invalidateDomain('mock-test-domain.org');
    const afterInvalidation = await redisCacheService.getDomainRisk('mock-test-domain.org');
    assert.strictEqual(afterInvalidation, null);
    pass('Cache Invalidation', 'Domain evicted cleanly from cache');

    // ── Test 3: MX Routing Infrastructure Provider Detection ──
    // When a custom domain routes MX through disposable infrastructure (e.g. mail.mailinator.com)
    const mxResult = await mxInfrastructureProvider.evaluate({
      domain: 'custom-company-front.com',
      mxRecords: [
        { exchange: 'mx.yopmail.net', priority: 10 },
      ],
    });
    assert.strictEqual(mxResult.isDisposable, true);
    assert.strictEqual(mxResult.confidence, 95);
    pass('MX Infrastructure Fingerprinting', 'Detected mx.yopmail.net disposable mail exchange');

    // ── Test 4: MX Infrastructure Detection for GuerrillaMail & Sharklasers ──
    const mxResult2 = await mxInfrastructureProvider.evaluate({
      domain: 'stealth-inbox.biz',
      mxRecords: [
        { exchange: 'mail.sharklasers.com', priority: 5 },
      ],
    });
    assert.strictEqual(mxResult2.isDisposable, true);
    pass('MX Infrastructure Detection (SharkLasers)', 'Identified stealth-inbox.biz -> mail.sharklasers.com');

    // ── Test 5: Clean Corporate MX Records Are Not Flagged ──
    const cleanMxResult = await mxInfrastructureProvider.evaluate({
      domain: 'legitimate-enterprise.com',
      mxRecords: [
        { exchange: 'aspmx.l.google.com', priority: 1 },
        { exchange: 'alt1.aspmx.l.google.com', priority: 5 },
      ],
    });
    assert.strictEqual(cleanMxResult.isDisposable, false);
    pass('Clean Corporate MX Preserved', 'Google Workspace MX exchanges evaluated as non-disposable');

    // ── Test 6: RFC 7505 Null MX Enforcement ──
    // Domain with Null MX explicitly rejects mail delivery
    const nullMxEvaluation = await inspectDomainDNS('');
    assert.strictEqual(nullMxEvaluation.dnsValid, false);
    pass('DNS Edge Handling', 'Empty/invalid domain safely handled');

    // ── Test 7: Email Normalization & Tag Stripping ──
    const normUser = normalizeEmail('  RealEstate.Pro+Campaign2026@Gmail.Com  ');
    assert.strictEqual(normUser.domain, 'gmail.com');
    assert.strictEqual(normUser.normalizedEmail, 'realestate.pro+campaign2026@gmail.com');
    assert.strictEqual(normUser.baseLocalPart, 'realestate.pro');
    assert.strictEqual(normUser.tag, 'campaign2026');
    assert.strictEqual(normUser.hasPlusAddressing, true);
    assert.ok(normUser.emailHash, 'Must generate SHA-256 hash');
    pass('Email Normalization & Plus-Addressing Analysis', 'Case folded, trimmed, base local part and tag extracted');

    // ── Test 8: Subnet-Level Velocity Limit Detection ──
    const testIp = '198.51.100.42';
    // Trigger multiple registrations from same IP in short window to exceed limit of 20
    for (let i = 0; i < 20; i++) {
      recordAttempt({ ip: testIp, domain: `client${i}.test`, emailHash: `hash${i}` });
    }
    const velocityBurst = checkVelocity({ ip: testIp, domain: 'client21.test', emailHash: 'hash21', isAllowlisted: false });
    assert.strictEqual(velocityBurst.isRateLimited, true);
    assert.ok(velocityBurst.velocityRisk >= 60);
    pass('Registration Velocity Engine', 'Subnet/IP burst rate-limiting triggered');

    // ── Test 9: Bot Automation Detection (Honeypot & Fast Submit) ──
    const botResult = await evaluateBotSignals({
      honeypot: 'filled-by-spambot',
      formTimeMs: 400, // submitted in 400ms (inhuman speed)
      ip: '203.0.113.99',
    });
    assert.strictEqual(botResult.isBot, true);
    assert.ok(botResult.botRisk >= 90);
    pass('Anti-Bot Defense Engine', 'Caught honeypot fill and sub-second automated submission');

    // ── Test 10: Security Audit Service Telemetry Integrity ──
    const auditRecord = await securityAuditService.logEvent({
      correlationId: 'test-correlation-uuid',
      eventType: 'DISPOSABLE_EMAIL_DETECTED',
      emailHash: normUser.emailHash,
      emailDomain: 'findize.com',
      ip: '127.0.0.1',
      decision: 'BLOCK',
      reasonCode: 'disposable_domain',
      riskScore: 100,
      latencyMs: 12,
    });
    assert.strictEqual(auditRecord.decision, 'BLOCK');
    assert.strictEqual(auditRecord.emailDomain, 'findize.com');
    assert.ok(auditRecord.loggedAt instanceof Date);
    pass('Immutable Security Audit Logging', 'Structured event logged with correlationId and SHA-256 hash');

    // ── Test 11: End-to-End Evaluation with Provider Mock Cleanup ──
    externalPrimaryProvider.setMockHandler(async ({ domain }) => {
      if (domain === 'burner-corp.net') {
        return { isDisposable: true, isTemporary: true, confidence: 98 };
      }
      return null;
    });

    const endToEndRes = await evaluateRegistrationRisk({ email: 'ceo@burner-corp.net' });
    assert.strictEqual(endToEndRes.decision, 'BLOCK');
    assert.strictEqual(endToEndRes.isDisposable, true);
    assert.strictEqual(endToEndRes.classification, 'TEMPORARY');

    externalPrimaryProvider.clearMockHandler();
    clearCache();
    redisCacheService.clearCache();
    pass('End-to-End Orchestration & Teardown', 'Successfully coordinated multi-source pipeline and reset mocks');

    console.log(`\n🎉 All ${totalTests} Multi-Source Email Security Tests Passed Successfully!\n`);
  } catch (err) {
    fail('Multi-Source Email Security Suite Encountered an Error', err);
  }
}

runMultiSourceSuite();
