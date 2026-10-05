const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a property title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    type: {
      type: String,
      required: [true, 'Please specify the property type'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please specify if this is a project or individual property'],
      enum: ['project', 'property'],
      default: 'property',
    },
    purpose: {
      type: String,
      enum: ['buy', 'rent'],
      default: 'buy',
    },
    price: {
      type: Number,
      required: [true, 'Please add the base price'],
      min: [0, 'Price must be greater than or equal to 0 (no negative values allowed)'],
    },
    priceDisplay: {
      type: String, // e.g. "₹ 25.51 L", "₹ 1.11 Cr"
      required: [true, 'Please add a display price'],
    },
    priceSub: {
      type: String, // e.g. "₹ 4,200 / Sq.Ft · 607 sq.ft"
    },
    bhk: {
      type: Number, // 1, 2, 3, 4, etc.
      min: [0, 'BHK must be greater than or equal to 0 (no negative values allowed)'],
    },
    area: {
      type: Number, // square feet
      min: [0, 'Area must be greater than or equal to 0 (no negative values allowed)'],
    },
    location: {
      city: {
        type: String,
        required: [true, 'Please add a city'],
      },
      address: {
        type: String,
        required: [true, 'Please add full address/locality'],
      },
    },
    status: {
      type: String,
      enum: ['uc', 'ready', 'upcoming'],
      default: 'ready',
    },
    statusLabel: {
      type: String, // e.g. 'Under Construction', 'Ready To Move'
    },
    statusDate: {
      type: String, // e.g. 'Possession: Mar 2028'
    },
    amenities: {
      type: [String],
    },
    usps: {
      type: [String],
    },
    images: {
      type: [String],
      required: [true, 'Please add at least one image'],
    },
    reraId: {
      type: String,
    },
    rera: {
      type: Boolean,
      default: false,
    },
    builder: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    sold: { type: Number, default: 0, min: [0, 'Sold count cannot be negative'] },
    enquiries: { type: Number, default: 0, min: [0, 'Enquiries count cannot be negative'] },
    visits: { type: Number, default: 0, min: [0, 'Visits count cannot be negative'] },
    // Agent Acquisition Configuration
    allowAgentAcquisition: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Enterprise Channel Partner Network Configuration (synchronized)
    networkEnabled: {
      type: Boolean,
      default: false,
    },
    defaultCommissionRate: {
      type: Number,
      default: 2.5, // Standard industry 2.5% default commission
      min: [0, 'Commission rate cannot be negative'],
      max: [20, 'Commission rate cannot exceed 20%'],
    },
    towers: [{
      towerName: { type: String, required: true },
      floorsCount: { type: Number, default: 1 },
      unitsPerFloor: { type: Number, default: 4 },
    }],
    totalUnitsCount: {
      type: Number,
      default: 0,
      min: [0, 'Total units cannot be negative'],
    },
    availableUnitsCount: {
      type: Number,
      default: 0,
      min: [0, 'Available units cannot be negative'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual alias 'user' pointing to 'builder' (seller)
propertySchema.virtual('user').get(function () {
  return this.builder;
});

// Synchronize allowAgentAcquisition with legacy networkEnabled
propertySchema.pre('save', function (next) {
  if (this.isModified('allowAgentAcquisition')) {
    this.networkEnabled = Boolean(this.allowAgentAcquisition);
  } else if (this.isModified('networkEnabled')) {
    this.allowAgentAcquisition = Boolean(this.networkEnabled);
  }
  next();
});

propertySchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update) {
    if (update.allowAgentAcquisition !== undefined) {
      update.networkEnabled = Boolean(update.allowAgentAcquisition);
    } else if (update.networkEnabled !== undefined) {
      update.allowAgentAcquisition = Boolean(update.networkEnabled);
    }
  }
  next();
});

// High-performance compound & single query indexes for extreme search & sorting speed
propertySchema.index({ isActive: 1, createdAt: -1 });
propertySchema.index({ isActive: 1, category: 1, createdAt: -1 });
propertySchema.index({ allowAgentAcquisition: 1, category: 1, isActive: 1 });
propertySchema.index({ isActive: 1, isFeatured: 1, category: 1 });
propertySchema.index({ builder: 1, isActive: 1, createdAt: -1 });
propertySchema.index({ 'location.city': 1, isActive: 1 });
propertySchema.index({ price: 1, isActive: 1 });
propertySchema.index({ type: 1, isActive: 1 });
propertySchema.index({ bhk: 1, isActive: 1 });
propertySchema.index({ status: 1, isActive: 1 });
propertySchema.index({ purpose: 1, isActive: 1 });

module.exports = mongoose.model('Property', propertySchema);
