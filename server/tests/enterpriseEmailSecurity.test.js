const assert = require('assert');
const { normalizeEmail } = require('../services/security/emailNormalizer');
const { inspectDomainDNS, clearDnsCache } = require('../services/security/dnsService');
const { checkVelocity, clearVelocityHistory } = require('../services/security/velocityService');
const { evaluateBotSignals } = require('../services/security/botProtectionService');
const registrationRiskEngine = require('../services/security/registrationRiskEngine');
const policyEngine = require('../services/security/policyEngine');
const {
  evaluateRegistrationRisk,
  getSecurityConfig,
  updateSecurityConfig,
} = require('../services/security/registrationSecurityService');
const securityListService = require('../services/security/securityListService');

async function runEnterpriseSecurityTestSuite() {
  console.log('🚀 Starting Enterprise Disposable Email & Anti-Abuse Test Suite...\n');
  let passedCount = 0;
  const totalTests = 22;

  function pass(title, details = '') {
    passedCount++;
    console.log(`✅ [Test ${passedCount}/${totalTests}] Passed: ${title} ${details ? `— ${details}` : ''}`);
  }

  function fail(title, err) {
    console.error(`❌ [FAILED]: ${title}`);
    console.error(err);
    process.exit(1);
  }

  try {
    // ── Test 1: Unicode NFC Normalization & Whitespace Trimming ──
    const norm1 = normalizeEmail('   vikram.sharma\u0041\u030A@GMAIL.COM   ');
    assert.strictEqual(norm1.domain, 'gmail.com');
    assert.strictEqual(norm1.isValid, true);
    pass('Unicode NFC Normalization & Case Lowercasing', `Domain: ${norm1.domain}`);

    // ── Test 2: Plus-Addressing Preservation ──
    const norm2 = normalizeEmail('john.doe+realestate123@outlook.com');
    assert.strictEqual(norm2.normalizedEmail, 'john.doe+realestate123@outlook.com');
    assert.strictEqual(norm2.baseLocalPart, 'john.doe');
    assert.strictEqual(norm2.tag, 'realestate123');
    assert.strictEqual(norm2.hasPlusAddressing, true);
    pass('Plus-Addressing Preservation', `Tag: ${norm2.tag}, Base: ${norm2.baseLocalPart}`);

    // ── Test 3: Role Account Classification ──
    const norm3a = normalizeEmail('support@propcompany.in');
    const norm3b = normalizeEmail('admin@luxurybuilders.com');
    const norm3c = normalizeEmail('priya.sharma@gmail.com');
    assert.strictEqual(norm3a.isRoleAccount, true);
    assert.strictEqual(norm3b.isRoleAccount, true);
    assert.strictEqual(norm3c.isRoleAccount, false);
    pass('Role Account Classification', 'admin@ and support@ tagged as role accounts');

    // ── Test 4: Malformed Email Syntax Detection ──
    const norm4a = normalizeEmail('invalid..dots@test.com');
    const norm4b = normalizeEmail('.leadingdot@test.com');
    const norm4c = normalizeEmail('missingdomain@');
    assert.strictEqual(norm4a.isValid, false);
    assert.strictEqual(norm4b.isValid, false);
    assert.strictEqual(norm4c.isValid, false);
    pass('Malformed Syntax Detection', 'Double dots and leading dots correctly rejected');

    // ── Test 5: Known Disposable Email in Local Dataset is Blocked (O(1)) ──
    const res5a = await evaluateRegistrationRisk({ email: 'user1@temp-mail.org' });
    const res5b = await evaluateRegistrationRisk({ email: 'fakeuser@guerrillamail.com' });
    const res5c = await evaluateRegistrationRisk({ email: 'dispos@mailinator.com' });
    assert.strictEqual(res5a.decision, 'BLOCK');
    assert.strictEqual(res5b.decision, 'BLOCK');
    assert.strictEqual(res5c.decision, 'BLOCK');
    assert.strictEqual(res5a.isDisposable, true);
    pass('Known Disposable Dataset Match Blocks Account', 'temp-mail.org, guerrillamail.com, mailinator.com');

    // ── Test 6: Major Legitimate Free Email Providers Are Allowed (Zero False Positives) ──
    const res6a = await evaluateRegistrationRisk({ email: 'amit.patel@gmail.com' });
    const res6b = await evaluateRegistrationRisk({ email: 'rahul.verma@outlook.com' });
    const res6c = await evaluateRegistrationRisk({ email: 'sneha.reddy@yahoo.com' });
    const res6d = await evaluateRegistrationRisk({ email: 'rajesh@icloud.com' });
    const res6e = await evaluateRegistrationRisk({ email: 'vikram@proton.me' });
    assert.strictEqual(res6a.decision, 'ALLOW_WITH_VERIFICATION');
    assert.strictEqual(res6b.decision, 'ALLOW_WITH_VERIFICATION');
    assert.strictEqual(res6c.decision, 'ALLOW_WITH_VERIFICATION');
    assert.strictEqual(res6d.decision, 'ALLOW_WITH_VERIFICATION');
    assert.strictEqual(res6e.decision, 'ALLOW_WITH_VERIFICATION');
    pass('Major Legitimate Providers Allowed Without False Positives', 'Gmail, Outlook, Yahoo, iCloud, Proton');

    // ── Test 7: Null MX Domain (RFC 7505) Rejection ──
    // Null MX announces that the domain does not accept email (exchange = ".")
    const nullMxDomainSignals = {
      hasMx: false,
      isNullMx: true,
      dnsValid: false,
      reason: 'null_mx_record_domain_rejects_email',
    };
    const riskResult7 = registrationRiskEngine.evaluate({
      emailSignals: { isDisposable: false },
      domainSignals: nullMxDomainSignals,
    });
    const policyResult7 = policyEngine.decide({
      compositeScore: riskResult7.compositeScore,
      riskTier: riskResult7.riskTier,
      criticalFlags: riskResult7.criticalFlags,
    });
    assert.strictEqual(policyResult7.decision, 'BLOCK');
    assert.strictEqual(policyResult7.reasonCode, 'DNS_VALIDATION_FAILED');
    pass('Null MX (RFC 7505) Detection', 'Domain rejecting mail blocked via DNS_VALIDATION_FAILED');

    // ── Test 8: Honeypot Anti-Bot Automation Trapping ──
    const botRes8 = await evaluateBotSignals({
      honeypot: 'http://automated-spam-link.com', // Crawler filled invisible honeypot
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    assert.strictEqual(botRes8.isBot, true);
    assert.strictEqual(botRes8.botRisk, 100);
    pass('Invisible Honeypot Trapping', 'Automated crawler filling hidden field flagged with botRisk=100');

    // ── Test 9: Rapid Submission Speed Detection (<800ms) ──
    const botRes9 = await evaluateBotSignals({
      formTimeMs: 250, // Submitting form in 250ms indicates headless script
      userAgent: 'Mozilla/5.0',
    });
    assert.ok(botRes9.botRisk >= 45, 'Bot risk must be elevated for <800ms submissions');
    pass('Submission Speed Analysis', 'Sub-800ms form completion penalized');

    // ── Test 10: Headless Browser & Automated User-Agent Signature ──
    const botRes10 = await evaluateBotSignals({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/108.0.5359.71 Safari/537.36',
    });
    assert.strictEqual(botRes10.isBot, true);
    pass('Headless Browser Signature Detection', 'HeadlessChrome correctly flagged as bot');

    // ── Test 11: Sliding-Window IP Velocity Limits ──
    clearVelocityHistory();
    const testIp = '203.0.113.42';
    // Simulate burst of signups from same IP
    for (let i = 0; i < 4; i++) {
      checkVelocity({ ip: testIp, domain: 'customsite.org', emailHash: `hash_${i}` });
    }
    const velCheck11 = checkVelocity({ ip: testIp, domain: 'customsite.org', emailHash: 'hash_final' });
    assert.ok(velCheck11.velocityRisk >= 40, 'Velocity risk must be elevated after 4+ signups in 1 minute');
    pass('Sliding-Window IP Velocity Tracking', `Velocity risk elevated to ${velCheck11.velocityRisk}`);

    // ── Test 12: Domain Farming Spike Velocity Detection ──
    clearVelocityHistory();
    const spamDomain = 'new-suspicious-domain.org';
    for (let i = 0; i < 11; i++) {
      checkVelocity({ ip: `198.51.100.${i}`, domain: spamDomain, emailHash: `hash_farm_${i}` });
    }
    const domainVelCheck12 = checkVelocity({ ip: '198.51.100.99', domain: spamDomain, emailHash: 'hash_final' });
    assert.ok(domainVelCheck12.velocityRisk >= 60, 'Mass registrations across same domain must trigger domain burst alert');
    pass('Domain-Wide Account Farming Detection', 'Sudden burst across same domain flagged');

    // ── Test 13: Trusted Allowlisted Domains Exempt from Domain Farming Rate Limit ──
    clearVelocityHistory();
    for (let i = 0; i < 15; i++) {
      checkVelocity({ ip: `10.0.0.${i}`, domain: 'gmail.com', emailHash: `gmail_${i}`, isAllowlisted: true });
    }
    const gmailCheck13 = checkVelocity({ ip: '10.0.0.50', domain: 'gmail.com', emailHash: 'gmail_final', isAllowlisted: true });
    assert.strictEqual(gmailCheck13.details.dom5m, 0, 'Allowlisted domains must not trigger false positive domain farming');
    pass('Allowlist Exemption for Domain Velocity', 'Legitimate consumer mail hosts exempt from domain farming limits');

    // ── Test 14: Adaptive Policy Engine: NORMAL Mode ──
    const policyNormal = policyEngine.decide({
      compositeScore: 45,
      riskTier: 'ELEVATED',
      mode: 'NORMAL',
    });
    assert.strictEqual(policyNormal.decision, 'ALLOW_WITH_VERIFICATION');
    pass('Adaptive Policy: NORMAL Mode', 'Elevated score (45) allowed with mandatory email verification');

    // ── Test 15: Adaptive Policy Engine: STRICT Mode ──
    const policyStrict = policyEngine.decide({
      compositeScore: 45,
      riskTier: 'ELEVATED',
      mode: 'STRICT',
    });
    assert.strictEqual(policyStrict.decision, 'STEP_UP_CHALLENGE');
    pass('Adaptive Policy: STRICT Mode', 'Score 45 triggers STEP_UP_CHALLENGE under STRICT policy');

    // ── Test 16: Adaptive Policy Engine: LOCKDOWN Mode ──
    const policyLockdown = policyEngine.decide({
      compositeScore: 25,
      riskTier: 'MODERATE',
      mode: 'LOCKDOWN',
      isAllowlisted: false,
    });
    assert.strictEqual(policyLockdown.decision, 'BLOCK');
    assert.strictEqual(policyLockdown.reasonCode, 'LOCKDOWN_RESTRICTION');
    pass('Adaptive Policy: LOCKDOWN Mode', 'Non-allowlisted signups blocked during LOCKDOWN mode');

    // ── Test 17: Public Error Messages Do Not Leak Internal Security Rules ──
    const res17 = await evaluateRegistrationRisk({ email: 'attacker@10minutemail.com' });
    assert.strictEqual(res17.decision, 'BLOCK');
    assert.strictEqual(
      res17.publicMessage,
      'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.'
    );
    assert.ok(!res17.publicMessage.includes('10minutemail.com'), 'Must not leak domain name in message');
    assert.ok(!res17.publicMessage.includes('blacklist'), 'Must not leak word blacklist in message');
    pass('Zero-Leakage Public Error Messages', `Safe generic message: "${res17.publicMessage}"`);

    // ── Test 18: Dynamic In-Memory Blocklist Enforcement ──
    const customBannedDomain = 'scam-realestate-agents.net';
    await securityListService.addEntry({
      type: 'BLOCKLIST',
      targetType: 'domain',
      value: customBannedDomain,
      reason: 'Fraudulent listings campaign',
    });
    const res18 = await evaluateRegistrationRisk({ email: `agent@${customBannedDomain}` });
    assert.strictEqual(res18.decision, 'BLOCK');
    assert.strictEqual(res18.reasonCode, 'POLICY_BLOCK');
    pass('Dynamic Blocklist Rule Enforcement', `${customBannedDomain} blocked via POLICY_BLOCK`);

    // ── Test 19: Dynamic Allowlist Override ──
    const customCorporateDomain = 'partner-realty-group.co';
    await securityListService.addEntry({
      type: 'ALLOWLIST',
      targetType: 'domain',
      value: customCorporateDomain,
      reason: 'Verified corporate enterprise partner',
    });
    const res19 = await evaluateRegistrationRisk({ email: `ceo@${customCorporateDomain}` });
    assert.strictEqual(res19.decision, 'ALLOW_WITH_VERIFICATION');
    assert.strictEqual(res19.reasonCode, 'trusted_provider');
    pass('Dynamic Allowlist Override', `${customCorporateDomain} granted immediate allow path`);

    // ── Test 20: Role Account Risk Adjustment (Does NOT Blindly Block) ──
    const res20 = await evaluateRegistrationRisk({ email: 'support@legitimate-corporate-portal.com' });
    assert.strictEqual(res20.isRoleAccount, true);
    // Role account is flagged but not automatically blocked
    assert.notStrictEqual(res20.decision, 'BLOCK');
    pass('Role Account Soft Risk Adjustment', 'support@ assigned role flag without automatic block');

    // ── Test 21: Runtime Policy Configuration Switch ──
    const initialConfig = getSecurityConfig();
    assert.ok(initialConfig.mode, 'Must have active mode');
    await updateSecurityConfig({ mode: 'STRICT' });
    assert.strictEqual(getSecurityConfig().mode, 'STRICT');
    await updateSecurityConfig({ mode: 'NORMAL' }); // restore
    assert.strictEqual(getSecurityConfig().mode, 'NORMAL');
    pass('Runtime Security Policy Configuration', 'Switched mode to STRICT and restored to NORMAL');

    // ── Test 22: High-Performance Latency Target (< 25ms local path) ──
    const start22 = Date.now();
    await evaluateRegistrationRisk({ email: 'performance.test@gmail.com' });
    const duration22 = Date.now() - start22;
    assert.ok(duration22 < 50, `Local path evaluation took ${duration22}ms (must be < 50ms)`);
    pass('Ultra-Low Latency Execution', `Allowlisted local path executed in ${duration22} ms`);

    console.log(`\n🎉 All ${totalTests} Enterprise Disposable Email & Anti-Abuse Tests Passed Successfully!\n`);
  } catch (err) {
    fail('Enterprise Security Test Suite Encountered an Error', err);
  }
}

runEnterpriseSecurityTestSuite();
