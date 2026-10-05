const bookingService = require('../services/bookingService');
const ProjectUnit = require('../models/ProjectUnit');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

/**
 * @desc   Create Units for a Master Project (Builder)
 * @route  POST /api/bookings/projects/:projectId/units
 * @access Private (Builder only)
 */
exports.createUnits = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { units } = req.body; // Array of { unitNumber, tower, floor, bhk, carpetArea, price }

    if (!Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of units.' });
    }
    if (units.length > 500) {
      return res.status(400).json({ success: false, message: 'A maximum of 500 units can be created per request.' });
    }

    const session = await mongoose.startSession();
    let created;
    try {
      await session.withTransaction(async () => {
        const project = await Property.findById(projectId).session(session);
        if (!project) {
          const error = new Error('Project not found.');
          error.statusCode = 404;
          throw error;
        }
        if (project.category !== 'project') {
          const error = new Error('Inventory units can only be added to a master project.');
          error.statusCode = 400;
          throw error;
        }
        if (String(project.builder || project.user) !== String(req.user._id) && req.user.role !== 'admin') {
          const error = new Error('Unauthorized. You do not own this project.');
          error.statusCode = 403;
          throw error;
        }
        const builderId = project.builder || project.user;
        const unitsToInsert = units.map((unit) => {
          const unitNumber = String(unit.unitNumber || '').trim().toUpperCase();
          const tower = String(unit.tower || 'Tower 1').trim();
          const floor = Number(unit.floor ?? 1);
          const bhk = Number(unit.bhk ?? 2);
          const carpetArea = Number(unit.carpetArea ?? 0);
          const price = Number(unit.price ?? project.price);
          if (!unitNumber || !tower || !Number.isInteger(floor) || floor < 0 || !Number.isFinite(bhk) || bhk <= 0 || !Number.isFinite(carpetArea) || carpetArea < 0 || !Number.isFinite(price) || price <= 0) {
            const error = new Error('Every unit must have a unit number, tower, valid floor, BHK, area, and positive price.');
            error.statusCode = 400;
            throw error;
          }
          return { project: projectId, builder: builderId, unitNumber, tower, floor, bhk, carpetArea, price, status: 'available' };
        });
        const uniqueKeys = new Set(unitsToInsert.map((unit) => `${unit.tower.toLowerCase()}|${unit.unitNumber}`));
        if (uniqueKeys.size !== unitsToInsert.length) {
          const error = new Error('The request contains duplicate unit numbers within a tower.');
          error.statusCode = 409;
          throw error;
        }
        created = await ProjectUnit.insertMany(unitsToInsert, { ordered: true, session });
        await Property.updateOne(
          { _id: projectId },
          { $inc: { totalUnitsCount: created.length, availableUnitsCount: created.length } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      success: true,
      count: created.length,
      data: created,
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, message: err.message });
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
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID.' });
    }

    const query = { project: projectId };
    if (status) query.status = status;
    if (tower) query.tower = tower;
    if (bhk) query.bhk = Number(bhk);

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const [total, units] = await Promise.all([
      ProjectUnit.countDocuments(query),
      ProjectUnit.find(query)
        .sort({ tower: 1, floor: 1, unitNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      count: units.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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

    if (!unitId || !leadId || agreementValue === undefined || agreementValue === null || agreementValue === '') {
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
    let query = {};
    if (req.user.role === 'agent') {
      query = { agent: req.user._id };
    } else if (req.user.role === 'builder') {
      query = { builder: req.user._id };
    } else if (req.user.role === 'buyer') {
      query = { buyer: req.user._id };
    } else if (req.user.role === 'admin') {
      query = {};
    } else {
      return res.status(403).json({ success: false, message: 'Your role cannot access bookings.' });
    }

    const bookings = await Booking.find(query)
      .populate('project', 'title location priceDisplay images')
      .populate('unit', 'unitNumber tower floor bhk price')
      .populate('agent', 'name email phone agencyName')
      .populate('buyer', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

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
    const booking = await bookingService.markCommissionPaid(req.user, req.params.id, req.body?.transactionRef);

    res.status(200).json({
      success: true,
      message: 'Commission marked as paid.',
      data: booking,
    });
  } catch (err) {
    res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }
};
