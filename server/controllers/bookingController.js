const bookingService = require('../services/bookingService');
const ProjectUnit = require('../models/ProjectUnit');
const Property = require('../models/Property');
const Booking = require('../models/Booking');

/**
 * @desc   Create Units for a Master Project (Builder)
 * @route  POST /api/bookings/projects/:projectId/units
 * @access Private (Builder only)
 */
exports.createUnits = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { units } = req.body; // Array of { unitNumber, tower, floor, bhk, carpetArea, price }

    const project = await Property.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    if (String(project.builder) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this project.' });
    }

    if (!Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of units.' });
    }

    const unitsToInsert = units.map((u) => ({
      project: projectId,
      builder: req.user._id,
      unitNumber: u.unitNumber,
      tower: u.tower,
      floor: u.floor || 1,
      bhk: u.bhk || 2,
      carpetArea: u.carpetArea || 850,
      price: u.price || project.price,
      status: 'available',
    }));

    const created = await ProjectUnit.insertMany(unitsToInsert, { ordered: false });

    // Update project unit counts
    await Property.findByIdAndUpdate(projectId, {
      $inc: {
        totalUnitsCount: created.length,
        availableUnitsCount: created.length,
      },
    });

    res.status(201).json({
      success: true,
      count: created.length,
      data: created,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Get all units for a project (Filterable by status, tower, bhk)
 * @route  GET /api/bookings/projects/:projectId/units
 * @access Public / Authenticated
 */
exports.getProjectUnits = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, tower, bhk } = req.query;

    const query = { project: projectId };
    if (status) query.status = status;
    if (tower) query.tower = tower;
    if (bhk) query.bhk = Number(bhk);

    const units = await ProjectUnit.find(query).sort({ tower: 1, floor: 1, unitNumber: 1 });

    res.status(200).json({
      success: true,
      count: units.length,
      data: units,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Book a Unit with Concurrency Lock and Commission Attribution
 * @route  POST /api/bookings/book
 * @access Private (Agent, Builder, Admin)
 */
exports.bookUnit = async (req, res) => {
  try {
    const {
      unitId,
      leadId,
      agreementValue,
      tokenAmount,
      paymentMethod,
      paymentRef,
      notes,
    } = req.body;

    if (!unitId || !leadId || !agreementValue) {
      return res.status(400).json({
        success: false,
        message: 'Please provide unitId, leadId, and agreementValue.',
      });
    }

    const result = await bookingService.bookUnit({
      unitId,
      leadId,
      actorUser: req.user,
      agreementValue,
      tokenAmount,
      paymentMethod,
      paymentRef,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Unit successfully booked and locked.',
      data: result,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Get Bookings for logged in user (Agent sees their commissions, Builder sees all project bookings)
 * @route  GET /api/bookings/my-bookings
 * @access Private
 */
exports.getMyBookings = async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'agent') {
      query.agent = req.user._id;
    } else if (req.user.role === 'builder') {
      query.builder = req.user._id;
    } else if (req.user.role === 'buyer') {
      query.buyer = req.user._id;
    }

    const bookings = await Booking.find(query)
      .populate('project', 'title location priceDisplay images')
      .populate('unit', 'unitNumber tower floor bhk price')
      .populate('agent', 'name email phone agencyName')
      .populate('buyer', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Mark Commission as Paid
 * @route  PATCH /api/bookings/:id/commission-paid
 * @access Private (Builder, Admin)
 */
exports.markCommissionPaid = async (req, res) => {
  try {
    const booking = await bookingService.markCommissionPaid(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Commission marked as paid.',
      data: booking,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
