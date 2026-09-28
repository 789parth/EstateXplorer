/**
 * Registration Risk Engine
 * 
 * Aggregates multi-source intelligence signals:
 * - EMAIL_RISK
 * - DOMAIN_RISK
 * - BOT_RISK
 * - VELOCITY_RISK
 * - IP_RISK
 * - HISTORICAL_ABUSE_RISK
 * 
 * Computes composite score from 0 (safest) to 100 (critical risk).
 */

class RegistrationRiskEngine {
  /**
   * Calculates composite risk score and risk tier.
   *
   * @param {{
   *   emailSignals: object,
   *   domainSignals: object,
   *   botSignals: object,
   *   velocitySignals: object,
   *   listSignals: object,
   *   ipSignals: object,
   *   configThresholds?: object
   * }} context
   * @returns {{
   *   compositeScore: number,
   *   riskTier: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL',
   *   breakdown: object,
   *   criticalFlags: string[]
   * }}
   */
  evaluate({
    emailSignals = {},
    domainSignals = {},
    botSignals = {},
    velocitySignals = {},
    listSignals = {},
    ipSignals = {},
    configThresholds = { lowMax: 19, moderateMax: 39, elevatedMax: 59, highMax: 79 },
  }) {
    const criticalFlags = [];
    let emailRiskScore = 0;
    let domainRiskScore = 0;
    let botRiskScore = botSignals.botRisk || 0;
    let velocityRiskScore = velocitySignals.velocityRisk || 0;
    let ipRiskScore = ipSignals.ipRisk || 0;

    // 1. Evaluate Email Risk
    if (emailSignals.isDisposable || emailSignals.isTemporary) {
      emailRiskScore = 100;
      criticalFlags.push('HIGH_CONFIDENCE_DISPOSABLE_EMAIL');
    } else if (emailSignals.isDomainRisky) {
      emailRiskScore = Math.max(emailRiskScore, 65);
    }

    if (emailSignals.isRoleAccount) {
      // Role accounts contribute mild risk adjustment (e.g. +15), but NEVER block alone
      emailRiskScore = Math.min(100, emailRiskScore + 15);
    }

    // 2. Evaluate Domain / DNS Risk
    if (domainSignals.isNullMx) {
      domainRiskScore = 100;
      criticalFlags.push('NULL_MX_DOMAIN_REJECTS_EMAIL');
    } else if (!domainSignals.dnsValid && !domainSignals.hasMx && !domainSignals.hasAddressFallback) {
      // Contributes moderate risk, but does NOT blindly block per RFC 5321 & enterprise requirements
      domainRiskScore = 35;
    } else if (domainSignals.hasAddressFallback && !domainSignals.hasMx) {
      // RFC 5321 fallback is valid, but slightly less common for primary consumer mail
      domainRiskScore = 20;
    }

    // 3. Evaluate List Signals
    if (listSignals.isBlocklisted) {
      criticalFlags.push('EXPLICIT_SECURITY_BLOCKLIST_MATCH');
    }
    if (listSignals.isWatchlisted) {
      domainRiskScore = Math.max(domainRiskScore, 45);
    }

    // 4. Evaluate Bot Signals
    if (botSignals.isBot) {
      criticalFlags.push('BOT_AUTOMATION_DETECTED');
    }

    // 5. Evaluate Velocity Signals
    if (velocitySignals.isRateLimited) {
      criticalFlags.push('REGISTRATION_VELOCITY_LIMIT_EXCEEDED');
    }

    // 6. Weighted Composite Scoring
    // Weights: Email Risk (40%), Domain Risk (25%), Bot Risk (20%), Velocity (15%)
    let composite =
      emailRiskScore * 0.40 +
      domainRiskScore * 0.25 +
      botRiskScore * 0.20 +
      velocityRiskScore * 0.15;

    // Any critical flag automatically pins score to CRITICAL (>= 85)
    if (criticalFlags.length > 0) {
      composite = Math.max(composite, 90);
    }

    // If domain is confirmed allowlisted (e.g. Gmail, Outlook) and no bot flags, clamp score to LOW
    if (listSignals.isAllowlisted && criticalFlags.length === 0) {
      composite = Math.min(composite, 10);
    }

    const compositeScore = Math.round(Math.min(100, Math.max(0, composite)));

    // 7. Determine Risk Tier
    let riskTier = 'LOW';
    if (compositeScore > configThresholds.highMax) riskTier = 'CRITICAL';
    else if (compositeScore > configThresholds.elevatedMax) riskTier = 'HIGH';
    else if (compositeScore > configThresholds.moderateMax) riskTier = 'ELEVATED';
    else if (compositeScore > configThresholds.lowMax) riskTier = 'MODERATE';

    return {
      compositeScore,
      riskTier,
      breakdown: {
        emailRiskScore,
        domainRiskScore,
        botRiskScore,
        velocityRiskScore,
        ipRiskScore,
      },
      criticalFlags,
    };
  }
}

module.exports = new RegistrationRiskEngine();
