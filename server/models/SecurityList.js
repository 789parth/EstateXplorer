const mongoose = require('mongoose');

const securityListSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['ALLOWLIST', 'BLOCKLIST', 'WATCHLIST', 'HIGH_RISK_LIST'],
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ['domain', 'email_hash', 'ip', 'subnet'],
      index: true,
    },
    value: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring no duplicate active entries per list & target
securityListSchema.index({ type: 1, targetType: 1, value: 1 }, { unique: true });
securityListSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('SecurityList', securityListSchema);
