/**
 * Base Enterprise Email Validation Provider
 * Standardized abstract provider interface with circuit breaking, timeout control,
 * error isolation, and unified normalization.
 */
class BaseValidationProvider {
  constructor(name, defaultTimeoutMs = 3500) {
    this.name = name;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.isEnabled = true;
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
    this.circuitThreshold = 4;
    this.circuitCooldownMs = 45000; // 45s cooldown
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

  recordFailure(err) {
    this.failureCount += 1;
    if (this.failureCount >= this.circuitThreshold) {
      this.circuitOpenUntil = Date.now() + this.circuitCooldownMs;
      console.warn(`[${this.name}] Circuit breaker opened for ${this.circuitCooldownMs / 1000}s due to failures:`, err?.message || err);
    }
  }

  /**
   * Helper to construct a normalized provider response.
   */
  createNormalizedResult({
    mailboxStatus = 'UNKNOWN', // 'LIKELY_EXISTS' | 'UNKNOWN' | 'NOT_FOUND' | 'INVALID'
    isDisposable = false,
    isCatchAll = false,
    isRoleAccount = false,
    isSpamTrap = false,
    isToxic = false,
    isAbusive = false,
    confidence = 50,
    rawStatus = 'unknown',
    reason = '',
    error = null,
    durationMs = 0,
  } = {}) {
    return {
      provider: this.name,
      mailboxStatus,
      isDisposable: Boolean(isDisposable),
      isCatchAll: Boolean(isCatchAll),
      isRoleAccount: Boolean(isRoleAccount),
      isSpamTrap: Boolean(isSpamTrap),
      isToxic: Boolean(isToxic),
      isAbusive: Boolean(isAbusive),
      confidence: Math.max(0, Math.min(100, Number(confidence) || 0)),
      rawStatus: String(rawStatus || 'unknown'),
      reason: reason || '',
      error: error || null,
      checkedAt: new Date(),
      durationMs,
    };
  }

  /**
   * Abstract evaluate method to be implemented by each vendor.
   * @param {{ email: string, domain: string, normalizedEmail: string }} data
   * @returns {Promise<object>}
   */
  async evaluate(data) {
    throw new Error(`Provider ${this.name} must implement evaluate()`);
  }
}

module.exports = BaseValidationProvider;
