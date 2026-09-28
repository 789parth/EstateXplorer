const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    recipientPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    recipientName: {
      type: String,
      default: '',
      trim: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'whatsapp', 'email'],
      default: 'sms',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'LEAD_ALERT',
        'SITE_VISIT_BOOKED',
        'SITE_VISIT_RESCHEDULED',
        'SITE_VISIT_CONFIRMED',
        'STATUS_UPDATE',
        'TEST_ALERT',
      ],
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    gateway: {
      type: String,
      default: 'fast2sms',
    },
    gatewayMessageId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['QUEUED', 'DELIVERED', 'FAILED', 'SIMULATED'],
      default: 'DELIVERED',
      index: true,
    },
    errorDetails: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationLogSchema.index({ recipientPhone: 1, createdAt: -1 });
notificationLogSchema.index({ recipient: 1, createdAt: -1 });
notificationLogSchema.index({ status: 1, createdAt: -1 });

// Automatic GDPR data retention cleanup after 90 days
notificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
