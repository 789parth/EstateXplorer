const mongoose = require('mongoose');
const { ATTRIBUTION_WINDOW_MS } = require('../config/attribution');

const inquirySchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'Property',
      required: false,
    },
    propertyTitle: {
      type: String,
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    projectName: {
      type: String,
      default: '',
    },
    propertyType: {
      type: String,
      default: '',
    },
    propertyLocation: {
      type: String,
      default: '',
    },
    propertyImage: {
      type: String,
      default: '',
    },
    builder: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: false,
    },
    builderName: {
      type: String,
      default: '',
    },
    // Sender info (may or may not be a registered user)
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    // 'new' | 'contacted' | 'visit' | 'closed' | 'expired' | 'rejected'
    status: {
      type: String,
      enum: ['new', 'contacted', 'visit', 'closed', 'expired', 'rejected'],
      default: 'new',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    visitRequested: {
      type: Boolean,
      default: false,
    },
    visitDate: {
      type: String,
      default: '',
    },
    visitTime: {
      type: String,
      default: '',
    },
    // Channel Partner & Attribution Engine fields
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    agentCode: {
      type: String,
      default: '',
    },
    isAttributed: {
      type: Boolean,
      default: false,
    },
    attributionExpiry: {
      type: Date,
      default: null,
    },
    lifecycleStage: {
      type: String,
      enum: [
        'new',
        'contacted',
        'qualified',
        'site_visit_scheduled',
        'site_visit_done',
        'token_paid',
        'unit_booked',
        'commission_due',
        'commission_paid',
        'closed',
        'rejected',
      ],
      default: 'new',
    },
    tokenAmount: {
      type: Number,
      default: 0,
    },
    tokenDate: {
      type: Date,
      default: null,
    },
    bookedUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectUnit',
      default: null,
    },
    bookingRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + ATTRIBUTION_WINDOW_MS),
    },
  },
  { timestamps: true }
);

// Query indexes
inquirySchema.index({ builder: 1, createdAt: -1 });
inquirySchema.index({ agent: 1, createdAt: -1 });
inquirySchema.index({ property: 1, createdAt: -1 });
inquirySchema.index({ user: 1, createdAt: -1 });
inquirySchema.index({ email: 1, createdAt: -1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ lifecycleStage: 1 });
inquirySchema.index({ isAttributed: 1 });
inquirySchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Inquiry', inquirySchema);
