const BaseValidationProvider = require('./BaseValidationProvider');

/**
 * Kickbox Real-Time Email Verification Engine
 * Provides deliverability intelligence, mailbox verification, risk signals,
 * and disposable/risky address detection.
 */
class KickboxProvider extends BaseValidationProvider {
  constructor() {
    super('kickbox', 3500);
    this.apiKey = process.env.KICKBOX_API_KEY || '';
    this.apiUrl = process.env.KICKBOX_API_URL || 'https://api.kickbox.com/v2/verify';
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
        reason: 'Circuit breaker is open for Kickbox',
        durationMs: Date.now() - startTime,
      });
    }

    // 3. Fallback if API key is unconfigured
    const key = process.env.KICKBOX_API_KEY || this.apiKey;
    if (!key) {
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'no_api_key',
        reason: 'Kickbox API key unconfigured',
        durationMs: Date.now() - startTime,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const targetUrl = new URL(this.apiUrl);
      targetUrl.searchParams.set('apikey', key);
      targetUrl.searchParams.set('email', normalizedEmail || email);

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
          error: `Kickbox responded with HTTP ${res.status}`,
          durationMs: Date.now() - startTime,
        });
      }

      const data = await res.json();
      this.recordSuccess();

      const result = (data.result || '').toLowerCase();
      const reason = (data.reason || '').toLowerCase();
      const isDisposable = Boolean(data.disposable);
      const isCatchAll = Boolean(data.accept_all);
      const isRoleAccount = Boolean(data.role);

      let mailboxStatus = 'UNKNOWN';
      if (result === 'deliverable') {
        mailboxStatus = 'LIKELY_EXISTS';
      } else if (result === 'undeliverable' || reason === 'rejected_email' || reason === 'invalid_email') {
        mailboxStatus = 'NOT_FOUND';
      }

      let confidence = 75;
      if (typeof data.sendex === 'number') {
        confidence = Math.round(data.sendex * 100);
      } else if (result === 'deliverable') {
        confidence = 95;
      } else if (result === 'undeliverable') {
        confidence = 95;
      }

      return this.createNormalizedResult({
        mailboxStatus,
        isDisposable,
        isCatchAll,
        isRoleAccount,
        confidence,
        rawStatus: `${result}:${reason}`,
        reason: reason || result,
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

module.exports = KickboxProvider;
