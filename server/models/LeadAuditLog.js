const mongoose = require('mongoose');

const leadAuditLogSchema = new mongoose.Schema(
  {
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inquiry',
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true, // e.g., 'STATUS_TRANSITION', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_DONE', 'TOKEN_PAID', 'UNIT_BOOKED'
      index: true,
    },
    previousStage: {
      type: String,
      default: '',
    },
    newStage: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

leadAuditLogSchema.index({ lead: 1, createdAt: -1 });

module.exports = mongoose.model('LeadAuditLog', leadAuditLogSchema);
