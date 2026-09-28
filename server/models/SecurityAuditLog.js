const mongoose = require('mongoose');

const securityAuditLogSchema = new mongoose.Schema(
  {
    correlationId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'REGISTRATION_ATTEMPT',
        'EMAIL_RISK_CHECKED',
        'DISPOSABLE_EMAIL_DETECTED',
        'DNS_CHECK_FAILED',
        'BOT_CHALLENGE_REQUIRED',
        'RATE_LIMIT_TRIGGERED',
        'REGISTRATION_BLOCKED',
        'REGISTRATION_ALLOWED',
        'VERIFICATION_SENT',
        'VERIFICATION_FAILED',
        'VERIFICATION_COMPLETED',
        'RISK_ESCALATED',
        'ADMIN_OVERRIDE',
      ],
      index: true,
    },
    emailHash: {
      type: String,
      required: true,
      index: true,
    },
    emailDomain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      default: '',
      index: true,
    },
    userAgent: {
      type: String,
      default: '',
    },
    decision: {
      type: String,
      required: true,
      enum: ['ALLOW', 'ALLOW_WITH_VERIFICATION', 'STEP_UP_CHALLENGE', 'TEMPORARY_REVIEW', 'BLOCK'],
      index: true,
    },
    reasonCode: {
      type: String,
      required: true,
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    confidence: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    riskSignals: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    policyMode: {
      type: String,
      default: 'NORMAL',
    },
    policyVersion: {
      type: String,
      default: 'registration-security-v2',
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// High-speed compound queries for admin investigation & metrics
securityAuditLogSchema.index({ createdAt: -1 });
securityAuditLogSchema.index({ decision: 1, createdAt: -1 });
securityAuditLogSchema.index({ eventType: 1, createdAt: -1 });
securityAuditLogSchema.index({ emailDomain: 1, createdAt: -1 });
securityAuditLogSchema.index({ ip: 1, createdAt: -1 });

// Automatic GDPR data retention cleanup after 90 days (7,776,000 seconds)
securityAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('SecurityAuditLog', securityAuditLogSchema);
