const crypto = require('crypto');
const mongoose = require('mongoose');
const ProjectUnit = require('../models/ProjectUnit');
const Booking = require('../models/Booking');
const Inquiry = require('../models/Inquiry');
const Property = require('../models/Property');
const Partnership = require('../models/Partnership');
const LeadAuditLog = require('../models/LeadAuditLog');
const { emitToUser, emitToUsers, SOCKET_EVENTS } = require('./socketManager');

/**
 * Generates unique booking reference e.g., BK-2026-A83F19BC
 */
function generateBookingNumber() {
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  const year = new Date().getFullYear();
  return `BK-${year}-${code}`;
}

/**
 * Concurrency-Safe Unit Booking Service.
 * 
 * Invariants:
 * 1. An inventory unit CANNOT be double-booked under high concurrency.
 *    We enforce this via atomic findOneAndUpdate matching { _id, status: 'available' }.
 *    If status != 'available', the operation fails immediately with 409 Conflict.
 * 2. If lead is attributed to an agent, commission is locked and calculated based on agreed partnership rate.
 * 3. Audit trail (LeadAuditLog) is recorded immutably.
 * 4. Master project availableUnitsCount is atomically decremented.
 */
async function bookUnit({
  unitId,
  leadId,
  actorUser,
  agreementValue,
  tokenAmount = 50000,
  paymentMethod = 'Bank Transfer',
  paymentRef = '',
  notes = '',
}) {
  const amount = Number(agreementValue);
  const token = Number(tokenAmount);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(token) || token < 0 || token > amount) {
    const err = new Error('Agreement value and token amount must be valid; token amount cannot exceed agreement value.');
    err.statusCode = 400;
    throw err;
  }

  const session = await mongoose.startSession();
  let booking;
  let bookedUnit;
  let projectId;
  let builderId;
  let agentId;
  let isAttributed;
  let commissionRate;
  let commissionAmount;
  let previousStage;

  try {
    await session.withTransaction(async () => {
      const lead = await Inquiry.findById(leadId).session(session);
      if (!lead) {
        const err = new Error('Lead (Inquiry) not found.');
        err.statusCode = 404;
        throw err;
      }
      if (lead.bookingRef || lead.bookedUnit || ['unit_booked', 'commission_due', 'commission_paid'].includes(lead.lifecycleStage)) {
        const err = new Error('This lead already has a booking.');
        err.statusCode = 409;
        throw err;
      }

      // Mandatory Site Visit Gate: At least 1 site visit must be completed before booking & paying token
      const hasCompletedSiteVisit = Boolean(
        lead.siteVisitCompleted ||
        lead.lifecycleStage === 'site_visit_done' ||
        lead.lifecycleStage === 'token_paid' ||
        (lead.visitRequested && lead.status === 'closed')
      );

      if (!hasCompletedSiteVisit && actorUser?.role !== 'admin') {
        const err = new Error('At least 1 site visit must be completed for this buyer before the property can be booked and the token amount paid.');
        err.statusCode = 400;
        throw err;
      }

      const candidateUnit = await ProjectUnit.findById(unitId).session(session);
      if (!candidateUnit) {
        const err = new Error('Unit not found in project inventory.');
        err.statusCode = 404;
        throw err;
      }
      projectId = candidateUnit.project;
      builderId = candidateUnit.builder;
      const project = await Property.findById(projectId).select('builder user price').session(session);
      if (!project) {
        const err = new Error('Project associated with this unit no longer exists.');
        err.statusCode = 409;
        throw err;
      }
      const projectOwnerId = project.builder || project.user;
      if (!projectOwnerId || String(projectOwnerId) !== String(builderId)) {
        const err = new Error('Inventory ownership does not match the project owner.');
        err.statusCode = 409;
        throw err;
      }
      const leadProjectId = lead.project || lead.property;
      if (!leadProjectId || String(leadProjectId) !== String(projectId)) {
        const err = new Error('The selected lead does not belong to this project.');
        err.statusCode = 400;
        throw err;
      }
      if (!lead.builder || String(lead.builder) !== String(builderId)) {
        const err = new Error('The selected lead is not assigned to this project builder.');
        err.statusCode = 403;
        throw err;
      }
      if (actorUser.role === 'builder' && String(project.builder || project.user) !== String(actorUser._id)) {
        const err = new Error('You do not own this project.');
        err.statusCode = 403;
        throw err;
      }

      isAttributed = !!lead.isAttributed && !!lead.agent;
      agentId = isAttributed ? lead.agent : null;
      if (actorUser.role === 'agent' && (!isAttributed || String(agentId) !== String(actorUser._id))) {
        const err = new Error('Agents may book only leads assigned to them.');
        err.statusCode = 403;
        throw err;
      }
      let partnership = null;
      if (isAttributed) {
        partnership = await Partnership.findOne({ agent: agentId, project: projectId, status: 'approved' }).session(session);
        if (!partnership) {
          const err = new Error('The agent does not have an active approved partnership for this project.');
          err.statusCode = 403;
          throw err;
        }
      }
      commissionRate = partnership ? Number(partnership.commissionRate) : 0;
      commissionAmount = (amount * commissionRate) / 100;
      previousStage = lead.lifecycleStage || 'new';

      bookedUnit = await ProjectUnit.findOneAndUpdate(
        { _id: unitId, project: projectId, builder: builderId, status: 'available' },
        { $set: { status: 'booked', bookedByAgent: agentId }, $inc: { version: 1 } },
        { new: true, session }
      );
      if (!bookedUnit) {
        const err = new Error('This unit is already booked. Please select another available unit.');
        err.statusCode = 409;
        throw err;
      }

      const bookingNumber = generateBookingNumber();
      [booking] = await Booking.create([{
        bookingNumber,
        project: projectId,
        unit: bookedUnit._id,
        builder: builderId,
        buyer: lead.user || null,
        buyerName: lead.name,
        buyerPhone: lead.phone,
        buyerEmail: lead.email,
        basePrice: Number(bookedUnit.price || project.price),
        agent: agentId,
        lead: lead._id,
        isAttributed,
        agreementValue: amount,
        tokenAmount: token,
        tokenPaymentDate: paymentRef ? new Date() : null,
        paymentDetails: paymentRef ? { method: paymentMethod, transactionRef: paymentRef, paidAt: new Date() } : undefined,
        commission: { rate: commissionRate, amount: commissionAmount, status: isAttributed ? 'due' : 'not_applicable' },
        status: 'confirmed',
        notes,
      }], { session });

      bookedUnit.bookingId = booking._id;
      await bookedUnit.save({ session });
      lead.lifecycleStage = 'unit_booked';
      lead.bookedUnit = bookedUnit._id;
      lead.bookingRef = booking._id;
      lead.tokenAmount = token;
      await lead.save({ session });

      const projectUpdate = await Property.updateOne(
        { _id: projectId, availableUnitsCount: { $gt: 0 } },
        { $inc: { availableUnitsCount: -1, sold: 1 } },
        { session }
      );
      if (projectUpdate.modifiedCount !== 1) {
        const err = new Error('Project inventory counters are inconsistent; booking was not committed.');
        err.statusCode = 409;
        throw err;
      }
      if (partnership) {
        await Partnership.updateOne(
          { _id: partnership._id, status: 'approved' },
          { $inc: { 'metrics.totalBookings': 1, 'metrics.totalCommissionEarned': commissionAmount } },
          { session }
        );
      }
      await LeadAuditLog.create([{
        lead: lead._id,
        actor: actorUser._id,
        actorRole: actorUser.role,
        action: 'UNIT_BOOKED',
        previousStage,
        newStage: 'unit_booked',
        metadata: { bookingNumber, unitNumber: bookedUnit.unitNumber, tower: bookedUnit.tower, agreementValue: amount, commissionAmount },
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  // Real-time events — Spec §41: BOOKING_CREATED + INVENTORY_STATUS_CHANGED
  const bookingPayload = {
    bookingNumber,
    bookingId: booking._id,
    unitNumber: bookedUnit.unitNumber,
    tower: bookedUnit.tower,
    projectId,
    agreementValue,
    commissionAmount,
    commissionRate,
  };
  if (isAttributed && agentId) {
    emitToUser(String(agentId), SOCKET_EVENTS.BOOKING_CREATED, { ...bookingPayload, isAttributed: true });
    emitToUser(String(agentId), SOCKET_EVENTS.COMMISSION_CREATED, {
      bookingId: booking._id,
      bookingNumber,
      commissionRate,
      commissionAmount,
      status: 'due',
    });
  }
  emitToUser(String(builderId), SOCKET_EVENTS.BOOKING_CREATED, bookingPayload);
  emitToUser(String(builderId), SOCKET_EVENTS.INVENTORY_STATUS_CHANGED, {
    projectId,
    unitId: bookedUnit._id,
    unitNumber: bookedUnit.unitNumber,
    tower: bookedUnit.tower,
    newStatus: 'booked',
  });

  return { booking, unit: bookedUnit };
}

/**
 * Marks commission as paid (by Builder)
 */
async function markCommissionPaid(actor, bookingId, transactionRef) {
  if (!String(transactionRef || '').trim()) throw new Error('A payment reference is required to record commission settlement.');
  const session = await mongoose.startSession();
  let booking;
  try {
    await session.withTransaction(async () => {
      booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw new Error('Booking not found.');
      if (actor.role !== 'admin' && String(booking.builder) !== String(actor._id)) {
        const err = new Error('Unauthorized. You do not own the project for this booking.');
        err.statusCode = 403;
        throw err;
      }
      if (!booking.isAttributed || booking.commission.status === 'not_applicable') {
        throw new Error('This booking has no agent commission to settle.');
      }
      if (booking.commission.status === 'paid') throw new Error('Commission is already marked as paid.');
      booking.commission.status = 'paid';
      booking.commission.paidAt = new Date();
      booking.commission.transactionRef = String(transactionRef).trim().slice(0, 200);
      await booking.save({ session });

      if (booking.lead) {
        const lead = await Inquiry.findById(booking.lead).session(session);
        if (lead) {
          const previousStage = lead.lifecycleStage || 'unit_booked';
          lead.lifecycleStage = 'commission_paid';
          await lead.save({ session });
          await LeadAuditLog.create([{
            lead: lead._id,
            actor: actor._id,
            actorRole: actor.role,
            action: 'COMMISSION_PAID',
            previousStage,
            newStage: 'commission_paid',
            metadata: { bookingNumber: booking.bookingNumber, transactionRef: booking.commission.transactionRef },
          }], { session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return booking;
}

module.exports = {
  generateBookingNumber,
  bookUnit,
  markCommissionPaid,
};
