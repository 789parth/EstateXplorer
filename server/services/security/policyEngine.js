/**
 * Enterprise Adaptive Security Policy Engine
 * 
 * Supports 3 Operating Modes:
 * - NORMAL: Standard balanced protection. High confidence disposable/abuse blocked. Moderate risk allowed with verification.
 * - STRICT: Heightened defenses. Moderate/elevated risk requires step-up challenge. Lower threshold for blocks.
 * - LOCKDOWN: Emergency state. Only explicit allowlisted domains or ultra-low risk registrations permitted.
 */

const PUBLIC_SECURITY_ERROR_MESSAGE =
  'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.';

const RATE_LIMIT_MESSAGE =
  'Too many registration attempts detected from your network. Please try again in a few minutes.';

const BOT_CHALLENGE_MESSAGE =
  'Additional security verification is required to complete registration.';

class PolicyEngine {
  /**
   * Generates a final registration decision based on risk and policy mode.
   *
   * @param {{
   *   compositeScore: number,
   *   riskTier: string,
   *   criticalFlags: string[],
   *   mode?: 'NORMAL' | 'STRICT' | 'LOCKDOWN',
   *   isAllowlisted?: boolean,
   *   botSignals?: object,
   *   velocitySignals?: object,
   *   emailSignals?: object
   * }} context
   * @returns {{
   *   decision: 'ALLOW' | 'ALLOW_WITH_VERIFICATION' | 'STEP_UP_CHALLENGE' | 'TEMPORARY_REVIEW' | 'BLOCK',
   *   reasonCode: string,
   *   publicMessage: string,
   *   requiresVerification: boolean,
   *   requiresChallenge: boolean
   * }}
   */
  decide({
    compositeScore,
    riskTier,
    criticalFlags = [],
    mode = 'NORMAL',
    isAllowlisted = false,
    botSignals = {},
    velocitySignals = {},
    emailSignals = {},
  }) {
    // 1. Fast path for allowlisted domains (e.g. gmail, outlook)
    if (isAllowlisted && criticalFlags.length === 0) {
      return {
        decision: 'ALLOW_WITH_VERIFICATION',
        reasonCode: 'ALLOWLIST_APPROVED',
        publicMessage: '',
        requiresVerification: true,
        requiresChallenge: false,
      };
    }

    // 2. High-confidence Disposable Email check -> Immediate BLOCK
    if (
      criticalFlags.includes('HIGH_CONFIDENCE_DISPOSABLE_EMAIL') ||
      emailSignals.isDisposable ||
      emailSignals.isTemporary
    ) {
      return {
        decision: 'BLOCK',
        reasonCode: 'DISPOSABLE_DOMAIN',
        publicMessage: PUBLIC_SECURITY_ERROR_MESSAGE,
        requiresVerification: false,
        requiresChallenge: false,
      };
    }

    // 3. Explicit Blocklist match -> Immediate BLOCK
    if (criticalFlags.includes('EXPLICIT_SECURITY_BLOCKLIST_MATCH')) {
      return {
        decision: 'BLOCK',
        reasonCode: 'POLICY_BLOCK',
        publicMessage: PUBLIC_SECURITY_ERROR_MESSAGE,
        requiresVerification: false,
        requiresChallenge: false,
      };
    }

    // 4. Null MX (domain explicitly rejects all incoming mail) -> BLOCK
    if (criticalFlags.includes('NULL_MX_DOMAIN_REJECTS_EMAIL')) {
      return {
        decision: 'BLOCK',
        reasonCode: 'DNS_VALIDATION_FAILED',
        publicMessage: PUBLIC_SECURITY_ERROR_MESSAGE,
        requiresVerification: false,
        requiresChallenge: false,
      };
    }

    // 5. Bot & Automation Signals
    if (botSignals.isBot || criticalFlags.includes('BOT_AUTOMATION_DETECTED')) {
      return {
        decision: 'STEP_UP_CHALLENGE',
        reasonCode: 'BOT_RISK',
        publicMessage: BOT_CHALLENGE_MESSAGE,
        requiresVerification: true,
        requiresChallenge: true,
      };
    }

    // 6. Velocity / Rate Limit Limit Exceeded
    if (velocitySignals.isRateLimited || criticalFlags.includes('REGISTRATION_VELOCITY_LIMIT_EXCEEDED')) {
      return {
        decision: 'TEMPORARY_REVIEW',
        reasonCode: 'REGISTRATION_VELOCITY',
        publicMessage: RATE_LIMIT_MESSAGE,
        requiresVerification: true,
        requiresChallenge: false,
      };
    }

    // 7. Policy Mode Specific Threshold Evaluation
    switch (mode) {
      case 'LOCKDOWN':
        // Only allow score < 20 or allowlisted
        if (compositeScore >= 20) {
          return {
            decision: 'BLOCK',
            reasonCode: 'LOCKDOWN_RESTRICTION',
            publicMessage: 'Platform registrations are temporarily restricted to verified partners.',
            requiresVerification: false,
            requiresChallenge: false,
          };
        }
        break;

      case 'STRICT':
        if (compositeScore >= 60) {
          return {
            decision: 'BLOCK',
            reasonCode: 'STRICT_POLICY_HIGH_RISK',
            publicMessage: PUBLIC_SECURITY_ERROR_MESSAGE,
            requiresVerification: false,
            requiresChallenge: false,
          };
        }
        if (compositeScore >= 35) {
          return {
            decision: 'STEP_UP_CHALLENGE',
            reasonCode: 'STRICT_POLICY_CHALLENGE',
            publicMessage: BOT_CHALLENGE_MESSAGE,
            requiresVerification: true,
            requiresChallenge: true,
          };
        }
        break;

      case 'NORMAL':
      default:
        if (compositeScore >= 80) {
          return {
            decision: 'BLOCK',
            reasonCode: 'CRITICAL_RISK_SCORE',
            publicMessage: PUBLIC_SECURITY_ERROR_MESSAGE,
            requiresVerification: false,
            requiresChallenge: false,
          };
        }
        if (compositeScore >= 60) {
          return {
            decision: 'STEP_UP_CHALLENGE',
            reasonCode: 'ELEVATED_RISK_CHALLENGE',
            publicMessage: BOT_CHALLENGE_MESSAGE,
            requiresVerification: true,
            requiresChallenge: true,
          };
        }
        break;
    }

    // Normal legitimate user flow: ALLOW with standard email verification
    return {
      decision: 'ALLOW_WITH_VERIFICATION',
      reasonCode: 'RISK_SCORE_ACCEPTABLE',
      publicMessage: '',
      requiresVerification: true,
      requiresChallenge: false,
    };
  }
}

module.exports = new PolicyEngine();
