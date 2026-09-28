const crypto = require('crypto');
const ProjectUnit = require('../models/ProjectUnit');
const Booking = require('../models/Booking');
const Inquiry = require('../models/Inquiry');
const Property = require('../models/Property');
const Partnership = require('../models/Partnership');
const LeadAuditLog = require('../models/LeadAuditLog');
const { emitToUser, emitToUsers, SOCKET_EVENTS } = require('./socketManager');

/**
 * Generates unique booking reference e.g., BK-2026-A83F
 */
function generateBookingNumber() {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
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
  const lead = await Inquiry.findById(leadId);
  if (!lead) {
    throw new Error('Lead (Inquiry) not found.');
  }

  // Find candidate unit and verify it exists
  const candidateUnit = await ProjectUnit.findById(unitId);
  if (!candidateUnit) {
    throw new Error('Unit not found in project inventory.');
  }

  const projectId = candidateUnit.project;
  const builderId = candidateUnit.builder;
  const isAttributed = !!lead.isAttributed && !!lead.agent;
  const agentId = lead.agent || null;

  // Resolve commission rate if attributed
  let commissionRate = 0;
  if (isAttributed) {
    const partnership = await Partnership.findOne({ agent: agentId, project: projectId, status: 'approved' });
    commissionRate = partnership?.commissionRate || 2.5;
  }

  const commissionAmount = isAttributed ? (Number(agreementValue) * commissionRate) / 100 : 0;
  const bookingNumber = generateBookingNumber();

  // ATOMIC CONCURRENCY-SAFE UPDATE
  // If two requests hit simultaneously, only one will match status: 'available'
  const bookedUnit = await ProjectUnit.findOneAndUpdate(
    {
      _id: unitId,
      status: 'available',
    },
    {
      $set: {
        status: 'booked',
        bookedByAgent: agentId,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!bookedUnit) {
    const err = new Error('Unit is already booked or reserved by another transaction.');
    err.statusCode = 409; // Conflict
    throw err;
  }

  // Create immutable Booking record
  const booking = await Booking.create({
    bookingNumber,
    project: projectId,
    unit: bookedUnit._id,
    builder: builderId,
    buyer: lead.user || null,
    agent: agentId,
    lead: lead._id,
    isAttributed,
    agreementValue: Number(agreementValue),
    tokenAmount: Number(tokenAmount),
    tokenPaymentDate: new Date(),
    paymentDetails: {
      method: paymentMethod,
      transactionRef: paymentRef || bookingNumber,
      paidAt: new Date(),
    },
    commission: {
      rate: commissionRate,
      amount: commissionAmount,
      status: isAttributed ? 'due' : 'paid',
    },
    status: 'confirmed',
    notes,
  });

  // Link booking back to unit
  bookedUnit.bookingId = booking._id;
  await bookedUnit.save();

  // Update lead CRM stage
  const prevStage = lead.lifecycleStage || 'new';
  lead.lifecycleStage = 'unit_booked';
  lead.bookedUnit = bookedUnit._id;
  lead.bookingRef = booking._id;
  lead.tokenAmount = Number(tokenAmount);
  await lead.save();

  // Decrement available units on master project
  await Property.findByIdAndUpdate(projectId, {
    $inc: { availableUnitsCount: -1, sold: 1 }
  });

  // Update partnership metrics if attributed
  if (isAttributed) {
    await Partnership.findOneAndUpdate(
      { agent: agentId, project: projectId },
      {
        $inc: {
          'metrics.totalBookings': 1,
          'metrics.totalCommissionEarned': commissionAmount,
        }
      }
    );
  }

  // Record immutable LeadAuditLog
  await LeadAuditLog.create({
    lead: lead._id,
    actor: actorUser._id,
    actorRole: actorUser.role,
    action: 'UNIT_BOOKED',
    previousStage: prevStage,
    newStage: 'unit_booked',
    metadata: {
      bookingNumber,
      unitNumber: bookedUnit.unitNumber,
      tower: bookedUnit.tower,
      agreementValue,
      commissionAmount,
    },
  });

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
async function markCommissionPaid(builderId, bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error('Booking not found.');
  if (String(booking.builder) !== String(builderId)) {
    throw new Error('Unauthorized. You do not own the project for this booking.');
  }

  booking.commission.status = 'paid';
  booking.commission.paidAt = new Date();
  await booking.save();

  // Update Lead lifecycle
  if (booking.lead) {
    await Inquiry.findByIdAndUpdate(booking.lead, {
      lifecycleStage: 'commission_paid'
    });
  }

  return booking;
}

module.exports = {
  generateBookingNumber,
  bookUnit,
  markCommissionPaid,
};
