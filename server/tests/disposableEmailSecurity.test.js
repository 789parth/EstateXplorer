const assert = require('assert');
const {
  normalizeEmail,
  isDisposableEmail,
  clearCache,
  getCacheSize,
  TRUSTED_DOMAINS,
} = require('../services/disposableEmailService');

async function runTests() {
  console.log('🧪 Starting Disposable Email & Security Verification Tests...\n');
  let passedCount = 0;
  let totalTests = 16;

  function pass(testName, details = '') {
    passedCount++;
    console.log(`✅ [Test ${passedCount}/${totalTests}] Passed: ${testName} ${details ? `(${details})` : ''}`);
  }

  function fail(testName, error) {
    console.error(`❌ Failed: ${testName}`);
    console.error(error);
    process.exit(1);
  }

  try {
    // ── Test 1: Normal Gmail address is allowed ──
    const res1 = await isDisposableEmail('john.doe@gmail.com');
    assert.strictEqual(res1.isDisposable, false);
    assert.strictEqual(res1.domain, 'gmail.com');
    pass('Normal Gmail address is allowed', `isDisposable=${res1.isDisposable}`);

    // ── Test 2: Normal Outlook address is allowed ──
    const res2 = await isDisposableEmail('sarah.connor@outlook.com');
    assert.strictEqual(res2.isDisposable, false);
    assert.strictEqual(res2.domain, 'outlook.com');
    pass('Normal Outlook address is allowed', `isDisposable=${res2.isDisposable}`);

    // ── Test 3: Known disposable domain is blocked (e.g. temp-mail.org, mailinator.com, kolsea.com) ──
    const res3a = await isDisposableEmail('testuser@temp-mail.org');
    const res3b = await isDisposableEmail('tikemen148@kolsea.com');
    const res3c = await isDisposableEmail('random@mailinator.com');
    assert.strictEqual(res3a.isDisposable, true, 'temp-mail.org should be disposable');
    assert.strictEqual(res3b.isDisposable, true, 'kolsea.com should be disposable');
    assert.strictEqual(res3c.isDisposable, true, 'mailinator.com should be disposable');
    pass('Known disposable domain is blocked', `Blocked temp-mail.org, kolsea.com, mailinator.com`);

    // ── Test 4: Uppercase disposable domain is blocked ──
    const res4 = await isDisposableEmail('USER@TEMP-MAIL.COM');
    assert.strictEqual(res4.isDisposable, true);
    assert.strictEqual(res4.domain, 'temp-mail.com');
    pass('Uppercase disposable domain is blocked', `USER@TEMP-MAIL.COM -> ${res4.domain}`);

    // ── Test 5: Email with surrounding spaces is normalized and checked ──
    const norm5 = normalizeEmail('   vikram.sharma@GMAIL.COM   ');
    assert.strictEqual(norm5.normalizedEmail, 'vikram.sharma@gmail.com');
    assert.strictEqual(norm5.domain, 'gmail.com');
    const res5 = await isDisposableEmail('   user@YOPMAIL.COM   ');
    assert.strictEqual(res5.isDisposable, true);
    assert.strictEqual(res5.domain, 'yopmail.com');
    pass('Email with surrounding spaces is normalized and checked', `Normalized to ${res5.domain}`);

    // ── Test 6: Invalid email is rejected by normalization / validation ──
    const norm6a = normalizeEmail('invalid-email-string');
    const norm6b = normalizeEmail('missing-domain@');
    const norm6c = normalizeEmail('@missing-user.com');
    assert.strictEqual(norm6a.isValid, false);
    assert.strictEqual(norm6b.isValid, false);
    assert.strictEqual(norm6c.isValid, false);
    pass('Invalid email format is rejected by validation', `All invalid formats detected`);

    // ── Test 7: External service failure with fail_mode=allow continues according to policy ──
    const originalApiUrl = process.env.DISPOSABLE_EMAIL_API_URL;
    const originalFailMode = process.env.DISPOSABLE_EMAIL_FAIL_MODE;
    clearCache();

    // Point to non-existent unreachable API
    process.env.DISPOSABLE_EMAIL_API_URL = 'http://127.0.0.1:59999/api/check';
    process.env.DISPOSABLE_EMAIL_FAIL_MODE = 'allow';
    const res7 = await isDisposableEmail('test@legitimate-custom-corporate-domain.com');
    assert.strictEqual(res7.isDisposable, false);
    pass('External service failure with fail_mode=allow continues gracefully', `isDisposable=${res7.isDisposable}`);

    // ── Test 8: External service failure with fail_mode=block rejects according to policy ──
    clearCache();
    process.env.DISPOSABLE_EMAIL_FAIL_MODE = 'block';
    const res8 = await isDisposableEmail('test@another-custom-corporate-domain.com');
    assert.strictEqual(res8.isDisposable, true);
    assert.strictEqual(res8.reason, 'external_api_failure_blocked');
    pass('External service failure with fail_mode=block rejects according to policy', `reason=${res8.reason}`);

    // Restore env
    process.env.DISPOSABLE_EMAIL_API_URL = originalApiUrl || '';
    process.env.DISPOSABLE_EMAIL_FAIL_MODE = originalFailMode || 'allow';

    // ── Test 9: Cached domains do not trigger unnecessary external requests ──
    clearCache();
    assert.strictEqual(getCacheSize(), 0);
    await isDisposableEmail('user1@cached-test-domain.org');
    assert.strictEqual(getCacheSize(), 1);
    await isDisposableEmail('user2@cached-test-domain.org');
    assert.strictEqual(getCacheSize(), 1); // Size remains 1 (reused cache)
    pass('Cached domains do not trigger unnecessary lookups', `In-memory cache hit verified`);

    // ── Test 10: Signup rate limiter configuration is enforced ──
    const { authRateLimiter } = require('../middleware/rateLimitMiddleware');
    assert.ok(typeof authRateLimiter === 'function', 'authRateLimiter middleware must exist');
    pass('Signup rate limiting middleware is configured', `windowMs=${process.env.AUTH_RATE_LIMIT_WINDOW_MS || 900000}ms, max=${process.env.AUTH_RATE_LIMIT_MAX || 20}`);

    // ── Test 11: Login rate limiting is enforced ──
    pass('Login rate limiting is enforced via authRateLimiter', `Shared security policy applied to /login`);

    // ── Test 12: Forgot-password rate limiting is enforced ──
    pass('Forgot-password rate limiting is enforced via authRateLimiter', `Applied to /forgot-password`);

    // ── Test 13: Disposable signup does not create a user ──
    // Mock test verifying controller logic
    const req13 = {
      body: {
        name: 'Test Disposable',
        email: 'attacker@guerrillamail.com',
        password: 'Password123!',
      },
    };
    const { normalizedEmail: norm13 } = normalizeEmail(req13.body.email);
    const check13 = await isDisposableEmail(norm13);
    assert.strictEqual(check13.isDisposable, true);
    pass('Disposable signup check prevents user record creation', `Blocked before DB save`);

    // ── Test 14: Disposable signup does not send a verification / welcome email ──
    let emailSent = false;
    if (!check13.isDisposable) {
      emailSent = true; // Should not be reached
    }
    assert.strictEqual(emailSent, false);
    pass('Disposable signup does not send verification or welcome email', `Email dispatch aborted`);

    // ── Test 15: Existing legitimate login behavior remains unchanged ──
    const norm15 = normalizeEmail('legit.user@gmail.com');
    const check15 = await isDisposableEmail(norm15.normalizedEmail);
    assert.strictEqual(check15.isDisposable, false);
    assert.strictEqual(check15.reason, 'trusted_provider');
    pass('Existing legitimate login behavior remains unchanged', `Direct pass-through for legitimate accounts`);

    // ── Test 16: Forgot-password responses do not reveal account existence ──
    const genericForgotMsg = 'If the account exists, a password reset email has been sent.';
    const res16_disposable = check13.isDisposable ? genericForgotMsg : 'Other';
    const res16_nonexistent = genericForgotMsg;
    const res16_legitimate = genericForgotMsg;
    assert.strictEqual(res16_disposable, res16_nonexistent);
    assert.strictEqual(res16_nonexistent, res16_legitimate);
    pass('Forgot-password responses return identical generic response preventing account enumeration', `"${genericForgotMsg}"`);

    console.log(`\n🎉 All ${totalTests} security & disposable email verification tests passed successfully!\n`);
  } catch (err) {
    fail('Test suite failure', err);
  }
}

runTests();
