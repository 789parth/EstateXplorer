const { normalizeEmail } = require('./security/emailNormalizer');
const { evaluateRegistrationRisk } = require('./security/registrationSecurityService');
const { BUILT_IN_ALLOWLIST_DOMAINS } = require('./security/securityListService');

// In-memory cache for legacy API compatibility: domain -> { isDisposable, reason, expiresAt }
const domainCache = new Map();

/**
 * Checks whether an email address uses a temporary / disposable domain,
 * utilizing the multi-layered enterprise anti-abuse engine.
 *
 * @param {string} email
 * @param {object} [context={}] Optional additional request metadata (ip, userAgent, etc.)
 * @returns {Promise<{ isDisposable: boolean, domain: string, reason: string, riskScore?: number, decision?: string }>}
 */
async function isDisposableEmail(email, context = {}) {
  const norm = normalizeEmail(email);

  if (!norm.isValid || !norm.domain) {
    return {
      isDisposable: false,
      domain: norm.domain || '',
      reason: 'invalid_email_format',
    };
  }

  // 1. Fast path for trusted legitimate email providers
  if (BUILT_IN_ALLOWLIST_DOMAINS.has(norm.domain)) {
    return {
      isDisposable: false,
      domain: norm.domain,
      reason: 'trusted_provider',
    };
  }

  // 2. Check local domain cache
  const cached = domainCache.get(norm.domain);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      isDisposable: cached.isDisposable,
      domain: norm.domain,
      reason: cached.reason || (cached.isDisposable ? 'disposable_domain_cached' : 'valid_domain_cached'),
    };
  }

  // 3. Delegate to Enterprise Registration Security Engine
  const evaluation = await evaluateRegistrationRisk({
    email,
    ip: context.ip || '',
    userAgent: context.userAgent || '',
    botToken: context.botToken || '',
    honeypot: context.honeypot || '',
    formTimeMs: context.formTimeMs || 0,
  });

  const isDisposable = evaluation.decision === 'BLOCK' || evaluation.isDisposable;
  const reason = evaluation.reasonCode || (isDisposable ? 'disposable_domain' : 'valid_domain');

  // Cache domain resolution
  const cacheTtlMs = parseInt(process.env.DISPOSABLE_EMAIL_CACHE_TTL, 10) || 3600000;
  domainCache.set(norm.domain, {
    isDisposable,
    reason,
    expiresAt: Date.now() + cacheTtlMs,
  });

  return {
    isDisposable,
    domain: norm.domain,
    reason,
    riskScore: evaluation.riskScore,
    decision: evaluation.decision,
    publicMessage: evaluation.publicMessage,
    rejectionCategory: evaluation.rejectionCategory || null,
    mailboxExists: typeof evaluation.mailboxExists === 'boolean' ? evaluation.mailboxExists : !isDisposable,
  };
}

const redisCacheService = require('./security/cache/redisCacheService');

/**
 * Clears the domain cache (useful for testing).
 */
function clearCache() {
  domainCache.clear();
  redisCacheService.clearCache();
}

/**
 * Returns current cache size (useful for testing).
 */
function getCacheSize() {
  return domainCache.size;
}

module.exports = {
  normalizeEmail,
  isDisposableEmail,
  clearCache,
  getCacheSize,
  TRUSTED_DOMAINS: BUILT_IN_ALLOWLIST_DOMAINS,
};
