const mongoose = require('mongoose');

const partnershipSchema = new mongoose.Schema(
  {
    builder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Builder reference is required'],
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Agent reference is required'],
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Project reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    agentCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    affiliateUrl: {
      type: String,
      default: '',
    },
    commissionRate: {
      type: Number,
      default: 2.0, // default 2%
      min: [0, 'Commission rate cannot be negative'],
      max: [50, 'Commission rate cannot exceed 50%'],
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    proposedCommission: {
      type: Number,
      default: 2.0,
    },
    licenseInfo: {
      type: String,
      trim: true,
      default: '',
    },
    submittedDocuments: {
      type: [String],
      default: [],
    },
    proposalNotes: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    // Metrics for this specific agent-project partnership
    metrics: {
      clicks: { type: Number, default: 0 },
      uniqueVisitors: { type: Number, default: 0 },
      inquiries: { type: Number, default: 0 },
      siteVisits: { type: Number, default: 0 },
      bookings: { type: Number, default: 0 },
      totalCommissionEarned: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// One agent can have only ONE partnership record per project
partnershipSchema.index({ agent: 1, project: 1 }, { unique: true });
partnershipSchema.index({ builder: 1, status: 1 });
partnershipSchema.index({ agent: 1, status: 1 });
partnershipSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model('Partnership', partnershipSchema);
