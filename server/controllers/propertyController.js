const mongoose = require('mongoose');
const Property = require('../models/Property');
const Inquiry = require('../models/Inquiry');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { memoryCache } = require('../utils/cache');
const {
  normalizeTitleCase,
  normalizePriceDisplay,
  normalizeCode,
} = require('../utils/formatters');
const { isDisposableEmail, normalizeEmail } = require('../services/disposableEmailService');
const {
  notifySellerOnNewLead,
  notifyBuyerOnStatusChange,
} = require('../services/smsNotificationService');
const {
  notifySellerOnNewLeadEmail,
  notifyBuyerOnInquiryConfirmationEmail,
  notifyBuyerOnStatusChangeEmail,
} = require('../services/notificationEmailService');
const { resolveAttribution } = require('../services/attributionEngine');
const { projectLeadsForUser, projectLeadForUser, maskPhone, maskEmail } = require('../services/leadPrivacyService');
const LeadAuditLog = require('../models/LeadAuditLog');
const { emitToUser, emitToUsers, SOCKET_EVENTS } = require('../services/socketManager');

/**
 * LIFECYCLE STATE MACHINE — Spec §48
 * Defines valid forward transitions for the lead CRM pipeline.
 * Backend rejects any transition not listed here.
 * 
 * Rule: Admin can perform any transition. Builder & Agent are restricted.
 */
const VALID_LIFECYCLE_TRANSITIONS = {
  new: ['contacted', 'qualified', 'site_visit_scheduled', 'closed'],
  contacted: ['qualified', 'site_visit_scheduled', 'closed'],
  qualified: ['site_visit_scheduled', 'closed'],
  site_visit_scheduled: ['site_visit_done', 'qualified', 'closed'],
  site_visit_done: ['token_paid', 'qualified', 'closed'],
  token_paid: ['unit_booked', 'site_visit_done', 'closed'],
  unit_booked: ['commission_due', 'closed'],
  commission_due: ['commission_paid', 'closed'],
  commission_paid: [], // Terminal state
  closed: [],          // Terminal state
};

// @desc    Create a new property/project
// @route   POST /api/properties
// @access  Private (Builder, Agent, Owner, Admin)
exports.createProperty = async (req, res, next) => {
  try {
    const currentUserId = (req.user.id || req.user._id)?.toString();
    req.body.builder = currentUserId;

    if (!['builder', 'agent', 'owner', 'admin'].includes(req.user.role)) {
      return next(new AppError('Not authorized to post properties with this account role', 403));
    }

    // MANDATORY DOCUMENT VERIFICATION GATE (Spec §KYC):
    // Builder, Agent, and Owner MUST have their essential documents verified by Admin before adding property/project.
    if (['builder', 'agent', 'owner'].includes(req.user.role)) {
      const userDoc = await User.findById(currentUserId).select('kycVerification');
      const kycStatus = userDoc?.kycVerification?.status || 'unverified';

      if (kycStatus !== 'verified') {
        const roleLabel = req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1);
        if (kycStatus === 'pending') {
          return res.status(403).json({
            success: false,
            requiresKyc: true,
            kycStatus: 'pending',
            message: `Your ${roleLabel} verification documents are pending administrator review. You will be able to add properties and projects once approved.`,
          });
        }
        if (kycStatus === 'rejected') {
          const reason = userDoc?.kycVerification?.rejectionReason || 'Documents did not meet criteria';
          return res.status(403).json({
            success: false,
            requiresKyc: true,
            kycStatus: 'rejected',
            rejectionReason: reason,
            message: `Your verification documents were rejected: ${reason}. Please re-upload your mandatory documents to post properties.`,
          });
        }
        return res.status(403).json({
          success: false,
          requiresKyc: true,
          kycStatus: 'unverified',
          message: `Mandatory document verification required. As a ${roleLabel}, please upload and verify your Aadhar Card, PAN Card, and registration documents before adding properties or projects.`,
        });
      }
    }

    req.body.category = ['project', 'property'].includes(req.body.category)
      ? req.body.category
      : 'property';

    const title = req.body.title?.trim();
    if (!title) {
      return next(new AppError('Property title / name is required', 400));
    }
    req.body.title = title;

    // Check for duplicate property with the same name AND location (case-insensitive)
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const city = req.body.location?.city ? normalizeTitleCase(req.body.location.city) : '';
    const address = req.body.location?.address ? req.body.location.address.trim() : '';

    const duplicateQuery = {
      title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') },
      isActive: true,
    };

    if (city && address) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedAddress = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      duplicateQuery['location.city'] = { $regex: new RegExp(`^${escapedCity}$`, 'i') };
      duplicateQuery['location.address'] = { $regex: new RegExp(`^${escapedAddress}$`, 'i') };
    } else if (city) {
      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      duplicateQuery['location.city'] = { $regex: new RegExp(`^${escapedCity}$`, 'i') };
    }

    const existing = await Property.findOne(duplicateQuery);

    if (existing) {
      return next(new AppError('A property with this name and location already exists. Please choose a unique name or update location.', 400));
    }

    // Validate non-negative numeric fields (must be minimum 0, no negative numbers allowed)
    if (req.body.price !== undefined && req.body.price !== null && req.body.price !== '') {
      const numPrice = Number(req.body.price);
      if (isNaN(numPrice) || numPrice < 0) {
        return next(new AppError('Property price must be at least 0 (no negative values allowed)', 400));
      }
      req.body.price = numPrice;
      req.body.priceDisplay = normalizePriceDisplay(numPrice, req.body.priceDisplay, req.body.purpose);
    }

    if (req.body.bhk !== undefined && req.body.bhk !== null && req.body.bhk !== '') {
      const numBhk = Number(req.body.bhk);
      if (isNaN(numBhk) || numBhk < 0) {
        return next(new AppError('Property BHK must be at least 0 (no negative values allowed)', 400));
      }
      req.body.bhk = numBhk;
    }

    if (req.body.area !== undefined && req.body.area !== null && req.body.area !== '') {
      const numArea = Number(req.body.area);
      if (isNaN(numArea) || numArea < 0) {
        return next(new AppError('Property area must be at least 0 (no negative values allowed)', 400));
      }
      req.body.area = numArea;
    }

    // Auto-compute priceSub if price and area are available
    if (req.body.price > 0 && req.body.area > 0 && !req.body.priceSub) {
      req.body.priceSub = `₹ ${Math.round(req.body.price / req.body.area).toLocaleString('en-IN')} / Sq.Ft`;
    }

    if (req.body.reraId) {
      req.body.reraId = normalizeCode(req.body.reraId);
    }

    if (req.body.location) {
      if (req.body.location.city) req.body.location.city = normalizeTitleCase(req.body.location.city);
      if (req.body.location.state) req.body.location.state = normalizeTitleCase(req.body.location.state);
      if (req.body.location.address) req.body.location.address = req.body.location.address.trim();
    }

    const property = await Property.create(req.body);

    // Invalidate properties cache immediately
    memoryCache.clear('properties');

    res.status(201).json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all properties (with filtering)
// @route   GET /api/properties
// @access  Public
exports.getProperties = async (req, res, next) => {
  try {
    let query;

    const reqQuery = { ...req.query, isActive: true };
    const removeFields = ['select', 'sort', 'page', 'limit'];
    removeFields.forEach((param) => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

    query = Property.find(JSON.parse(queryStr)).populate({
      path: 'builder',
      select: 'name companyName role reraNumber',
    });

    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination (spec §36: never retrieve entire table and filter in memory)
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    // Parallelize count + data fetch: saves one full DB round-trip
    const parsedQuery = JSON.parse(queryStr);
    const [total, properties] = await Promise.all([
      Property.countDocuments(parsedQuery),
      query.skip(skip).limit(limit).lean(),
    ]);

    res.status(200).json({
      success: true,
      count: properties.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single property by ID
// @route   GET /api/properties/:id
// @access  Public
exports.getProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate({
        path: 'builder',
        select: 'name companyName role reraNumber',
      })
      .lean();

    if (!property || !property.isActive) {
      return next(new AppError('Property not found', 404));
    }

    // Increment visits asynchronously in background without blocking response
    Property.findByIdAndUpdate(req.params.id, { $inc: { visits: 1 } }).catch(() => {});

    res.status(200).json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Persist first-touch attribution when an affiliate link is opened
// @route   GET /api/properties/:id/attribution?agent=CODE
// @access  Public
exports.recordPropertyAttribution = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).select('_id isActive');
    if (!property || !property.isActive) return next(new AppError('Property not found', 404));
    const result = await resolveAttribution(req, property._id, req.query.agent || null, req.user?._id || null);
    res.status(200).json({ success: true, data: { isAttributed: result.isAttributed } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured properties
// @route   GET /api/properties/featured
// @access  Public
exports.getFeatured = async (req, res, next) => {
  try {
    const category = req.query.category || 'property';
    const baseFilter = { isActive: true, category };

    // Check cheaply if any featured listings exist before doing the full populate
    const featuredCount = await Property.countDocuments({ ...baseFilter, isFeatured: true });

    let properties;
    if (featuredCount > 0) {
      properties = await Property.find({ ...baseFilter, isFeatured: true })
        .populate({ path: 'builder', select: 'name role companyName reraNumber agencyName' })
        .limit(4)
        .lean();
    } else {
      // Fallback: latest active listings of this category
      properties = await Property.find(baseFilter)
        .sort('-createdAt')
        .populate({ path: 'builder', select: 'name role companyName reraNumber agencyName' })
        .limit(4)
        .lean();
    }

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get logged-in user's properties (Builder, Agent, Owner, Admin)
// @route   GET /api/properties/mine
// @access  Private (Builder, Agent, Owner, Admin)
exports.getMyProperties = async (req, res, next) => {
  try {
    if (!['builder', 'agent', 'owner', 'admin'].includes(req.user.role)) {
      return next(new AppError('Not authorized to access this route', 403));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();
    const filter = req.user.role === 'admin'
      ? { isActive: true }
      : { builder: currentUserId, isActive: true };

    const properties = await Property.find(filter).sort('-createdAt').limit(200).lean();

    res.status(200).json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update property
// @route   PATCH /api/properties/:id
// @access  Private (Owner/Builder/Agent/Admin)
exports.updateProperty = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    let property = await Property.findById(propertyId);

    if (!property) {
      return next(new AppError('Property not found', 404));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();
    const currentUserRole = req.user.role;
    const propertyOwnerId = property.builder?._id
      ? property.builder._id.toString()
      : (property.builder ? property.builder.toString() : null);

    const isOwner = propertyOwnerId && currentUserId && propertyOwnerId === currentUserId;
    const isAdmin = currentUserRole === 'admin';
    const isPrivilegedRole = ['builder', 'agent', 'owner', 'admin'].includes(currentUserRole);
    const isUnassigned = !propertyOwnerId && isPrivilegedRole;

    if (!isOwner && !isAdmin && !isUnassigned) {
      return next(new AppError('Not authorized to update this property', 403));
    }

    if (req.body.category) {
      req.body.category = ['project', 'property'].includes(req.body.category)
        ? req.body.category
        : 'property';
    }

    // Check duplicate title & location if updating title or location
    const titleToCheck = (req.body.title !== undefined ? req.body.title : property.title)?.trim();
    const cityToCheck = (req.body.location?.city !== undefined ? req.body.location.city : property.location?.city)?.trim();
    const addressToCheck = (req.body.location?.address !== undefined ? req.body.location.address : property.location?.address)?.trim();

    if (titleToCheck) {
      const escapedTitle = titleToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const updateDuplicateQuery = {
        _id: { $ne: propertyId },
        title: { $regex: new RegExp(`^${escapedTitle}$`, 'i') },
        isActive: true,
      };

      if (cityToCheck && addressToCheck) {
        const escapedCity = cityToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedAddress = addressToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        updateDuplicateQuery['location.city'] = { $regex: new RegExp(`^${escapedCity}$`, 'i') };
        updateDuplicateQuery['location.address'] = { $regex: new RegExp(`^${escapedAddress}$`, 'i') };
      } else if (cityToCheck) {
        const escapedCity = cityToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        updateDuplicateQuery['location.city'] = { $regex: new RegExp(`^${escapedCity}$`, 'i') };
      }

      const existing = await Property.findOne(updateDuplicateQuery);

      if (existing) {
        return next(new AppError('A property with this name and location already exists. Please choose a unique name or update location.', 400));
      }
    }

    // Preserve or assign owner
    if (!property.builder) {
      req.body.builder = currentUserId;
    }

    // Validate non-negative numeric fields (must be minimum 0, no negative numbers allowed)
    if (req.body.price !== undefined && req.body.price !== null && req.body.price !== '') {
      const numPrice = Number(req.body.price);
      if (isNaN(numPrice) || numPrice < 0) {
        return next(new AppError('Property price must be at least 0 (no negative values allowed)', 400));
      }
      req.body.price = numPrice;
      req.body.priceDisplay = normalizePriceDisplay(numPrice, req.body.priceDisplay, req.body.purpose || property.purpose);
    }

    if (req.body.bhk !== undefined && req.body.bhk !== null && req.body.bhk !== '') {
      const numBhk = Number(req.body.bhk);
      if (isNaN(numBhk) || numBhk < 0) {
        return next(new AppError('Property BHK must be at least 0 (no negative values allowed)', 400));
      }
      req.body.bhk = numBhk;
    }

    if (req.body.area !== undefined && req.body.area !== null && req.body.area !== '') {
      const numArea = Number(req.body.area);
      if (isNaN(numArea) || numArea < 0) {
        return next(new AppError('Property area must be at least 0 (no negative values allowed)', 400));
      }
      req.body.area = numArea;
    }

    // Auto-compute priceSub on update
    const effectivePrice = req.body.price !== undefined ? Number(req.body.price) : (property.price || 0);
    const effectiveArea = req.body.area !== undefined ? Number(req.body.area) : (property.area || 0);
    if (effectivePrice > 0 && effectiveArea > 0 && !req.body.priceSub) {
      req.body.priceSub = `₹ ${Math.round(effectivePrice / effectiveArea).toLocaleString('en-IN')} / Sq.Ft`;
    }

    if (req.body.reraId) {
      req.body.reraId = normalizeCode(req.body.reraId);
    }

    if (req.body.location) {
      if (req.body.location.city) req.body.location.city = normalizeTitleCase(req.body.location.city);
      if (req.body.location.state) req.body.location.state = normalizeTitleCase(req.body.location.state);
      if (req.body.location.address) req.body.location.address = req.body.location.address.trim();
    }

    property = await Property.findByIdAndUpdate(propertyId, req.body, {
      new: true,
      runValidators: true,
    });

    // Invalidate properties cache immediately
    memoryCache.clear('properties');

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete property (soft delete)
// @route   DELETE /api/properties/:id
// @access  Private (Owner/Builder/Agent/Admin)
exports.deleteProperty = async (req, res, next) => {
  try {
    let property = await Property.findById(req.params.id);

    if (!property) {
      return next(new AppError('Property not found', 404));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();
    const currentUserRole = req.user.role;
    const propertyOwnerId = property.builder?._id
      ? property.builder._id.toString()
      : (property.builder ? property.builder.toString() : null);

    const isOwner = propertyOwnerId && currentUserId && propertyOwnerId === currentUserId;
    const isAdmin = currentUserRole === 'admin';
    const isPrivilegedRole = ['builder', 'agent', 'owner', 'admin'].includes(currentUserRole);

    if (!isOwner && !isAdmin && !(isPrivilegedRole && !propertyOwnerId)) {
      return next(new AppError('Not authorized to delete this property', 403));
    }

    property.isActive = false;
    await property.save();

    // Invalidate properties cache immediately
    memoryCache.clear('properties');

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit inquiry / book visit for a property (stores full inquiry in DB)
// @route   POST /api/properties/:id/inquiry
// @access  Public
exports.submitInquiry = async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      message, 
      visitRequested, 
      visitDate, 
      visitTime, 
      propertyTitle, 
      propertyType, 
      propertyLocation, 
      propertyImage, 
      builderName 
    } = req.body;

    // Admin users must not submit, view, or interact with property inquiries
    if (req.user && req.user.role === 'admin') {
      return next(new AppError(
        'Admin users cannot submit property inquiries. Please use a buyer account.',
        403
      ));
    }

    if (!name || !email) {
      return next(new AppError('Name and email are required', 400));
    }

    // Phone Validation: 10-digit mobile number
    if (phone) {
      const cleanDigits = String(phone).replace(/\D/g, '').slice(-10);
      if (cleanDigits.length !== 10 || !/^[6-9]\d{9}$/.test(cleanDigits)) {
        return next(new AppError('Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9', 400));
      }
    }

    // 1. Email Normalization & Syntax Validation
    const { normalizedEmail, isValid } = normalizeEmail(email);
    if (!isValid || !normalizedEmail) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    // 2. Anti-Abuse & Disposable / Temporary Email Prevention
    const securityContext = {
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'] || '',
      botToken: req.body.botToken || req.body.cfTurnstileToken || '',
      honeypot: req.body.hp_website || req.body.honeypot || '',
      formTimeMs: req.body.formTimeMs ? parseInt(req.body.formTimeMs, 10) : 0,
    };

    const disposableCheck = await isDisposableEmail(normalizedEmail, securityContext);
    if (disposableCheck.isDisposable) {
      return next(
        new AppError(
          visitRequested
            ? 'Access Blocked: Temporary or disposable email addresses cannot be used to book site visits. Please use a valid email address from a supported provider.'
            : 'Access Blocked: Temporary or disposable email addresses cannot be used to submit property inquiries. Please use a valid email address from a supported provider.',
          400
        )
      );
    }

    // 3. Mandatory Email Verification: Bookings & Inquiries require a verified email address
    let isUserVerified = Boolean(req.user && req.user.isVerified);
    if (!isUserVerified && req.user && req.user.id) {
      try {
        const freshUser = await User.findById(req.user.id).select('isVerified');
        if (freshUser && freshUser.isVerified) {
          isUserVerified = true;
          req.user.isVerified = true;
        }
      } catch {
        // Fallback to token state
      }
    }

    if (!isUserVerified) {
      return res.status(403).json({
        success: false,
        requiresEmailVerification: true,
        message: visitRequested
          ? 'Email verification required. Please verify your email address before booking a site visit.'
          : 'Email verification required. Please verify your email address before submitting an inquiry.',
      });
    }

    // 3b. Real-World Date & Time Slot Coordination for Site Visits
    if (visitRequested) {
      if (!visitDate) {
        return next(new AppError('Preferred visit date is required for site visits.', 400));
      }
      if (!visitTime) {
        return next(new AppError('Preferred time slot is required for site visits.', 400));
      }

      // Validate date format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
        return next(new AppError('Invalid visit date format. Expected YYYY-MM-DD.', 400));
      }

      // Evaluate actual world time in Indian Standard Time (IST)
      const nowTime = new Date();
      const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(nowTime);
      const istHour = parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(nowTime),
        10
      );
      const istMinute = parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', minute: 'numeric' }).format(nowTime),
        10
      );
      const currentIstMinutes = istHour * 60 + istMinute;

      // Check 1: Visit date cannot be prior to current date in IST
      if (visitDate < istDateStr) {
        return next(new AppError('Visit date cannot be in the past. Please select today or a future date.', 400));
      }

      // Check 2: If visit is scheduled for today in IST, verify the time slot has not already ended
      if (visitDate === istDateStr) {
        const timeLower = (visitTime || '').toLowerCase();
        let slotCutoffMinutes = 19 * 60; // 7:00 PM cutoff

        if (timeLower.includes('morning') || timeLower.includes('10 am') || timeLower.includes('10:00')) {
          slotCutoffMinutes = 13 * 60; // Morning slot concludes at 1:00 PM
        } else if (timeLower.includes('afternoon') || timeLower.includes('1 pm') || timeLower.includes('13:00')) {
          slotCutoffMinutes = 16 * 60; // Afternoon slot concludes at 4:00 PM
        } else if (timeLower.includes('evening') || timeLower.includes('4 pm') || timeLower.includes('16:00')) {
          slotCutoffMinutes = 19 * 60; // Evening slot concludes at 7:00 PM
        }

        if (currentIstMinutes >= slotCutoffMinutes) {
          return next(
            new AppError(
              `The selected time slot (${visitTime}) for today has already concluded. Please choose an upcoming slot or a future date.`,
              400
            )
          );
        }
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Auto-reject any unanswered inquiries older than 7 days
    await Inquiry.updateMany(
      {
        status: { $in: ['new', 'visit'] },
        createdAt: { $lte: sevenDaysAgo },
      },
      {
        $set: {
          status: 'rejected',
          lifecycleStage: 'rejected',
          rejectionReason: 'Auto-rejected after 7 days unanswered',
          rejectedAt: now,
        },
      }
    );

    // Enforce: Per-property lock — user cannot submit duplicate inquiry/visit for the SAME property
    // until their existing pending item is answered or auto-rejected (after 7 days)
    const userQuery = req.user?.id
      ? { $or: [{ user: req.user.id }, { email: normalizedEmail }] }
      : { email: normalizedEmail };

    const propId = req.params.id;

    if (visitRequested) {
      // Check for active pending site visit for this property
      const activePendingVisit = await Inquiry.findOne({
        property: propId,
        ...userQuery,
        visitRequested: true,
        status: { $in: ['new', 'visit'] },
        createdAt: { $gt: sevenDaysAgo },
      }).sort('-createdAt');

      if (activePendingVisit) {
        const forProp = activePendingVisit.propertyTitle ? ` for "${activePendingVisit.propertyTitle}"` : '';
        return res.status(400).json({
          success: false,
          pendingInquiry: true,
          message: `You already have an active site visit booking${forProp} awaiting confirmation. You cannot submit another visit booking until the previous one is confirmed or completed.`,
        });
      }
    } else {
      // Check for active pending general inquiry for this property
      const activePendingGeneralInquiry = await Inquiry.findOne({
        property: propId,
        ...userQuery,
        visitRequested: false,
        status: { $in: ['new'] },
        createdAt: { $gt: sevenDaysAgo },
      }).sort('-createdAt');

      if (activePendingGeneralInquiry) {
        const forProp = activePendingGeneralInquiry.propertyTitle ? ` for "${activePendingGeneralInquiry.propertyTitle}"` : '';
        return res.status(400).json({
          success: false,
          pendingInquiry: true,
          message: `You already have a pending property inquiry${forProp} awaiting response. You cannot submit another inquiry until the previous one is answered or resolved (auto-rejected after 7 days).`,
        });
      }
    }

    let property = null;
    let builderId = null;

    if (mongoose.Types.ObjectId.isValid(propId)) {
      property = await Property.findById(propId);
      if (property) {
        builderId = property.builder?._id || property.builder;
        property.enquiries = (property.enquiries || 0) + 1;
        if (visitRequested) {
          property.visits = (property.visits || 0) + 1;
        }
        await property.save();
      }
    }
    if (!property || !property.isActive) {
      return next(new AppError('Property not found or unavailable', 404));
    }

    // Resolve First-Touch Attribution (Master Project -> Agent Window)
    let attributionResult = { agent: null, agentCode: null, isAttributed: false, expiresAt: null };
    if (property) {
      try {
        attributionResult = await resolveAttribution(
          req,
          property._id,
          req.body.agentCode || req.query.agent,
          req.user?.id || null
        );
      } catch (attrErr) {
        console.warn('[Attribution Engine Warning]:', attrErr.message);
      }
    }

    // 7-day lifecycle window for inquiry (matches auto-reject window)
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);


    // Create the inquiry record in MongoDB
    const inquiry = await Inquiry.create({
      property: property ? property._id : propId,
      propertyTitle: property?.title || propertyTitle || 'Inquired Property',
      project: property ? property._id : null,
      projectName: property?.title || propertyTitle || 'Estate Project',
      propertyType: property?.type || propertyType || 'Property',
      propertyLocation: property ? (typeof property.location === 'string' ? property.location : `${property.location?.address || ''}, ${property.location?.city || ''}`) : (propertyLocation || ''),
      propertyImage: property?.images?.[0] || propertyImage || '',
      builder: builderId,
      builderName: builderName || 'Property Representative',
      user: req.user ? req.user.id : null,
      name: name.trim(),
      email: normalizedEmail,
      phone: phone || '',
      message: message || (visitRequested ? 'I would like to schedule a site visit for this property.' : ''),
      visitRequested: Boolean(visitRequested),
      visitDate: visitDate || '',
      visitTime: visitTime || '',
      status: visitRequested ? 'visit' : 'new',
      expiresAt,
      // Enterprise Channel Partner Attribution Fields
      agent: attributionResult.agent || null,
      agentCode: attributionResult.agentCode || null,
      isAttributed: attributionResult.isAttributed,
      attributionExpiry: attributionResult.expiresAt || null,
      lifecycleStage: visitRequested ? 'site_visit_scheduled' : 'new',
    });

    // Record initial LeadAuditLog
    await LeadAuditLog.create({
      lead: inquiry._id,
      actor: req.user?._id || inquiry._id,
      actorRole: req.user?.role || 'buyer',
      action: 'INQUIRY_CREATED',
      previousStage: 'none',
      newStage: 'new',
      metadata: {
        isAttributed: attributionResult.isAttributed,
        agentCode: attributionResult.agentCode,
      },
    }).catch((e) => console.warn('[Audit Log Warning]:', e.message));

    // Invalidate properties cache
    memoryCache.clear('properties');

    // Trigger SMS and Email notification alerts asynchronously (non-blocking)
    // If attributed, agent also receives notification
    if (attributionResult.agent) {
      User.findById(attributionResult.agent)
        .select('name email phone role smsNotifications emailNotifications')
        .then((agentUser) => {
          if (agentUser) {
            notifySellerOnNewLead({ sellerUser: agentUser, inquiry, property }).catch(() => {});
            notifySellerOnNewLeadEmail({ sellerUser: agentUser, inquiry, property }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    if (builderId) {
      User.findById(builderId)
        .select('name email phone role smsNotifications emailNotifications')
        .then((sellerUser) => {
          if (sellerUser) {
            notifySellerOnNewLead({ sellerUser, inquiry, property }).catch((smsErr) => {
              console.warn('[SMS Gateway Alert Warning]:', smsErr?.message || smsErr);
            });
            notifySellerOnNewLeadEmail({ sellerUser, inquiry, property }).catch((emailErr) => {
              console.warn('[Seller Lead Email Alert Warning]:', emailErr?.message || emailErr);
            });
          }
        })
        .catch((err) => {
          console.warn('[Seller Lookup Alert Warning]:', err?.message || err);
        });
    }

    // Trigger confirmation email to buyer asynchronously (non-blocking)
    notifyBuyerOnInquiryConfirmationEmail({ buyerUser: req.user, inquiry, property }).catch((err) => {
      console.warn('[Buyer Confirmation Email Warning]:', err?.message || err);
    });

    // Real-time socket events — Spec §41: NEW_ATTRIBUTED_LEAD / LEAD_STATUS_UPDATED
    // Agent gets full lead info (they are the attribution owner)
    if (attributionResult.agent) {
      emitToUser(String(attributionResult.agent), SOCKET_EVENTS.NEW_ATTRIBUTED_LEAD, {
        inquiryId: inquiry._id,
        propertyTitle: inquiry.propertyTitle,
        propertyId: inquiry.property,
        buyerName: inquiry.name,
        buyerPhone: inquiry.phone,
        buyerEmail: inquiry.email,
        message: inquiry.message,
        visitRequested: inquiry.visitRequested,
        agentCode: inquiry.agentCode,
        createdAt: inquiry.createdAt,
      });
    }
    // Builder gets masked notification (no full buyer contact — spec §16)
    if (builderId) {
      emitToUser(String(builderId), SOCKET_EVENTS.NEW_ATTRIBUTED_LEAD, {
        inquiryId: inquiry._id,
        propertyTitle: inquiry.propertyTitle,
        propertyId: inquiry.property,
        buyerName: inquiry.name,
        buyerPhone: attributionResult.isAttributed ? maskPhone(inquiry.phone) : inquiry.phone,
        buyerEmail: attributionResult.isAttributed ? maskEmail(inquiry.email) : inquiry.email,
        message: inquiry.message,
        visitRequested: inquiry.visitRequested,
        isAttributed: attributionResult.isAttributed,
        agentCode: attributionResult.isAttributed ? attributionResult.agentCode : null,
        isContactMasked: attributionResult.isAttributed,
        createdAt: inquiry.createdAt,
      });
    }

    res.status(200).json({
      success: true,
      message: visitRequested ? 'Site visit booked successfully! The representative will confirm your visit slot.' : 'Inquiry submitted successfully! The property representative will contact you soon.',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all inquiries for the logged-in builder/agent/owner's properties
// @route   GET /api/properties/inquiries/mine
// @access  Private (Builder, Agent, Owner — Admin is BLOCKED)
exports.getMyInquiries = async (req, res, next) => {
  try {
    // Determine all roles this user holds (multi-role support)
    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user.role];

    const activeRole = req.user.role;
    const isPropertyHolder =
      activeRole === 'builder' ||
      activeRole === 'owner' ||
      activeRole === 'agent' ||
      userRoles.includes('builder') ||
      userRoles.includes('owner') ||
      userRoles.includes('agent');

    // Admin users without property-holding roles must NOT see property inquiries.
    // Inquiries are private between the buyer and the property holder only.
    if (!isPropertyHolder) {
      if (activeRole === 'admin' || userRoles.includes('admin')) {
        return next(new AppError(
          'Admin users cannot access property inquiries. Inquiries are private between the buyer and the property holder.',
          403
        ));
      }
      return next(new AppError('Not authorized to access this route', 403));
    }

    // Auto-reject stale inquiries asynchronously — does not block the response
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    Inquiry.updateMany(
      { status: { $in: ['new', 'visit'] }, createdAt: { $lte: sevenDaysAgo } },
      { $set: { status: 'rejected', lifecycleStage: 'rejected', rejectionReason: 'Auto-rejected after 7 days unanswered', rejectedAt: new Date() } }
    ).catch(() => {});

    const currentUserId = (req.user.id || req.user._id)?.toString();


    let rawInquiries;

    // Build role-scoped query — fetch owned property IDs only once (deduplicated)
    const targetRole = req.query.role || activeRole;
    const orConditions = [];

    if (targetRole === 'agent' && (userRoles.includes('agent') || activeRole === 'agent')) {
      // Agent sees inquiries attributed to their account
      orConditions.push({ agent: currentUserId });
    } else if (
      (targetRole === 'builder' || targetRole === 'owner') &&
      (userRoles.includes('builder') || userRoles.includes('owner') || activeRole === 'builder' || activeRole === 'owner')
    ) {
      // Builder / Owner: single DB call for owned property IDs
      const ownedPropIds = (await Property.find({ builder: currentUserId }).select('_id').lean()).map((p) => p._id);
      orConditions.push({ builder: currentUserId });
      if (ownedPropIds.length > 0) {
        orConditions.push({ property: { $in: ownedPropIds } });
        orConditions.push({ project: { $in: ownedPropIds } });
      }
    } else {
      // Multi-role fallback — fetch owned props once, reuse for both builder+agent branches
      if (userRoles.includes('builder') || userRoles.includes('owner')) {
        const ownedPropIds = (await Property.find({ builder: currentUserId }).select('_id').lean()).map((p) => p._id);
        orConditions.push({ builder: currentUserId });
        if (ownedPropIds.length > 0) {
          orConditions.push({ property: { $in: ownedPropIds } });
          orConditions.push({ project: { $in: ownedPropIds } });
        }
      }
      if (userRoles.includes('agent')) {
        orConditions.push({ agent: currentUserId });
      }
    }

    rawInquiries = await Inquiry.find(
      orConditions.length > 0 ? { $or: orConditions } : { _id: null }
    )
      .populate('property', 'title type bhk location priceDisplay images category allowAgentAcquisition')
      .populate('project', 'title type location priceDisplay images category allowAgentAcquisition')
      .populate('user', 'name email phone')
      .populate('agent', 'name email phone agencyName agentCode')
      .populate('builder', 'name companyName role reraNumber')
      .sort('-createdAt')
      .limit(300)
      .lean();

    // Apply strict server-side masking projection
    const projectedInquiries = projectLeadsForUser(rawInquiries, req.user);

    res.status(200).json({
      success: true,
      count: projectedInquiries.length,
      data: projectedInquiries,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Get all inquiries submitted by the logged-in buyer
// @route   GET /api/properties/inquiries/buyer
// @access  Private (Buyer only — Admin is BLOCKED)
exports.getBuyerInquiries = async (req, res, next) => {
  try {
    // Determine if user holds buyer role (multi-role support)
    const userRoles = Array.isArray(req.user.roles) && req.user.roles.length > 0
      ? req.user.roles
      : [req.user.role];
    const isBuyer = req.user.role === 'buyer' || userRoles.includes('buyer');

    // Admin must not access buyer inquiry lists unless they are acting as buyer
    if (req.user.role === 'admin' && !isBuyer) {
      return next(new AppError(
        'Admin users cannot access property inquiries. Inquiries are private between the buyer and the property holder.',
        403
      ));
    }

    // Auto-reject stale inquiries asynchronously — does not block the response
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    Inquiry.updateMany(
      { status: { $in: ['new', 'visit'] }, createdAt: { $lte: sevenDaysAgo } },
      { $set: { status: 'rejected', lifecycleStage: 'rejected', rejectionReason: 'Auto-rejected after 7 days unanswered', rejectedAt: new Date() } }
    ).catch(() => {});


    const inquiries = await Inquiry.find({
      $or: [{ user: req.user.id }, { email: req.user.email }],
    })
      .populate('property', 'title type category location priceDisplay images bhk')
      .populate('builder', 'name companyName role reraNumber')
      .sort('-createdAt')
      .lean();

    res.status(200).json({
      success: true,
      count: inquiries.length,
      data: inquiries,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inquiry status
// @route   PATCH /api/properties/inquiries/:id
// @access  Private (Builder, Agent, Owner, Admin)
exports.updateInquiryStatus = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return next(new AppError('Inquiry not found', 404));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();
    const inquiryBuilderId = inquiry.builder?._id
      ? inquiry.builder._id.toString()
      : (inquiry.builder ? inquiry.builder.toString() : null);
    const inquiryAgentId = inquiry.agent?._id
      ? inquiry.agent._id.toString()
      : (inquiry.agent ? inquiry.agent.toString() : null);

    let isPropertyHolder =
      (inquiryBuilderId && inquiryBuilderId === currentUserId) ||
      (inquiryAgentId && inquiryAgentId === currentUserId);
    if (!inquiryBuilderId && !inquiryAgentId && inquiry.property) {
      const linkedProperty = await Property.findById(inquiry.property).select('builder user').lean();
      const linkedOwnerId = linkedProperty?.builder || linkedProperty?.user;
      isPropertyHolder = !!linkedOwnerId && String(linkedOwnerId) === currentUserId;
    }

    // Admin users who are not the property holder must NOT answer property inquiries
    if (req.user.role === 'admin' && !isPropertyHolder) {
      return next(new AppError(
        'Admin users cannot answer or update property inquiries. Inquiries must be handled directly by the property holder (builder, owner, or agent).',
        403
      ));
    }

    if (!isPropertyHolder) {
      return next(new AppError('Not authorized to update this inquiry', 403));
    }


    const previousLifecycleStage = inquiry.lifecycleStage || 'new';

    // STATE MACHINE ENFORCEMENT — Spec §48
    // All property holders (builder, owner, agent) must follow valid transitions.
    if (req.body.lifecycleStage && req.body.lifecycleStage !== previousLifecycleStage) {
      const allowedNext = VALID_LIFECYCLE_TRANSITIONS[previousLifecycleStage] || [];
      if (!allowedNext.includes(req.body.lifecycleStage)) {
        return next(new AppError(
          `Invalid lifecycle transition: '${previousLifecycleStage}' → '${req.body.lifecycleStage}' is not permitted. Allowed: [${allowedNext.join(', ') || 'none — terminal state'}]`,
          400
        ));
      }
    }


    inquiry.status = req.body.status || inquiry.status;
    if (req.body.lifecycleStage) {
      inquiry.lifecycleStage = req.body.lifecycleStage;
    }
    if (req.body.notes !== undefined) {
      inquiry.notes = req.body.notes;
    }
    if (req.body.visitDate !== undefined) {
      inquiry.visitDate = req.body.visitDate;
    }
    if (req.body.visitTime !== undefined) {
      inquiry.visitTime = req.body.visitTime;
    }
    await inquiry.save();

    // Audit log if lifecycle stage changed
    if (req.body.lifecycleStage && req.body.lifecycleStage !== previousLifecycleStage) {
      await LeadAuditLog.create({
        lead: inquiry._id,
        actor: req.user._id,
        actorRole: req.user.role,
        action: 'STAGE_UPDATED',
        previousStage: previousLifecycleStage,
        newStage: req.body.lifecycleStage,
        metadata: { notes: req.body.notes },
      }).catch(() => {});
    }

    await inquiry.populate('property', 'title location price images status');
    await inquiry.populate('user', 'name email phone avatar');

    // Trigger SMS and Email notifications to buyer when status is updated (e.g. visit scheduled or completed)
    if (req.body.status && ['visit', 'closed'].includes(req.body.status)) {
      Promise.resolve()
        .then(async () => {
          let buyerUser = inquiry.user;
          if (buyerUser && typeof buyerUser === 'string') {
            buyerUser = await User.findById(buyerUser).select('name email phone smsNotifications emailNotifications');
          }
          await notifyBuyerOnStatusChange({
            buyerUser,
            inquiry,
            property: inquiry.property,
            newStatus: req.body.status,
            extraData: {
              visitDate: inquiry.visitDate,
              visitTime: inquiry.visitTime,
            },
          });
          await notifyBuyerOnStatusChangeEmail({
            buyerUser,
            inquiry,
            property: inquiry.property,
            newStatus: req.body.status,
            extraData: {
              visitDate: inquiry.visitDate,
              visitTime: inquiry.visitTime,
            },
          });
        })
        .catch((notifErr) => {
          console.warn('[Status Change Notification Alert Warning]:', notifErr?.message || notifErr);
        });
    }

    res.status(200).json({
      success: true,
      message: 'Inquiry status updated successfully',
      data: projectLeadForUser(inquiry, req.user),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a single inquiry
// @route   DELETE /api/properties/inquiries/:id
// @access  Private (Builder, Agent, Owner, Admin)
exports.deleteInquiry = async (req, res, next) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return next(new AppError('Inquiry not found', 404));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();
    const inquiryBuilderId = inquiry.builder?._id
      ? inquiry.builder._id.toString()
      : (inquiry.builder ? inquiry.builder.toString() : null);
    const inquiryAgentId = inquiry.agent?._id
      ? inquiry.agent._id.toString()
      : (inquiry.agent ? inquiry.agent.toString() : null);

    let isAuthorized =
      (inquiryBuilderId && inquiryBuilderId === currentUserId) ||
      (inquiryAgentId && inquiryAgentId === currentUserId);
    if (!isAuthorized && !inquiryBuilderId && !inquiryAgentId && inquiry.property) {
      const linkedProperty = await Property.findById(inquiry.property).select('builder user').lean();
      const linkedOwnerId = linkedProperty?.builder || linkedProperty?.user;
      isAuthorized = !!linkedOwnerId && String(linkedOwnerId) === currentUserId;
    }

    if (!isAuthorized) {
      return next(new AppError('Not authorized to delete this inquiry', 403));
    }

    await Inquiry.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully',
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to property inquiry via email and automatically delete inquiry
// @route   POST /api/properties/inquiries/:id/reply
// @access  Private (Builder, Agent, Owner, Admin)
exports.replyToPropertyInquiry = async (req, res, next) => {
  try {
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return next(new AppError('Please enter a reply message to send to the buyer', 400));
    }

    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return next(new AppError('Inquiry not found or already resolved', 404));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();
    const inquiryBuilderId = inquiry.builder?._id
      ? inquiry.builder._id.toString()
      : (inquiry.builder ? inquiry.builder.toString() : null);
    const inquiryAgentId = inquiry.agent?._id
      ? inquiry.agent._id.toString()
      : (inquiry.agent ? inquiry.agent.toString() : null);

    let isAuthorized =
      (inquiryBuilderId && inquiryBuilderId === currentUserId) ||
      (inquiryAgentId && inquiryAgentId === currentUserId);

    if (!isAuthorized && inquiry.property) {
      const prop = await Property.findById(inquiry.property).select('builder user');
      const linkedOwnerId = prop?.builder || prop?.user;
      if (linkedOwnerId && String(linkedOwnerId) === currentUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return next(new AppError('Not authorized to reply to this inquiry', 403));
    }

    const sendEmail = require('../utils/sendEmail');
    const senderRole = req.user.role === 'agent' ? 'Real Estate Agent' : req.user.role === 'owner' ? 'Property Owner' : 'Property Developer';
    const senderName =
      req.user.builderProfile?.companyName ||
      req.user.agencyProfile?.agencyName ||
      req.user.name ||
      senderRole;
    const emailSubject = `Response to your inquiry on ${inquiry.propertyTitle || 'Property'} — EstateXplorer`;
    
    const emailText = `Hello ${inquiry.name || 'Valued Buyer'},\n\nThank you for reaching out regarding "${inquiry.propertyTitle || 'the property'}".\n\n${senderRole} Response:\n${replyMessage.trim()}\n\n---\nYour Original Inquiry:\n"${inquiry.message || 'Property Inquiry'}"\n\nContact Details:\nRepresentative: ${req.user.name || senderName}\nRole: ${senderRole}\nEmail: ${req.user.email}\n${req.user.phone ? `Phone: ${req.user.phone}\n` : ''}\nBest regards,\nEstateXplorer Team\nsupport@estatexplorer.in`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Estate<span style="color: #2563eb;">Xplorer</span></h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Response to Your Property Inquiry</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Hello <strong>${inquiry.name || 'Valued Buyer'}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          <strong>${senderName}</strong> (${senderRole}) has responded to your inquiry regarding <em>"${inquiry.propertyTitle || 'the property'}"</em>:
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <p style="font-size: 14px; line-height: 1.6; color: #0f172a; margin: 0; white-space: pre-wrap;">${replyMessage.trim()}</p>
        </div>

        ${inquiry.message ? `
        <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #64748b; margin-bottom: 20px;">
          <strong>Your Original Inquiry:</strong><br />
          <span style="font-style: italic;">"${inquiry.message}"</span>
        </div>
        ` : ''}

        <div style="font-size: 13px; color: #475569; padding: 14px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
          <strong style="color: #0f172a;">${senderRole} Contact Details:</strong><br />
          Representative: ${req.user.name || senderName}<br />
          Email: <a href="mailto:${req.user.email}" style="color: #2563eb; text-decoration: none;">${req.user.email}</a>
          ${req.user.phone ? `<br />Phone: <a href="tel:${req.user.phone}" style="color: #2563eb; text-decoration: none;">${req.user.phone}</a>` : ''}
        </div>

        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          If you have further questions or wish to book a visit, feel free to reply directly to this email or visit EstateXplorer.<br />
          <strong>EstateXplorer Platform</strong> · <a href="mailto:support@estatexplorer.in" style="color: #2563eb; text-decoration: none;">support@estatexplorer.in</a>
        </p>
      </div>
    `;

    try {
      await sendEmail({
        email: inquiry.email,
        subject: emailSubject,
        message: emailText,
        html: emailHtml,
      });
    } catch (emailErr) {
      console.warn('[Property Inquiry Reply Email Warning]:', emailErr.message || emailErr);
      return next(new AppError('Reply could not be delivered. The inquiry remains available for retry.', 502));
    }

    // Automatically delete inquiry from database after sending reply
    await Inquiry.findByIdAndDelete(inquiry._id);

    res.status(200).json({
      success: true,
      message: `Reply email sent to ${inquiry.email} and inquiry successfully resolved and deleted.`,
      data: { id: inquiry._id, deleted: true },
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Bulk delete inquiries
// @route   POST /api/properties/inquiries/bulk-delete
// @access  Private (Builder, Agent, Owner, Admin)
exports.bulkDeleteInquiries = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('Please provide an array of inquiry IDs to delete', 400));
    }

    const currentUserId = (req.user.id || req.user._id)?.toString();

    if (!['builder', 'owner', 'agent'].includes(req.user.role)) {
      return next(new AppError('Your role cannot delete property inquiries.', 403));
    }
    const properties = await Property.find({ builder: currentUserId }).select('_id').lean();
    const propIds = properties.map((p) => p._id);
    const filter = {
      _id: { $in: ids },
      $or: [
        { builder: currentUserId },
        { agent: currentUserId },
        ...(propIds.length ? [{ property: { $in: propIds } }, { project: { $in: propIds } }] : []),
      ],
    };

    const ownedInquiries = await Inquiry.find(filter).select('_id').lean();
    if (ownedInquiries.length !== ids.length) {
      return next(new AppError('One or more inquiries are not available for your account.', 403));
    }
    const result = await Inquiry.deleteMany({ _id: { $in: ownedInquiries.map((item) => item._id) } });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} inquiries`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user wishlist
// @route   GET /api/properties/wishlist
// @access  Private
exports.getUserWishlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    const rawIds = user.wishlist || [];
    const uniqueIds = [...new Set(rawIds.map((id) => String(id)))];

    // Check DB for active existing properties
    const validProps = await Property.find({ _id: { $in: uniqueIds } }).select('_id');
    const validDbIds = validProps.map((p) => p._id.toString());

    // Also support static/demo property IDs (e.g. numeric IDs)
    const validStaticIds = uniqueIds.filter((id) => !id.match(/^[0-9a-fA-F]{24}$/));
    const cleanWishlist = [...new Set([...validDbIds, ...validStaticIds])];

    if (user.wishlist.length !== cleanWishlist.length) {
      user.wishlist = cleanWishlist;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: cleanWishlist,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle property in user wishlist
// @route   POST /api/properties/wishlist/:id
// @access  Private
exports.toggleWishlist = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    let wishlist = user.wishlist ? [...new Set(user.wishlist.map((id) => String(id)))] : [];
    const index = wishlist.indexOf(String(propertyId));

    if (index > -1) {
      wishlist.splice(index, 1);
    } else {
      wishlist.push(String(propertyId));
    }

    user.wishlist = wishlist;
    await user.save();

    res.status(200).json({
      success: true,
      data: wishlist,
      isWishlisted: wishlist.includes(String(propertyId)),
    });
  } catch (error) {
    next(error);
  }
};
