const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  code: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['email_verify', 'password_reset', 'two_factor', 'phone_verify'],
    default: 'password_reset',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // NOTE: TTL is controlled by the expiresAt index below — do NOT add `expires` here
  },
});

// Auto-delete OTP documents at exactly their expiry time (variable per purpose)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Query index for fast lookups
otpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('OTP', otpSchema);

