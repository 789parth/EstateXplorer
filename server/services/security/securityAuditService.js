const crypto = require('crypto');
const SecurityAuditLog = require('../../models/SecurityAuditLog');

/**
 * Security Audit & Telemetry Service
 */
class SecurityAuditService {
  /**
   * Logs an audit record asynchronously.
   */
  async logEvent({
    correlationId = crypto.randomUUID(),
    eventType,
    emailHash,
    emailDomain,
    ip = '',
    userAgent = '',
    decision,
    reasonCode,
    riskScore = 0,
    confidence = 100,
    riskSignals = {},
    policyMode = 'NORMAL',
    policyVersion = 'registration-security-v2',
    latencyMs = 0,
    metadata = {},
  }) {
    const logPayload = {
      correlationId,
      eventType,
      emailHash: emailHash || 'unknown_hash',
      emailDomain: emailDomain || 'unknown_domain',
      ip,
      userAgent,
      decision,
      reasonCode,
      riskScore,
      confidence,
      riskSignals,
      policyMode,
      policyVersion,
      latencyMs,
      metadata,
      loggedAt: new Date(),
    };

    try {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) return logPayload;

      // Fire-and-forget database persistence
      SecurityAuditLog.create(logPayload).catch((err) => {
        console.warn('[SecurityAuditService] Failed to persist log:', err.message);
      });
    } catch (e) {
      // Do not block auth on telemetry failure
    }

    return logPayload;
  }

  /**
   * Aggregates telemetry stats for Admin Security Console.
   */
  async getMetrics(timeframeHours = 24) {
    try {
      const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);

      const [totalCount, blockedCount, allowedCount, disposableCount, topDomains, avgStats] =
        await Promise.all([
          SecurityAuditLog.countDocuments({ createdAt: { $gte: since } }),
          SecurityAuditLog.countDocuments({ createdAt: { $gte: since }, decision: 'BLOCK' }),
          SecurityAuditLog.countDocuments({
            createdAt: { $gte: since },
            decision: { $in: ['ALLOW', 'ALLOW_WITH_VERIFICATION'] },
          }),
          SecurityAuditLog.countDocuments({
            createdAt: { $gte: since },
            reasonCode: 'DISPOSABLE_DOMAIN',
          }),
          SecurityAuditLog.aggregate([
            { $match: { createdAt: { $gte: since }, decision: 'BLOCK' } },
            { $group: { _id: '$emailDomain', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ]),
          SecurityAuditLog.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
              $group: {
                _id: null,
                avgRiskScore: { $avg: '$riskScore' },
                avgLatencyMs: { $avg: '$latencyMs' },
              },
            },
          ]),
        ]);

      return {
        timeframeHours,
        totalEvaluations: totalCount,
        allowedCount,
        blockedCount,
        disposableBlockedCount: disposableCount,
        challengeCount: totalCount - (allowedCount + blockedCount),
        topBlockedDomains: topDomains.map((d) => ({ domain: d._id, count: d.count })),
        avgRiskScore: avgStats[0] ? Math.round(avgStats[0].avgRiskScore || 0) : 0,
        avgLatencyMs: avgStats[0] ? Math.round(avgStats[0].avgLatencyMs || 0) : 0,
      };
    } catch (err) {
      console.warn('[SecurityAuditService] Metrics retrieval fallback:', err.message);
      return {
        timeframeHours,
        totalEvaluations: 0,
        allowedCount: 0,
        blockedCount: 0,
        disposableBlockedCount: 0,
        challengeCount: 0,
        topBlockedDomains: [],
        avgRiskScore: 0,
        avgLatencyMs: 0,
      };
    }
  }

  /**
   * Search audit logs with pagination and filters.
   */
  async searchLogs({
    decision,
    reasonCode,
    emailDomain,
    correlationId,
    limit = 50,
    skip = 0,
  }) {
    const filter = {};
    if (decision) filter.decision = decision;
    if (reasonCode) filter.reasonCode = reasonCode;
    if (emailDomain) filter.emailDomain = emailDomain.toLowerCase().trim();
    if (correlationId) filter.correlationId = correlationId;

    const [logs, total] = await Promise.all([
      SecurityAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SecurityAuditLog.countDocuments(filter),
    ]);

    return { logs, total, limit, skip };
  }
}

module.exports = new SecurityAuditService();
