const mongoose = require('mongoose');

const domainReputationSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    classification: {
      type: String,
      required: true,
      enum: [
        'LEGITIMATE',
        'FREE_PROVIDER',
        'DISPOSABLE',
        'TEMPORARY',
        'SUSPICIOUS',
        'MALICIOUS',
        'UNKNOWN',
      ],
      default: 'UNKNOWN',
      index: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 80,
    },
    source: {
      type: String,
      required: true,
      default: 'local_dataset',
      index: true,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isDisposable: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    isAllowed: {
      type: Boolean,
      default: false,
      index: true,
    },
    mxHostnames: {
      type: [String],
      default: [],
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// High-speed compound indexes
domainReputationSchema.index({ domain: 1, classification: 1 });
domainReputationSchema.index({ isDisposable: 1, updatedAt: -1 });
domainReputationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL auto-eviction

module.exports = mongoose.model('DomainReputation', domainReputationSchema);
