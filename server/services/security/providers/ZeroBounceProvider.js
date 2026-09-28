const BaseValidationProvider = require('./BaseValidationProvider');

/**
 * ZeroBounce Email Validation Engine
 * Provides deliverability, disposable detection, mailbox validation, catch-all,
 * spam trap, toxic, and abuse intelligence.
 */
class ZeroBounceProvider extends BaseValidationProvider {
  constructor() {
    super('zerobounce', 3500);
    this.apiKey = process.env.ZEROBOUNCE_API_KEY || '';
    this.apiUrl = process.env.ZEROBOUNCE_API_URL || 'https://api.zerobounce.net/v2/validate';
  }

  async evaluate({ email, domain, normalizedEmail, ip = '' }) {
    const startTime = Date.now();

    // 1. Mock handler for isolated automated testing
    if (typeof this.mockHandler === 'function') {
      const mock = await this.mockHandler({ email, domain, normalizedEmail, ip });
      if (mock) {
        return this.createNormalizedResult({
          ...mock,
          durationMs: Date.now() - startTime,
        });
      }
    }

    // 2. Circuit breaker check
    if (this.isCircuitOpen()) {
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'circuit_open',
        reason: 'Circuit breaker is open for ZeroBounce',
        durationMs: Date.now() - startTime,
      });
    }

    // 3. Fallback if API key is unconfigured
    const key = process.env.ZEROBOUNCE_API_KEY || this.apiKey;
    if (!key) {
      return this.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'no_api_key',
        reason: 'ZeroBounce API key unconfigured',
        durationMs: Date.now() - startTime,
      });
    }

    // 4. API Request with AbortController timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const targetUrl = new URL(this.apiUrl);
      targetUrl.searchParams.set('api_key', key);
      targetUrl.searchParams.set('email', normalizedEmail || email);
      if (ip) targetUrl.searchParams.set('ip_address', ip);

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
          error: `ZeroBounce responded with HTTP ${res.status}`,
          durationMs: Date.now() - startTime,
        });
      }

      const data = await res.json();
      this.recordSuccess();

      const status = (data.status || '').toLowerCase();
      const subStatus = (data.sub_status || '').toLowerCase();

      const isDisposable = status === 'disposable' || subStatus === 'disposable';
      const isSpamTrap = status === 'spamtrap' || subStatus === 'possible_traps' || subStatus === 'spamtrap';
      const isToxic = subStatus === 'toxic' || (status === 'do_not_mail' && subStatus === 'toxic');
      const isAbusive = status === 'abuse' || subStatus === 'role_based_catch_all';
      const isCatchAll = status === 'catch-all';
      const isRoleAccount = subStatus === 'role_based' || status === 'role_based';

      let mailboxStatus = 'UNKNOWN';
      if (status === 'valid') {
        mailboxStatus = 'LIKELY_EXISTS';
      } else if (subStatus === 'mailbox_not_found' || status === 'invalid') {
        mailboxStatus = 'NOT_FOUND';
      } else if (subStatus === 'failed_syntax_check' || subStatus === 'no_dns_entries' || subStatus === 'unroutable_ip_address') {
        mailboxStatus = 'INVALID';
      }

      let confidence = 75;
      if (status === 'valid') confidence = 95;
      if (isDisposable || isSpamTrap || isToxic || mailboxStatus === 'NOT_FOUND') confidence = 98;

      return this.createNormalizedResult({
        mailboxStatus,
        isDisposable,
        isCatchAll,
        isRoleAccount,
        isSpamTrap,
        isToxic,
        isAbusive,
        confidence,
        rawStatus: `${status}:${subStatus}`,
        reason: subStatus || status,
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

module.exports = ZeroBounceProvider;
