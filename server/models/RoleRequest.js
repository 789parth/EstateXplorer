const mongoose = require('mongoose');

const roleRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    currentRole: {
      type: String,
      enum: ['buyer', 'builder', 'agent', 'admin', 'owner'],
      required: [true, 'Current role is required'],
    },
    requestedRole: {
      type: String,
      enum: ['buyer', 'builder', 'agent', 'admin', 'owner'],
      required: [true, 'Requested role is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound index for efficient duplicate checking and querying
roleRequestSchema.index({ userId: 1, requestedRole: 1, status: 1 });
roleRequestSchema.index({ email: 1, status: 1 });
roleRequestSchema.index({ status: 1, requestedAt: -1 });
roleRequestSchema.index({ requestedAt: -1 });

module.exports = mongoose.model('RoleRequest', roleRequestSchema);
