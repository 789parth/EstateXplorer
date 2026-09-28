const mongoose = require('mongoose');

const projectUnitSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Project reference is required'],
      index: true,
    },
    builder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Builder reference is required'],
      index: true,
    },
    unitNumber: {
      type: String,
      required: [true, 'Unit number is required (e.g. A-101, Villa-4)'],
      trim: true,
    },
    tower: {
      type: String,
      trim: true,
      default: 'Tower 1',
    },
    floor: {
      type: Number,
      default: 1,
    },
    bhk: {
      type: Number,
      required: true,
      default: 2,
    },
    carpetArea: {
      type: Number, // sq ft
      default: 0,
    },
    superBuiltUpArea: {
      type: Number, // sq ft
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    priceDisplay: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'booked'],
      default: 'available',
      index: true,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bookedByAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// Concurrency & uniqueness: One unit number per tower in a project
projectUnitSchema.index({ project: 1, tower: 1, unitNumber: 1 }, { unique: true });
projectUnitSchema.index({ project: 1, status: 1 });
projectUnitSchema.index({ builder: 1, status: 1 });

module.exports = mongoose.model('ProjectUnit', projectUnitSchema);
