const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectUnit',
      required: true,
      // index defined at schema level below (partial unique index for confirmed bookings)
    },
    builder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    buyerName: {
      type: String,
      required: true,
      trim: true,
    },
    buyerPhone: {
      type: String,
      required: true,
      trim: true,
    },
    buyerEmail: {
      type: String,
      required: true,
      trim: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inquiry',
      default: null,
      index: true,
    },
    isAttributed: {
      type: Boolean,
      default: false,
    },
    basePrice: {
      type: Number,
      required: true,
    },
    agreementValue: {
      type: Number,
      required: true,
    },
    tokenAmount: {
      type: Number,
      default: 0,
    },
    tokenPaymentDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
      index: true,
    },
    commission: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      status: { type: String, enum: ['due', 'partial', 'paid', 'not_applicable'], default: 'not_applicable' },
      paidAt: { type: Date, default: null },
      transactionRef: { type: String, default: '' },
    },
    paymentDetails: {
      method: { type: String, default: '' },
      transactionRef: { type: String, default: '' },
      paidAt: { type: Date, default: null },
    },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

bookingSchema.index({ builder: 1, createdAt: -1 });
bookingSchema.index({ agent: 1, createdAt: -1 });
bookingSchema.index({ buyer: 1, createdAt: -1 });
bookingSchema.index({ unit: 1, status: 1 });
// Database-level double-booking prevention: only 1 confirmed booking per unit
bookingSchema.index(
  { unit: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

module.exports = mongoose.model('Booking', bookingSchema);
