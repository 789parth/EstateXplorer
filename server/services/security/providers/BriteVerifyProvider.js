const BaseValidationProvider = require('./BaseValidationProvider');

/**
 * Validity BriteVerify Email Verification Engine
 * Enterprise deliverability validation, invalid-address detection,
 * disposable-mailbox filtering, and risk signals.
 */
class BriteVerifyProvider extends BaseValidationProvider {
  constructor() {
    super('briteverify', 3500);
    this.apiKey = process.env.BRITEVERIFY_API_KEY || '';
    this.apiUrl = process.env.BRITEVERIFY_API_URL || 'https://bpi.briteverify.com/emails.json';
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
        reason: 'Circuit breaker is open for BriteVerify',
        durationMs: Date.now() - startTime,
      });
    }

    // 3. Fallback if API key is unconfigured
    const key = process.env.BRITEVERIFY_API_KEY || this.apiKey;
    if (!key) {
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'no_api_key',
        reason: 'BriteVerify API key unconfigured',
        durationMs: Date.now() - startTime,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const targetUrl = new URL(this.apiUrl);
      targetUrl.searchParams.set('apikey', key);
      targetUrl.searchParams.set('address', normalizedEmail || email);

      const res = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        this.recordFailure(new Error(`HTTP ${res.status}`));
        return this.createNormalizedResult({
          mailboxStatus: 'UNKNOWN',
          rawStatus: `http_${res.status}`,
          error: `BriteVerify responded with HTTP ${res.status}`,
          durationMs: Date.now() - startTime,
        });
      }

      const data = await res.json();
      this.recordSuccess();

      const status = (data.status || '').toLowerCase();
      const error = (data.error || '').toLowerCase();

      const isDisposable = status === 'disposable' || error === 'disposable' || Boolean(data.disposable);
      const isCatchAll = status === 'accept_all' || error === 'accept_all';
      const isRoleAccount = Boolean(data.role_address) || error === 'role_address';

      let mailboxStatus = 'UNKNOWN';
      if (status === 'valid') {
        mailboxStatus = 'LIKELY_EXISTS';
      } else if (status === 'invalid' || error === 'email_account_invalid' || error === 'email_domain_invalid') {
        mailboxStatus = 'NOT_FOUND';
      }

      const confidence = (status === 'valid' || status === 'invalid' || isDisposable) ? 95 : 70;

      return this.createNormalizedResult({
        mailboxStatus,
        isDisposable,
        isCatchAll,
        isRoleAccount,
        confidence,
        rawStatus: `${status}:${error}`,
        reason: error || status,
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

module.exports = BriteVerifyProvider;
