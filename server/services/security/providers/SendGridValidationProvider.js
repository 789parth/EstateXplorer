const BaseValidationProvider = require('./BaseValidationProvider');

/**
 * Twilio SendGrid Real-Time Email Validation Engine
 * Provides deliverability signals, Valid / Risky / Invalid classification,
 * DNS/MX verification, and bounce/disposable checks.
 */
class SendGridValidationProvider extends BaseValidationProvider {
  constructor() {
    super('sendgrid', 3500);
    this.apiKey = process.env.SENDGRID_API_KEY || process.env.TWILIO_SENDGRID_API_KEY || '';
    this.apiUrl = process.env.SENDGRID_VALIDATION_API_URL || 'https://api.sendgrid.com/v3/validations/email';
  }

  async evaluate({ email, domain, normalizedEmail }) {
    const startTime = Date.now();

    // 1. Mock handler for tests
    if (typeof this.mockHandler === 'function') {
      const mock = await this.mockHandler({ email, domain, normalizedEmail });
      if (mock) {
        return this.createNormalizedResult({
          ...mock,
          durationMs: Date.now() - startTime,
        });
      }
    }

    // 2. Circuit breaker
    if (this.isCircuitOpen()) {
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'circuit_open',
        reason: 'Circuit breaker is open for SendGrid',
        durationMs: Date.now() - startTime,
      });
    }

    // 3. Fallback if API key is unconfigured
    const key = process.env.SENDGRID_API_KEY || process.env.TWILIO_SENDGRID_API_KEY || this.apiKey;
    if (!key) {
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'no_api_key',
        reason: 'SendGrid API key unconfigured',
        durationMs: Date.now() - startTime,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail || email,
          source: 'signup',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        this.recordFailure(new Error(`HTTP ${res.status}`));
        return this.createNormalizedResult({
          mailboxStatus: 'UNKNOWN',
          rawStatus: `http_${res.status}`,
          error: `SendGrid responded with HTTP ${res.status}`,
          durationMs: Date.now() - startTime,
        });
      }

      const payload = await res.json();
      this.recordSuccess();

      const result = payload.result || {};
      const verdict = (result.verdict || '').toLowerCase();
      const checks = result.checks || {};
      const domainChecks = checks.domain || {};
      const localChecks = checks.local_part || {};
      const additional = checks.additional || {};

      const isDisposable = Boolean(
        domainChecks.is_suspected_disposable_address ||
        localChecks.is_suspected_disposable_address
      );
      const isRoleAccount = Boolean(localChecks.is_suspected_role_address);
      const hasKnownBounces = Boolean(additional.has_known_bounces || additional.has_suspected_bounces);

      let mailboxStatus = 'UNKNOWN';
      if (verdict === 'valid') {
        mailboxStatus = 'LIKELY_EXISTS';
      } else if (verdict === 'invalid' || domainChecks.has_mx_or_a_record === false) {
        mailboxStatus = 'NOT_FOUND';
      }

      let confidence = 75;
      if (typeof result.score === 'number') {
        confidence = Math.round(result.score * 100);
      } else if (verdict === 'valid') {
        confidence = 92;
      } else if (verdict === 'invalid') {
        confidence = 95;
      }

      return this.createNormalizedResult({
        mailboxStatus,
        isDisposable,
        isRoleAccount,
        isAbusive: hasKnownBounces,
        confidence,
        rawStatus: verdict || 'unknown',
        reason: verdict,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      clearTimeout(timeout);
      this.recordFailure(err);
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: err.name === 'AbortError' ? 'timeout' : 'network_error',
        error: err.message,
        durationMs: Date.now() - startTime,
      });
    }
  }
}

module.exports = SendGridValidationProvider;
