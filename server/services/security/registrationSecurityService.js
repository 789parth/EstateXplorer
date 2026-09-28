const crypto = require('crypto');
const mongoose = require('mongoose');
const { normalizeEmail } = require('./emailNormalizer');
const { inspectDomainDNS } = require('./dnsService');
const LocalDatasetProvider = require('./providers/LocalDatasetProvider');
const ExternalPrimaryProvider = require('./providers/ExternalPrimaryProvider');
const ExternalSecondaryProvider = require('./providers/ExternalSecondaryProvider');
const DomainReputationProvider = require('./providers/DomainReputationProvider');
const MxInfrastructureProvider = require('./providers/MxInfrastructureProvider');
const redisCacheService = require('./cache/redisCacheService');
const DomainReputation = require('../../models/DomainReputation');
const securityListService = require('./securityListService');
const { checkVelocity } = require('./velocityService');
const { evaluateBotSignals } = require('./botProtectionService');
const registrationRiskEngine = require('./registrationRiskEngine');
const policyEngine = require('./policyEngine');
const securityAuditService = require('./securityAuditService');
const SecurityConfig = require('../../models/SecurityConfig');

// Provider singletons
const localDatasetProvider = new LocalDatasetProvider();
const externalPrimaryProvider = new ExternalPrimaryProvider();
const externalSecondaryProvider = new ExternalSecondaryProvider();
const domainReputationProvider = new DomainReputationProvider();
const mxInfrastructureProvider = new MxInfrastructureProvider();
const {
  executeParallelValidation,
  evaluateConsensus,
  providers: {
    zeroBounceProvider,
    kickboxProvider,
    sendGridProvider,
    briteVerifyProvider,
  },
} = require('./consensusEngine');

// Active policy runtime cache
let cachedConfig = {
  mode: process.env.SECURITY_MODE || 'NORMAL', // 'NORMAL' | 'STRICT' | 'LOCKDOWN'
  riskThresholds: { lowMax: 19, moderateMax: 39, elevatedMax: 59, highMax: 79 },
  botProtectionEnabled: true,
  dnsValidationEnabled: process.env.DNS_VALIDATION_ENABLED !== 'false',
  externalProvidersEnabled: true,
  failMode: (process.env.DISPOSABLE_EMAIL_FAIL_MODE || 'allow').toLowerCase(),
};
let lastConfigSync = 0;

/**
 * Syncs active security configuration from database.
 */
async function syncSecurityConfig() {
  try {
    if (mongoose.connection.readyState !== 1) {
      lastConfigSync = Date.now();
      return;
    }

    const doc = await SecurityConfig.findOne({ key: 'default_security_policy' }).lean();
    if (doc) {
      cachedConfig = {
        mode: doc.mode || 'NORMAL',
        riskThresholds: doc.riskThresholds || cachedConfig.riskThresholds,
        botProtectionEnabled: doc.botProtectionEnabled ?? true,
        dnsValidationEnabled: doc.dnsValidationEnabled ?? true,
        externalProvidersEnabled: doc.externalProvidersEnabled ?? true,
        failMode: doc.failMode || (process.env.DISPOSABLE_EMAIL_FAIL_MODE || 'allow').toLowerCase(),
      };
    }
    lastConfigSync = Date.now();
  } catch (e) {
    // Keep in-memory config during tests or DB reconnect
  }
}

/**
 * Evaluates comprehensive registration security, multi-layer disposable detection, and email risk.
 *
 * @param {{
 *   email: string,
 *   ip?: string,
 *   userAgent?: string,
 *   botToken?: string,
 *   honeypot?: string,
 *   formTimeMs?: number,
 *   correlationId?: string
 * }} context
 * @returns {Promise<{
 *   isDisposable: boolean,
 *   decision: 'ALLOW' | 'ALLOW_WITH_VERIFICATION' | 'STEP_UP_CHALLENGE' | 'TEMPORARY_REVIEW' | 'BLOCK',
 *   reasonCode: string,
 *   publicMessage: string,
 *   riskScore: number,
 *   riskTier: string,
 *   domain: string,
 *   normalizedEmail: string,
 *   emailHash: string,
 *   isRoleAccount: boolean,
 *   latencyMs: number,
 *   classification: 'LEGITIMATE' | 'FREE_PROVIDER' | 'DISPOSABLE' | 'TEMPORARY' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN',
 *   breakdown: object
 * }>}
 */
async function evaluateRegistrationRisk({
  email,
  ip = '',
  userAgent = '',
  botToken = '',
  honeypot = '',
  formTimeMs = 0,
  correlationId = crypto.randomUUID(),
}) {
  const startTime = Date.now();

  // Refresh dynamic config if expired (every 60s)
  if (Date.now() - lastConfigSync > 60000) {
    await syncSecurityConfig();
  }

  // 1. Email Normalization
  const norm = normalizeEmail(email);
  if (!norm.isValid || !norm.domain) {
    const latencyMs = Date.now() - startTime;
    return {
      isDisposable: false,
      decision: 'BLOCK',
      reasonCode: 'invalid_email_format',
      publicMessage: 'Please provide a valid email address.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      domain: norm.domain,
      normalizedEmail: norm.normalizedEmail,
      emailHash: norm.emailHash,
      isRoleAccount: false,
      latencyMs,
      classification: 'UNKNOWN',
      breakdown: { syntaxErrors: norm.syntaxErrors },
    };
  }

  const { domain, normalizedEmail, emailHash, isRoleAccount } = norm;

  // 2. Check Explicit Blocklist (instant block)
  const blockCheck = await securityListService.isBlocklisted({ domain, emailHash, ip });
  if (blockCheck.blocked) {
    const latencyMs = Date.now() - startTime;
    securityAuditService.logEvent({
      correlationId,
      eventType: 'REGISTRATION_BLOCKED',
      emailHash,
      emailDomain: domain,
      ip,
      userAgent,
      decision: 'BLOCK',
      reasonCode: 'POLICY_BLOCK',
      riskScore: 100,
      latencyMs,
      metadata: { blockReason: blockCheck.reason },
    });

    return {
      isDisposable: true,
      decision: 'BLOCK',
      reasonCode: 'POLICY_BLOCK',
      publicMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      domain,
      normalizedEmail,
      emailHash,
      isRoleAccount,
      latencyMs,
      classification: 'DISPOSABLE',
      breakdown: { blockReason: blockCheck.reason },
    };
  }

  // 3. Check Enterprise Allowlist (fast path for trusted providers e.g. Gmail, Outlook, Yahoo)
  const isAllowlisted = await securityListService.isAllowlisted(domain);
  if (isAllowlisted) {
    const latencyMs = Date.now() - startTime;
    return {
      isDisposable: false,
      decision: 'ALLOW_WITH_VERIFICATION',
      reasonCode: 'trusted_provider',
      publicMessage: '',
      riskScore: 5,
      riskTier: 'LOW',
      domain,
      normalizedEmail,
      emailHash,
      isRoleAccount,
      latencyMs,
      classification: 'FREE_PROVIDER',
      breakdown: { allowlisted: true },
    };
  }

  // 4. Fast path: Check local dataset of 121,500+ disposable domains (Instant O(1) set lookup)
  const localRes = await localDatasetProvider.evaluate({ normalizedEmail, domain });
  if (localRes.isDisposable) {
    const latencyMs = Date.now() - startTime;
    // Cache positive hit into Tier 1 / Tier 2 cache
    await redisCacheService.setDomainRisk(domain, {
      domain,
      classification: 'DISPOSABLE',
      riskScore: 100,
      confidence: 100,
      isDisposable: true,
      isBlocked: true,
      source: 'local_dataset',
    });

    securityAuditService.logEvent({
      correlationId,
      eventType: 'DISPOSABLE_EMAIL_DETECTED',
      emailHash,
      emailDomain: domain,
      ip,
      userAgent,
      decision: 'BLOCK',
      reasonCode: 'disposable_domain',
      riskScore: 100,
      latencyMs,
    });

    return {
      isDisposable: true,
      decision: 'BLOCK',
      reasonCode: 'disposable_domain',
      publicMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      domain,
      normalizedEmail,
      emailHash,
      isRoleAccount,
      latencyMs,
      classification: 'DISPOSABLE',
      breakdown: { provider: 'local_dataset', isDisposable: true },
    };
  }

  // 5. Multi-Tier Cache Check (Tier 1 In-Memory + Tier 2 Redis)
  const cachedRisk = await redisCacheService.getDomainRisk(domain);
  if (cachedRisk) {
    if (
      cachedRisk.isDisposable ||
      cachedRisk.classification === 'DISPOSABLE' ||
      cachedRisk.classification === 'TEMPORARY' ||
      cachedRisk.isBlocked
    ) {
      const latencyMs = Date.now() - startTime;
      securityAuditService.logEvent({
        correlationId,
        eventType: 'DISPOSABLE_EMAIL_DETECTED',
        emailHash,
        emailDomain: domain,
        ip,
        userAgent,
        decision: 'BLOCK',
        reasonCode: 'disposable_domain',
        riskScore: cachedRisk.riskScore || 100,
        latencyMs,
        metadata: { cachedTier: cachedRisk.cachedTier, source: cachedRisk.source },
      });

      return {
        isDisposable: true,
        decision: 'BLOCK',
        reasonCode: 'disposable_domain',
        publicMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
        riskScore: cachedRisk.riskScore || 100,
        riskTier: 'CRITICAL',
        domain,
        normalizedEmail,
        emailHash,
        isRoleAccount,
        latencyMs,
        classification: cachedRisk.classification || 'DISPOSABLE',
        breakdown: { cached: true, tier: cachedRisk.cachedTier, source: cachedRisk.source },
      };
    }
  }

  // 6. Persistent DomainReputation MongoDB Check (if not in cache and DB is available)
  if (!cachedRisk && mongoose.connection.readyState === 1) {
    try {
      const dbRep = await DomainReputation.findOne({ domain }).lean();
      if (dbRep) {
        // Backfill cache
        await redisCacheService.setDomainRisk(domain, dbRep);
        if (
          dbRep.isDisposable ||
          dbRep.classification === 'DISPOSABLE' ||
          dbRep.classification === 'TEMPORARY' ||
          dbRep.isBlocked
        ) {
          const latencyMs = Date.now() - startTime;
          securityAuditService.logEvent({
            correlationId,
            eventType: 'DISPOSABLE_EMAIL_DETECTED',
            emailHash,
            emailDomain: domain,
            ip,
            userAgent,
            decision: 'BLOCK',
            reasonCode: 'disposable_domain',
            riskScore: dbRep.riskScore || 100,
            latencyMs,
            metadata: { source: dbRep.source },
          });

          return {
            isDisposable: true,
            decision: 'BLOCK',
            reasonCode: 'disposable_domain',
            publicMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
            riskScore: dbRep.riskScore || 100,
            riskTier: 'CRITICAL',
            domain,
            normalizedEmail,
            emailHash,
            isRoleAccount,
            latencyMs,
            classification: dbRep.classification || 'DISPOSABLE',
            breakdown: { databaseMatch: true, source: dbRep.source },
          };
        }
      }
    } catch (dbErr) {
      // Ignore DB read errors during offline/tests
    }
  }

  // 7. Domain DNS & Routing Inspection
  let dnsRes = { hasMx: true, isNullMx: false, dnsValid: true, mxRecords: [], reason: 'dns_skipped' };
  if (cachedConfig.dnsValidationEnabled) {
    try {
      dnsRes = await inspectDomainDNS(domain);
    } catch (e) {
      dnsRes = { hasMx: true, isNullMx: false, dnsValid: true, mxRecords: [], reason: 'dns_error_fallback' };
    }
  }

  // Check RFC 7505 Null MX (domain explicitly announces it rejects all email)
  if (dnsRes.isNullMx) {
    const latencyMs = Date.now() - startTime;
    return {
      isDisposable: true,
      decision: 'BLOCK',
      reasonCode: 'null_mx_record',
      publicMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      domain,
      normalizedEmail,
      emailHash,
      isRoleAccount,
      latencyMs,
      classification: 'MALICIOUS',
      breakdown: { isNullMx: true, dnsReason: dnsRes.reason },
    };
  }

  // 8. MX Routing Infrastructure Provider (detects mail routed to disposable services)
  const mxRes = await mxInfrastructureProvider.evaluate({ domain, mxRecords: dnsRes.mxRecords || [] });

  // 9. External Threat Intelligence Provider
  let externalRes = null;
  const apiUrl = process.env.DISPOSABLE_EMAIL_API_URL || process.env.EXTERNAL_EMAIL_RISK_API_URL;
  const hasMock = typeof externalPrimaryProvider.mockHandler === 'function';

  if (cachedConfig.externalProvidersEnabled && (apiUrl || hasMock)) {
    externalRes = await externalPrimaryProvider.evaluate({ normalizedEmail, domain });
    if (externalRes.reason === 'external_api_failure_blocked') {
      const latencyMs = Date.now() - startTime;
      return {
        isDisposable: true,
        decision: 'BLOCK',
        reasonCode: 'external_api_failure_blocked',
        publicMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
        riskScore: 100,
        riskTier: 'CRITICAL',
        domain,
        normalizedEmail,
        emailHash,
        isRoleAccount,
        latencyMs,
        classification: 'SUSPICIOUS',
        breakdown: { failMode: 'block', externalError: true },
      };
    }
  }

  // 10. Domain Reputation Heuristics
  const domainRepRes = await domainReputationProvider.evaluate({ normalizedEmail, domain });

  // 11. Parallel 4-Provider Validation (ZeroBounce, Kickbox, SendGrid, BriteVerify)
  let enterpriseResults = [];
  try {
    enterpriseResults = await executeParallelValidation({
      email,
      domain,
      normalizedEmail,
      ip,
    });
  } catch (err) {
    // Isolated provider failure does not crash the system
  }

  const allProviderResults = [...enterpriseResults];
  if (externalRes) {
    allProviderResults.push({
      provider: externalRes.provider || 'external_primary',
      mailboxStatus: externalRes.isDisposable ? 'INVALID' : 'LIKELY_EXISTS',
      isDisposable: Boolean(externalRes.isDisposable),
      isCatchAll: Boolean(externalRes.isAcceptAll),
      isRoleAccount: Boolean(externalRes.isRoleAccount),
      isSpamTrap: false,
      isToxic: false,
      isAbusive: false,
      confidence: externalRes.confidence || 90,
      rawStatus: externalRes.reason || 'completed',
    });
  }

  // 12. Multi-Source Consensus Classification & Strict Decision Matrix
  const consensusResult = evaluateConsensus({
    providerResults: allProviderResults,
    localSignals: {
      syntaxValid: true,
      domainValid: dnsRes.dnsValid,
      mxValid: dnsRes.hasMx,
      isNullMx: dnsRes.isNullMx,
      isLocalDisposable: localRes.isDisposable || mxRes.isDisposable || domainRepRes.isDisposable,
      isRoleAccount,
    },
  });

  if (consensusResult.decision === 'BLOCK') {
    const latencyMs = Date.now() - startTime;
    const isTemporary = Boolean(
      externalRes?.isTemporary ||
      mxRes?.isTemporary ||
      consensusResult.isTemporary
    );
    const classification = isTemporary
      ? 'TEMPORARY'
      : (consensusResult.disposable ? 'DISPOSABLE' : 'SUSPICIOUS');

    // Cache the domain intelligence in Tier 1 & Tier 2 cache for instant future checks
    await redisCacheService.setDomainRisk(domain, {
      domain,
      classification,
      isDisposable: consensusResult.disposable,
      riskScore: consensusResult.riskScore || 100,
      confidence: consensusResult.confidence || 95,
      source: externalRes?.provider || 'consensus_engine',
      isBlocked: true,
      isAllowed: false,
      mxHostnames: (dnsRes.mxRecords || []).map((r) => r.exchange),
    });

    securityAuditService.logEvent({
      correlationId,
      eventType: consensusResult.disposable ? 'DISPOSABLE_EMAIL_DETECTED' : 'REGISTRATION_BLOCKED',
      emailHash,
      emailDomain: domain,
      ip,
      userAgent,
      decision: 'BLOCK',
      reasonCode: consensusResult.rejectionCategory || 'consensus_block',
      riskScore: consensusResult.riskScore || 100,
      latencyMs,
      metadata: { consensus: consensusResult },
    });

    return {
      isDisposable: consensusResult.disposable,
      decision: 'BLOCK',
      rejectionCategory: consensusResult.rejectionCategory,
      reasonCode: consensusResult.rejectionCategory || 'consensus_block',
      publicMessage: consensusResult.formattedErrorMessage || 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
      riskScore: consensusResult.riskScore || 100,
      riskTier: consensusResult.riskTier || 'CRITICAL',
      domain,
      normalizedEmail,
      emailHash,
      isRoleAccount,
      mailboxExists: consensusResult.mailboxLikelyExists,
      latencyMs,
      classification,
      breakdown: {
        consensus: consensusResult,
        providerBreakdown: consensusResult.providerBreakdown,
      },
    };
  }

  const isDisposable = Boolean(
    consensusResult.disposable ||
    (externalRes && externalRes.isDisposable) ||
    mxRes.isDisposable ||
    domainRepRes.isDisposable
  );

  let classification = 'UNKNOWN';
  if (isDisposable) {
    classification = (externalRes?.isTemporary || mxRes.isTemporary) ? 'TEMPORARY' : 'DISPOSABLE';
  } else if (!dnsRes.dnsValid && !dnsRes.hasMx && !dnsRes.hasAddressFallback) {
    classification = 'SUSPICIOUS';
  } else if (domainRepRes.isDomainRisky) {
    classification = 'SUSPICIOUS';
  } else {
    // DNS/MX validation alone is NOT disposable detection. An unverified domain is UNKNOWN, not verified safe.
    classification = 'UNKNOWN';
  }

  // 12. Cache & Persist Discovered Domain Intelligence
  const domainRiskRecord = {
    domain,
    classification,
    isDisposable,
    riskScore: isDisposable ? 100 : (classification === 'UNKNOWN' ? 35 : 10),
    confidence: isDisposable ? 95 : 70,
    source: externalRes?.provider || mxRes?.provider || domainRepRes?.provider || 'reputation_engine',
    isBlocked: isDisposable,
    isAllowed: false,
    mxHostnames: (dnsRes.mxRecords || []).map((r) => r.exchange),
  };

  // Cache in Tier 1 & Tier 2
  await redisCacheService.setDomainRisk(domain, domainRiskRecord);

  // Persist into MongoDB DomainReputation if DB connected
  if (mongoose.connection.readyState === 1) {
    DomainReputation.findOneAndUpdate(
      { domain },
      {
        $set: {
          domain,
          classification,
          riskScore: domainRiskRecord.riskScore,
          confidence: domainRiskRecord.confidence,
          source: domainRiskRecord.source,
          isDisposable,
          isBlocked: isDisposable,
          isAllowed: false,
          mxHostnames: domainRiskRecord.mxHostnames,
          lastSeenAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days TTL
        },
        $setOnInsert: { firstSeenAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch(() => {});
  }

  // 13. Velocity, Bot, and Risk Engine Evaluation
  const isWatchlisted = await securityListService.isWatchlisted(domain);
  const velocitySignals = checkVelocity({ ip, domain, emailHash, isAllowlisted: false });
  const botSignals = await evaluateBotSignals({ botToken, honeypot, formTimeMs, ip, userAgent });

  const emailSignals = {
    isDisposable,
    isTemporary: classification === 'TEMPORARY',
    isRoleAccount,
    isDomainRisky: domainRepRes.isDomainRisky || isDisposable,
    provider: isDisposable ? (externalRes?.provider || mxRes?.provider || 'reputation') : 'clean',
  };

  const riskResult = registrationRiskEngine.evaluate({
    emailSignals,
    domainSignals: dnsRes,
    botSignals,
    velocitySignals,
    listSignals: { isAllowlisted: false, isBlocklisted: false, isWatchlisted },
    ipSignals: { ipRisk: 0 },
    configThresholds: cachedConfig.riskThresholds,
  });

  // 14. Policy Decision Engine
  const policyResult = policyEngine.decide({
    compositeScore: riskResult.compositeScore,
    riskTier: riskResult.riskTier,
    criticalFlags: riskResult.criticalFlags,
    mode: cachedConfig.mode,
    isAllowlisted: false,
    botSignals,
    velocitySignals,
    emailSignals,
  });

  const latencyMs = Date.now() - startTime;
  const reasonCode = isDisposable ? 'disposable_domain' : policyResult.reasonCode;

  // 15. Security Audit Logging
  securityAuditService.logEvent({
    correlationId,
    eventType:
      policyResult.decision === 'BLOCK'
        ? 'REGISTRATION_BLOCKED'
        : policyResult.decision === 'STEP_UP_CHALLENGE'
        ? 'BOT_CHALLENGE_REQUIRED'
        : isDisposable
        ? 'DISPOSABLE_EMAIL_DETECTED'
        : 'REGISTRATION_ALLOWED',
    emailHash,
    emailDomain: domain,
    ip,
    userAgent,
    decision: policyResult.decision,
    reasonCode,
    riskScore: riskResult.compositeScore,
    confidence: 90,
    riskSignals: {
      isDisposable,
      classification,
      isRoleAccount,
      isNullMx: dnsRes.isNullMx,
      isBot: botSignals.isBot,
      isRateLimited: velocitySignals.isRateLimited,
      breakdown: riskResult.breakdown,
    },
    policyMode: cachedConfig.mode,
    policyVersion: 'registration-security-v2',
    latencyMs,
  });

  return {
    isDisposable,
    decision: policyResult.decision,
    reasonCode,
    publicMessage: policyResult.publicMessage,
    riskScore: riskResult.compositeScore,
    riskTier: riskResult.riskTier,
    domain,
    normalizedEmail,
    emailHash,
    isRoleAccount,
    latencyMs,
    classification,
    breakdown: {
      ...riskResult.breakdown,
      classification,
      criticalFlags: riskResult.criticalFlags,
      dnsReason: dnsRes.reason,
      velocityReason: velocitySignals.reason,
      botReason: botSignals.reason,
    },
  };
}

/**
 * Returns current in-memory security configuration.
 */
function getSecurityConfig() {
  return { ...cachedConfig };
}

/**
 * Updates runtime security mode and thresholds.
 */
async function updateSecurityConfig(updates, updatedByUserId = null) {
  if (updates.mode) cachedConfig.mode = updates.mode;
  if (updates.riskThresholds) cachedConfig.riskThresholds = { ...cachedConfig.riskThresholds, ...updates.riskThresholds };
  if (typeof updates.botProtectionEnabled === 'boolean') cachedConfig.botProtectionEnabled = updates.botProtectionEnabled;
  if (typeof updates.dnsValidationEnabled === 'boolean') cachedConfig.dnsValidationEnabled = updates.dnsValidationEnabled;
  if (typeof updates.externalProvidersEnabled === 'boolean') cachedConfig.externalProvidersEnabled = updates.externalProvidersEnabled;
  if (updates.failMode) cachedConfig.failMode = updates.failMode;

  try {
    if (mongoose.connection.readyState === 1) {
      await SecurityConfig.findOneAndUpdate(
        { key: 'default_security_policy' },
        { ...cachedConfig, updatedBy: updatedByUserId },
        { upsert: true, new: true }
      );
    }
  } catch (e) {
    // In-memory fallback
  }

  return { ...cachedConfig };
}

module.exports = {
  evaluateRegistrationRisk,
  getSecurityConfig,
  updateSecurityConfig,
  syncSecurityConfig,
  externalPrimaryProvider,
  externalSecondaryProvider,
  localDatasetProvider,
  domainReputationProvider,
  mxInfrastructureProvider,
  zeroBounceProvider,
  kickboxProvider,
  sendGridProvider,
  briteVerifyProvider,
  executeParallelValidation,
  evaluateConsensus,
  providers: {
    externalPrimaryProvider,
    externalSecondaryProvider,
    localDatasetProvider,
    domainReputationProvider,
    mxInfrastructureProvider,
    zeroBounceProvider,
    kickboxProvider,
    sendGridProvider,
    briteVerifyProvider,
  },
};
