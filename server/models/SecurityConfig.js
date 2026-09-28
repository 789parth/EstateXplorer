const mongoose = require('mongoose');

const securityConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default_security_policy',
      unique: true,
      index: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ['NORMAL', 'STRICT', 'LOCKDOWN'],
      default: 'NORMAL',
    },
    riskThresholds: {
      lowMax: { type: Number, default: 19 },
      moderateMax: { type: Number, default: 39 },
      elevatedMax: { type: Number, default: 59 },
      highMax: { type: Number, default: 79 },
    },
    botProtectionEnabled: {
      type: Boolean,
      default: true,
    },
    dnsValidationEnabled: {
      type: Boolean,
      default: true,
    },
    externalProvidersEnabled: {
      type: Boolean,
      default: true,
    },
    failMode: {
      type: String,
      enum: ['allow', 'block'],
      default: 'allow',
    },
    policyVersion: {
      type: String,
      default: 'registration-security-v2',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SecurityConfig', securityConfigSchema);
