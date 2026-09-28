const mongoose = require('mongoose');

const attributionSchema = new mongoose.Schema(
  {
    fingerprint: {
      type: String,
      required: [true, 'Attribution fingerprint is required'],
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Attributed Agent is required'],
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Project is required'],
      index: true,
    },
    agentCode: {
      type: String,
      required: true,
      index: true,
    },
    firstTouchAt: {
      type: Date,
      default: Date.now,
      immutable: true, // FIRST TOUCH CANNOT BE ALTERED
    },
    lastTouchAt: {
      type: Date,
      default: Date.now,
    },
    clicksCount: {
      type: Number,
      default: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// STRICT FIRST-TOUCH CONSTRAINT:
// Only 1 active attribution record per (fingerprint, project)
attributionSchema.index({ fingerprint: 1, project: 1 }, { unique: true });
attributionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Automatic cleanup after expiry

module.exports = mongoose.model('Attribution', attributionSchema);
