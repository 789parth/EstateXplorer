const crypto = require('crypto');
const mongoose = require('mongoose');
const Attribution = require('../models/Attribution');
const Partnership = require('../models/Partnership');
const User = require('../models/User');
const { ATTRIBUTION_WINDOW_MS } = require('../config/attribution');

/**
 * Computes SHA-256 fingerprint from request IP and User-Agent
 * @param {Object} req 
 * @returns {string} 64-char hex hash
 */
function computeFingerprint(req) {
  // Express derives req.ip according to the configured trusted proxy chain.
  // Never trust the raw X-Forwarded-For value supplied by a caller.
  const ip = req.ip || req.socket?.remoteAddress || 'unknown-client';
  const userAgent = req.headers['user-agent'] || 'unknown-device';
  return crypto.createHash('sha256').update(`${ip}::${userAgent}`).digest('hex');
}

/**
 * Resolves attribution using strict "First-Touch Wins" rule.
 * 
 * Rules:
 * 1. If agentCode is provided:
 *    - Must belong to an APPROVED partnership for this specific project.
 *    - Check if an active Attribution already exists for this fingerprint + project.
 *    - If an active attribution exists, the FIRST agent is retained (first-touch wins, cannot be overwritten).
 *    - If no attribution exists, create a new one with 30 days expiry window.
 * 2. If NO agentCode is provided (Direct Traffic):
 *    - Direct leads belong directly to Builder (agent = null, isAttributed = false).
 *    - No CP gets credit or notification for direct traffic.
 * 
 * @param {Object} req Express request object
 * @param {string|ObjectId} projectId
 * @param {string} [candidateAgentCode]
 * @param {string|ObjectId} [buyerId]
 * @returns {Promise<{agent: ObjectId|null, agentCode: string|null, isAttributed: boolean, expiresAt: Date|null}>}
 */
async function resolveAttribution(req, projectId, candidateAgentCode = null, buyerId = null) {
  const fingerprint = computeFingerprint(req);
  const now = new Date();

  // 1. Check for existing active attribution for this fingerprint + project
  const existingAttribution = await Attribution.findOne({
    fingerprint,
    project: projectId,
    expiresAt: { $gt: now }
  });

  if (existingAttribution) {
    const activePartnership = await Partnership.exists({
      agent: existingAttribution.agent,
      project: projectId,
      status: { $in: ['approved', 'accepted'] },
    });
    if (!activePartnership) {
      return { agent: null, agentCode: null, isAttributed: false, expiresAt: null };
    }
    // Increment visit/touch count for metrics
    existingAttribution.clicksCount = (existingAttribution.clicksCount || 1) + 1;
    if (buyerId && !existingAttribution.buyer) {
      existingAttribution.buyer = buyerId;
    }
    await existingAttribution.save();

    return {
      agent: existingAttribution.agent,
      agentCode: existingAttribution.agentCode,
      isAttributed: true,
      expiresAt: existingAttribution.expiresAt,
    };
  }

  // 2. No existing attribution, evaluate candidate agent code
  const codeToVerify = candidateAgentCode || req.query?.agent || req.body?.agentCode;

  if (!codeToVerify) {
    // Direct organic lead
    return {
      agent: null,
      agentCode: null,
      isAttributed: false,
      expiresAt: null,
    };
  }

  // 3. Verify partnership approval
  const trimmedCode = String(codeToVerify).trim().slice(0, 64);
  const upperCode = trimmedCode.toUpperCase();

  // Try exact uppercase match first to use sparse unique index without regex scan
  let partnership = await Partnership.findOne({
    agentCode: upperCode,
    project: projectId,
    status: { $in: ['approved', 'accepted'] },
  });

  if (!partnership) {
    partnership = await Partnership.findOne({
      agentCode: { $regex: new RegExp(`^${trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      project: projectId,
      status: { $in: ['approved', 'accepted'] },
    });
  }

  if (!partnership && mongoose.Types.ObjectId.isValid(trimmedCode)) {
    partnership = await Partnership.findOne({
      agent: trimmedCode,
      project: projectId,
      status: { $in: ['approved', 'accepted'] },
    });
  }

  if (!partnership) {
    const agentUser = await User.findOne({
      $or: [
        { agentCode: upperCode },
        { agentCode: { $regex: new RegExp(`^${trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ...(mongoose.Types.ObjectId.isValid(trimmedCode) ? [{ _id: trimmedCode }] : []),
      ],
      role: 'agent',
    });

    if (agentUser) {
      partnership = await Partnership.findOne({
        agent: agentUser._id,
        project: projectId,
        status: { $in: ['approved', 'accepted'] },
      });
    }
  }

  if (!partnership) {
    // Invalid or unapproved agent code — fallback to direct builder lead
    return {
      agent: null,
      agentCode: null,
      isAttributed: false,
      expiresAt: null,
    };
  }

  // 4. Create new attribution window (First-Touch locked, uses centralized config)
  const expiresAt = new Date(Date.now() + ATTRIBUTION_WINDOW_MS);

  try {
    const newAttribution = await Attribution.create({
      fingerprint,
      buyer: buyerId || null,
      agent: partnership.agent,
      project: projectId,
      agentCode: partnership.agentCode,
      firstTouchAt: now,
      expiresAt,
      clicksCount: 1,
    });

    // Increment partnership metrics asynchronously (non-blocking)
    Partnership.findByIdAndUpdate(partnership._id, {
      $inc: { 'metrics.totalClicks': 1 }
    }).catch(() => {});

    return {
      agent: newAttribution.agent,
      agentCode: newAttribution.agentCode,
      isAttributed: true,
      expiresAt: newAttribution.expiresAt,
    };
  } catch (err) {
    // Handle potential concurrency race condition on unique index (fingerprint + project)
    if (err.code === 11000) {
      const racedAttribution = await Attribution.findOne({ fingerprint, project: projectId });
      if (racedAttribution) {
        return {
          agent: racedAttribution.agent,
          agentCode: racedAttribution.agentCode,
          isAttributed: true,
          expiresAt: racedAttribution.expiresAt,
        };
      }
    }
    throw err;
  }
}

module.exports = {
  computeFingerprint,
  resolveAttribution,
};
