const mongoose = require('mongoose');
const Property = require('../models/Property');
const Partnership = require('../models/Partnership');
const { emitToUser, SOCKET_EVENTS } = require('./socketManager');

/**
 * Checks for properties that have been open for Agent Assignment for 15 days
 * without an agent being approved, and moves them back to the Builder/Owner's Inventory.
 * (Spec Agent Workflow §4 & §11)
 */
async function checkAndExpireAgentAssignments() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return; // Database not connected yet, next cycle or connection listener will trigger
    }

    const now = new Date();
    const expiredProperties = await Property.find({
      publishingStatus: 'open_for_agent',
      assignedAgent: null,
      agentAssignmentExpiresAt: { $lte: now },
    });

    if (!expiredProperties || expiredProperties.length === 0) {
      return;
    }

    for (const prop of expiredProperties) {
      prop.publishingStatus = 'in_inventory';
      prop.allowAgentAcquisition = false;
      prop.networkEnabled = false;
      prop.agentAssignmentExpiresAt = null;
      await prop.save();

      // Reject any pending applications with expiration reason
      await Partnership.updateMany(
        { project: prop._id, status: 'pending' },
        {
          $set: {
            status: 'rejected',
            rejectionReason: 'Application period expired (15 days) without agent assignment.',
            rejectedAt: now,
          },
        }
      ).catch(() => {});

      // Notify builder/owner in real-time
      const ownerId = prop.builder || prop.user;
      if (ownerId) {
        emitToUser(String(ownerId), SOCKET_EVENTS.PROPERTIES, {
          action: 'assignment_expired',
          propertyId: prop._id,
          title: prop.title,
          message: `The 15-day application window for "${prop.title}" has ended. It has been moved back to your Inventory. You can reopen it for agents or publish it directly.`,
        });
      }
    }

    console.log(`[Agent Expiration Job]: Moved ${expiredProperties.length} expired properties back to inventory.`);
  } catch (err) {
    console.error('[Agent Expiration Job Error]:', err.message);
  }
}

/**
 * Starts the periodic background scheduler (runs every 15 minutes)
 */
function startScheduler() {
  if (mongoose.connection.readyState === 1) {
    checkAndExpireAgentAssignments().catch(() => {});
  } else {
    mongoose.connection.once('open', () => {
      checkAndExpireAgentAssignments().catch(() => {});
    });
  }

  // Run every 15 minutes
  const INTERVAL_MS = 15 * 60 * 1000;
  setInterval(() => {
    checkAndExpireAgentAssignments().catch(() => {});
  }, INTERVAL_MS);

  console.log('Agent assignment 15-day expiration scheduler started.');
}

module.exports = {
  checkAndExpireAgentAssignments,
  startScheduler,
};
