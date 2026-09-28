/**
 * Extreme Enterprise Email Consensus & Decision Policy Engine
 *
 * Evaluates four independent validation engines (ZeroBounce, Kickbox, SendGrid, BriteVerify)
 * and local DNS/MX intelligence to produce a unified, tamper-proof verdict.
 */

const ZeroBounceProvider = require('./providers/ZeroBounceProvider');
const KickboxProvider = require('./providers/KickboxProvider');
const SendGridValidationProvider = require('./providers/SendGridValidationProvider');
const BriteVerifyProvider = require('./providers/BriteVerifyProvider');

// Singletons for the four providers
const zeroBounceProvider = new ZeroBounceProvider();
const kickboxProvider = new KickboxProvider();
const sendGridProvider = new SendGridValidationProvider();
const briteVerifyProvider = new BriteVerifyProvider();

/**
 * Executes all four providers in parallel with timeout isolation.
 *
 * @param {{ email: string, domain: string, normalizedEmail: string, ip?: string }} target
 * @param {number} [timeoutMs=4000]
 * @returns {Promise<Array<object>>}
 */
async function executeParallelValidation(target, timeoutMs = 4000) {
  const providers = [
    { name: 'zerobounce', instance: zeroBounceProvider },
    { name: 'kickbox', instance: kickboxProvider },
    { name: 'sendgrid', instance: sendGridProvider },
    { name: 'briteverify', instance: briteVerifyProvider },
  ];

  const tasks = providers.map(async ({ name, instance }) => {
    try {
      return await Promise.race([
        instance.evaluate(target),
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                instance.createNormalizedResult({
                  mailboxStatus: 'UNKNOWN',
                  rawStatus: 'parallel_timeout',
                  reason: `Provider ${name} exceeded parallel timeout of ${timeoutMs}ms`,
                  durationMs: timeoutMs,
                })
              ),
            timeoutMs
          )
        ),
      ]);
    } catch (err) {
      return instance.createNormalizedResult({
        mailboxStatus: 'UNKNOWN',
        rawStatus: 'execution_error',
        error: err.message,
      });
    }
  });

  const settled = await Promise.allSettled(tasks);
  return settled.map((s, idx) => {
    if (s.status === 'fulfilled') return s.value;
    return providers[idx].instance.createNormalizedResult({
      mailboxStatus: 'UNKNOWN',
      rawStatus: 'rejected_promise',
      error: s.reason?.message || 'Promise rejected',
    });
  });
}

/**
 * Evaluates consensus across all provider signals and local checks
 * using the Strict Decision Policy Matrix.
 *
 * @param {{
 *   providerResults: Array<object>,
 *   localSignals: {
 *     syntaxValid: boolean,
 *     domainValid: boolean,
 *     mxValid: boolean,
 *     isNullMx: boolean,
 *     isLocalDisposable: boolean,
 *     isRoleAccount?: boolean
 *   }
 * }} input
 * @returns {object} Normalized consensus output
 */
function evaluateConsensus({ providerResults = [], localSignals = {} }) {
  const {
    syntaxValid = true,
    domainValid = true,
    mxValid = true,
    isNullMx = false,
    isLocalDisposable = false,
    isRoleAccount: localRoleAccount = false,
  } = localSignals;

  // 1. HARD LOCAL BLOCKS
  if (!syntaxValid) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'SYNTAX_INVALID',
      formattedErrorMessage: 'Please provide a valid email address.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      confidence: 100,
      mailboxLikelyExists: false,
      disposable: false,
      catchAll: false,
      providerBreakdown: {},
    };
  }

  if (isNullMx) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'DNS_MX_INVALID',
      formattedErrorMessage: 'The email domain does not have valid mail servers. Please enter an active email address.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      confidence: 100,
      mailboxLikelyExists: false,
      disposable: false,
      catchAll: false,
      providerBreakdown: {},
    };
  }

  if (isLocalDisposable) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'DISPOSABLE',
      formattedErrorMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      confidence: 100,
      mailboxLikelyExists: false,
      disposable: true,
      catchAll: false,
      providerBreakdown: {},
    };
  }

  // 2. PARSE PROVIDER SIGNALS
  let disposableDetected = false;
  let spamTrapDetected = false;
  let toxicDetected = false;
  let abuseDetected = false;
  let catchAllDetected = false;
  let dnsInvalidDetected = false;
  let roleDetected = localRoleAccount;

  let validCount = 0;
  let invalidCount = 0;
  let notFoundCount = 0;
  let unknownCount = 0;

  const providerBreakdown = {};

  for (const res of providerResults) {
    providerBreakdown[res.provider] = res;

    if (res.isDisposable) disposableDetected = true;
    if (res.isSpamTrap) spamTrapDetected = true;
    if (res.isToxic) toxicDetected = true;
    if (res.isAbusive) abuseDetected = true;
    if (res.isCatchAll) catchAllDetected = true;
    if (res.isRoleAccount) roleDetected = true;

    if (
      res.rawStatus?.includes('no_dns_entries') ||
      res.reason?.includes('no_dns_entries') ||
      res.error?.includes('email_domain_invalid')
    ) {
      dnsInvalidDetected = true;
    }

    if (res.mailboxStatus === 'LIKELY_EXISTS') {
      validCount += 1;
    } else if (res.mailboxStatus === 'NOT_FOUND') {
      notFoundCount += 1;
      invalidCount += 1;
    } else if (res.mailboxStatus === 'INVALID') {
      invalidCount += 1;
    } else {
      unknownCount += 1;
    }
  }

  // 3. STRICT DECISION POLICY MATRIX

  // Rule 0: Provider-detected DNS/MX failure -> 🔴 IMMEDIATE BLOCK
  if (dnsInvalidDetected) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'DNS_MX_INVALID',
      formattedErrorMessage: 'The email domain does not have valid mail servers. Please enter an active email address.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      confidence: 98,
      mailboxLikelyExists: false,
      disposable: false,
      catchAll: catchAllDetected,
      providerBreakdown,
    };
  }

  // Rule 1: Disposable detected by ANY provider -> 🔴 IMMEDIATE BLOCK
  if (disposableDetected) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'DISPOSABLE',
      formattedErrorMessage: 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      confidence: 98,
      mailboxLikelyExists: false,
      disposable: true,
      catchAll: catchAllDetected,
      providerBreakdown,
    };
  }

  // Rule 2: Spam trap / toxic / abuse detected -> 🔴 IMMEDIATE BLOCK
  if (spamTrapDetected || toxicDetected || abuseDetected) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'SPAM_TRAP_TOXIC',
      formattedErrorMessage: 'Access Blocked: This email address cannot be registered due to security risk signals.',
      riskScore: 100,
      riskTier: 'CRITICAL',
      confidence: 98,
      mailboxLikelyExists: false,
      disposable: false,
      catchAll: catchAllDetected,
      providerBreakdown,
    };
  }

  // Rule 3: Mailbox not found by reliable provider or multiple invalid results -> 🔴 IMMEDIATE BLOCK
  if (notFoundCount >= 1 || invalidCount >= 2) {
    return {
      decision: 'BLOCK',
      rejectionCategory: 'MAILBOX_NOT_FOUND',
      formattedErrorMessage: 'This email address does not exist or cannot receive emails. Please provide an active, existing email address.',
      riskScore: 95,
      riskTier: 'CRITICAL',
      confidence: 95,
      mailboxLikelyExists: false,
      disposable: false,
      catchAll: catchAllDetected,
      providerBreakdown,
    };
  }

  // Rule 4: Catch-All domain -> 🟠 VERIFY ownership (Never activate account without verification)
  if (catchAllDetected) {
    return {
      decision: 'VERIFY',
      rejectionCategory: null,
      formattedErrorMessage: '',
      riskScore: 40,
      riskTier: 'MODERATE',
      confidence: 80,
      mailboxLikelyExists: validCount > 0,
      disposable: false,
      catchAll: true,
      providerBreakdown,
    };
  }

  // Rule 5: 3-4 providers valid, none risky -> 🟢 ALLOW TO VERIFICATION
  if (validCount >= 3) {
    return {
      decision: 'ALLOW_WITH_VERIFICATION',
      rejectionCategory: null,
      formattedErrorMessage: '',
      riskScore: 10,
      riskTier: 'LOW',
      confidence: 95,
      mailboxLikelyExists: true,
      disposable: false,
      catchAll: false,
      providerBreakdown,
    };
  }

  // Rule 6: 2 valid + 2 unknown -> 🟠 RISK / verification required
  if (validCount >= 2) {
    return {
      decision: 'VERIFY',
      rejectionCategory: null,
      formattedErrorMessage: '',
      riskScore: 30,
      riskTier: 'MODERATE',
      confidence: 85,
      mailboxLikelyExists: true,
      disposable: false,
      catchAll: false,
      providerBreakdown,
    };
  }

  // Rule 7: 1 valid + others unknown -> 🟠 HIGH RISK / strict verification
  if (validCount === 1) {
    return {
      decision: 'VERIFY',
      rejectionCategory: null,
      formattedErrorMessage: '',
      riskScore: 55,
      riskTier: 'ELEVATED',
      confidence: 70,
      mailboxLikelyExists: true,
      disposable: false,
      catchAll: false,
      providerBreakdown,
    };
  }

  // Rule 8: All providers unknown / rate limited / timeout
  return {
    decision: 'VERIFY',
    rejectionCategory: null,
    formattedErrorMessage: '',
    riskScore: 45,
    riskTier: 'ELEVATED',
    confidence: 60,
    mailboxLikelyExists: false,
    disposable: false,
    catchAll: false,
    providerBreakdown,
  };
}

module.exports = {
  executeParallelValidation,
  evaluateConsensus,
  providers: {
    zeroBounceProvider,
    kickboxProvider,
    sendGridProvider,
    briteVerifyProvider,
  },
};
