const BaseEmailRiskProvider = require('./BaseEmailRiskProvider');

class ExternalPrimaryProvider extends BaseEmailRiskProvider {
  constructor() {
    super('external_primary', 2);
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
    this.circuitThreshold = 5;
    this.circuitCooldownMs = 60000; // 1 minute
    this.mockHandler = null;
  }

  setMockHandler(fn) {
    this.mockHandler = fn;
  }

  clearMockHandler() {
    this.mockHandler = null;
  }

  isCircuitOpen() {
    return Date.now() < this.circuitOpenUntil;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.circuitThreshold) {
      this.circuitOpenUntil = Date.now() + this.circuitCooldownMs;
      console.warn(`[ExternalPrimaryProvider] Circuit breaker tripped open for ${this.circuitCooldownMs / 1000}s`);
    }
  }

  async evaluate({ normalizedEmail, domain }) {
    if (typeof this.mockHandler === 'function') {
      const mockResult = await this.mockHandler({ normalizedEmail, domain });
      if (mockResult) {
        return {
          isDisposable: Boolean(mockResult.isDisposable),
          isTemporary: Boolean(mockResult.isTemporary ?? mockResult.isDisposable),
          isFreeProvider: Boolean(mockResult.isFreeProvider),
          isRoleAccount: Boolean(mockResult.isRoleAccount),
          isAcceptAll: Boolean(mockResult.isAcceptAll),
          isDomainRisky: Boolean(mockResult.isDomainRisky ?? mockResult.isDisposable),
          domainReputation: typeof mockResult.domainReputation === 'number' ? mockResult.domainReputation : (mockResult.isDisposable ? 0 : 80),
          confidence: typeof mockResult.confidence === 'number' ? mockResult.confidence : 95,
          provider: this.name,
          reason: mockResult.reason || (mockResult.isDisposable ? 'external_primary_disposable' : 'external_primary_valid'),
          checkedAt: new Date(),
          ttl: 3600,
        };
      }
    }

    const apiUrl = process.env.DISPOSABLE_EMAIL_API_URL || process.env.EXTERNAL_EMAIL_RISK_API_URL;
    if (!apiUrl) {
      return {
        isDisposable: false,
        isTemporary: false,
        isFreeProvider: false,
        isRoleAccount: false,
        isAcceptAll: false,
        isDomainRisky: false,
        domainReputation: 50,
        confidence: 0,
        provider: this.name,
        reason: 'external_provider_not_configured',
        checkedAt: new Date(),
        ttl: 3600,
      };
    }

    if (this.isCircuitOpen()) {
      return {
        isDisposable: false,
        isTemporary: false,
        isFreeProvider: false,
        isRoleAccount: false,
        isAcceptAll: false,
        isDomainRisky: false,
        domainReputation: 50,
        confidence: 0,
        provider: this.name,
        reason: 'circuit_breaker_open',
        checkedAt: new Date(),
        ttl: 60,
      };
    }

    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.DISPOSABLE_EMAIL_TIMEOUT_MS, 10) || 2000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const apiKey = process.env.DISPOSABLE_EMAIL_API_KEY || process.env.EXTERNAL_EMAIL_RISK_API_KEY;
      const requestUrl = new URL(apiUrl);
      requestUrl.searchParams.set('email', normalizedEmail);
      requestUrl.searchParams.set('domain', domain);

      const headers = { 'User-Agent': 'EstateXplorer-Security-Engine/2.0' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-Api-Key'] = apiKey;
      }

      const response = await fetch(requestUrl.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.recordFailure();
        throw new Error(`HTTP ${response.status} from primary external risk provider`);
      }

      const data = await response.json();
      this.recordSuccess();

      const isDisposable = Boolean(
        data.is_disposable ||
        data.disposable ||
        data.isDisposable ||
        data.block
      );

      const isFree = Boolean(data.is_free || data.free || data.isFreeProvider);
      const isRole = Boolean(data.is_role || data.role || data.isRoleAccount);
      const reputation = typeof data.reputation === 'number' ? data.reputation : (isDisposable ? 0 : 80);

      return {
        isDisposable,
        isTemporary: Boolean(data.is_temporary || isDisposable),
        isFreeProvider: isFree,
        isRoleAccount: isRole,
        isAcceptAll: Boolean(data.accept_all || data.isAcceptAll),
        isDomainRisky: isDisposable || reputation < 30,
        domainReputation: reputation,
        confidence: typeof data.confidence === 'number' ? data.confidence : 90,
        provider: this.name,
        reason: isDisposable ? 'external_primary_disposable' : 'external_primary_valid',
        checkedAt: new Date(),
        ttl: 3600,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      this.recordFailure();

      const failMode = (process.env.DISPOSABLE_EMAIL_FAIL_MODE || 'allow').toLowerCase();
      const isBlockedByPolicy = failMode === 'block';

      return {
        isDisposable: isBlockedByPolicy,
        isTemporary: false,
        isFreeProvider: false,
        isRoleAccount: false,
        isAcceptAll: false,
        isDomainRisky: isBlockedByPolicy,
        domainReputation: isBlockedByPolicy ? 0 : 50,
        confidence: isBlockedByPolicy ? 70 : 0,
        provider: this.name,
        reason: isBlockedByPolicy ? 'external_api_failure_blocked' : `external_api_error_${err.name || 'network'}`,
        checkedAt: new Date(),
        ttl: 60,
      };
    }
  }
}

module.exports = ExternalPrimaryProvider;
