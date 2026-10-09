const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/,
        'Please add a valid email',
      ],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    about: {
      type: String,
      trim: true,
      default: '',
    },
    password: {
      type: String,
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    role: {
      type: String,
      enum: ['buyer', 'owner', 'builder', 'agent', 'admin'],
      default: 'buyer',
    },
    roles: {
      type: [String],
      enum: ['buyer', 'owner', 'builder', 'agent', 'admin'],
      default: ['buyer', 'builder', 'agent', 'owner'],
    },
    avatar: {
      type: String,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedReason: {
      type: String,
      default: '',
    },
    wishlist: {
      type: [String],
      default: [],
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    smsNotifications: {
      type: Boolean,
      default: false,
    },
    builderProfile: {
      companyName: { type: String, default: '' },
      displayName: { type: String, default: '' },
      yearEstablished: { type: String, default: '' },
      experience: { type: Number, default: 0 },
      totalProjects: { type: Number, default: 0 },
      tagline: { type: String, default: '' },
      state: { type: String, default: '' },
      address: { type: String, default: '' },
      website: { type: String, default: '' },
      cin: { type: String, default: '' },
      reraId: { type: String, default: '' },
      reraState: { type: String, default: '' },
      gst: { type: String, default: '' },
      pan: { type: String, default: '' },
      contactPerson: { type: String, default: '' },
      designation: { type: String, default: '' },
      alternatePhone: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      headOffice: { type: String, default: '' },
      salesOfficeDelhi: { type: String, default: '' },
      salesOfficeMumbai: { type: String, default: '' },
      documents: [
        {
          name: { type: String, default: '' },
          url: { type: String, default: '' },
          type: { type: String, default: 'PDF' },
          size: { type: String, default: '' },
          status: { type: String, enum: ['verified', 'pending', 'rejected'], default: 'verified' },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      team: [
        {
          name: { type: String, default: '' },
          email: { type: String, default: '' },
          role: { type: String, enum: ['Owner', 'Editor', 'Viewer'], default: 'Editor' },
          designation: { type: String, default: '' },
          addedAt: { type: Date, default: Date.now },
        },
      ],
    },
    agentProfile: {
      licenseId: { type: String, default: '' },
      agencyName: { type: String, default: '' },
      experienceYears: { type: String, default: '' },
      cityCovered: { type: String, default: '' },
      specialization: { type: String, default: '' },
      reraLicense: { type: String, default: '' },
    },
    ownerProfile: {
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      preferredContactTime: { type: String, default: 'Anytime' },
    },
    kycVerification: {
      status: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified',
        index: true,
      },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rejectionReason: { type: String, default: '' },
      roleAtSubmission: { type: String, enum: ['builder', 'agent', 'owner'], default: 'builder' },
      aadharCard: {
        number: { type: String, default: '' },
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
      },
      panCard: {
        number: { type: String, default: '' },
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
      },
      companyDoc: {
        number: { type: String, default: '' },
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
      },
      agencyDoc: {
        number: { type: String, default: '' },
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
      },
    },
    // Role-specific independent document verifications (Builder, Agent, Owner)
    roleKycVerification: {
      builder: {
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified', index: true },
        submittedAt: { type: Date },
        reviewedAt: { type: Date },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: { type: String, default: '' },
        aadharCard: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
        panCard: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
        companyDoc: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
      },
      agent: {
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified', index: true },
        submittedAt: { type: Date },
        reviewedAt: { type: Date },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: { type: String, default: '' },
        aadharCard: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
        panCard: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
        agencyDoc: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
      },
      owner: {
        status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified', index: true },
        submittedAt: { type: Date },
        reviewedAt: { type: Date },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: { type: String, default: '' },
        aadharCard: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
        panCard: { number: { type: String, default: '' }, url: { type: String, default: '' }, name: { type: String, default: '' }, status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' } },
      },
    },
  },
  { timestamps: true }
);

// Ensure roles array contains standard portal roles by default
userSchema.pre('save', async function (next) {
  if (!this.roles || !Array.isArray(this.roles) || this.roles.length === 0) {
    this.roles = ['buyer', 'builder', 'agent', 'owner'];
  }

  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Query indexes
userSchema.index({ role: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('User', userSchema);
