const crypto = require('crypto');
const Partnership = require('../models/Partnership');
const Property = require('../models/Property');
const User = require('../models/User');
const { emitToUser, SOCKET_EVENTS } = require('./socketManager');

/**
 * Generates a collision-resistant human-readable agent code
 * e.g., CP-A8F29C
 */
function generateAgentCode() {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CP-${hex}`;
}

/**
 * Agent requests selling rights for a master project
 */
async function requestPartnership(agentId, projectId, message = '') {
  // Verify agent exists and has agent role
  const agent = await User.findById(agentId);
  if (!agent || agent.role !== 'agent') {
    throw new Error('Only registered Channel Partner Agents can request selling rights.');
  }

  // Verify project exists and allows agent acquisition
  const project = await Property.findById(projectId);
  if (!project) {
    throw new Error('Project not found.');
  }
  if (!project.allowAgentAcquisition && !project.networkEnabled) {
    throw new Error('This project is not currently accepting Agent acquisition requests.');
  }

  // Verify builder is different from agent
  if (String(project.builder) === String(agentId)) {
    throw new Error('Builders cannot be channel partners for their own projects.');
  }

  // Check if existing partnership exists
  let partnership = await Partnership.findOne({ agent: agentId, project: projectId });
  if (partnership) {
    if (partnership.status === 'approved') {
      throw new Error('You are already an affiliated agent for this project.');
    }
    if (partnership.status === 'pending') {
      throw new Error('Your acquisition request is already pending review by the builder.');
    }
    // If previously rejected or suspended, allow re-applying by updating to pending
    partnership.status = 'pending';
    partnership.notes = message || partnership.notes;
    partnership.rejectedAt = null;
    await partnership.save();

    // Re-notify builder
    emitToUser(String(project.builder), SOCKET_EVENTS.PARTNERSHIP_REQUEST_CREATED, {
      title: 'New Agent Request',
      message: `${agent.name} re-applied for affiliation on ${project.title}`,
      partnershipId: partnership._id,
      agentId,
      agentName: agent.name,
      agentEmail: agent.email,
      projectId,
      projectTitle: project.title,
      agentCode: partnership.agentCode,
      status: 'pending',
      createdAt: new Date(),
    });

    return partnership;
  }

  // Generate unique agentCode
  let agentCode;
  let isUnique = false;
  while (!isUnique) {
    agentCode = generateAgentCode();
    const existing = await Partnership.findOne({ agentCode });
    if (!existing) isUnique = true;
  }

  partnership = await Partnership.create({
    builder: project.builder,
    agent: agentId,
    project: projectId,
    agentCode,
    commissionRate: project.defaultCommissionRate || 2.5,
    status: 'pending',
    notes: message,
  });

  // Real-time notification to Builder
  emitToUser(String(project.builder), SOCKET_EVENTS.PARTNERSHIP_REQUEST_CREATED, {
    title: 'New Agent Request',
    message: `${agent.name} requested affiliation for ${project.title}`,
    partnershipId: partnership._id,
    agentId,
    agentName: agent.name,
    agentEmail: agent.email,
    projectId,
    projectTitle: project.title,
    agentCode,
    status: 'pending',
    createdAt: partnership.createdAt,
  });

  return partnership;
}

/**
 * Builder approves, rejects, or suspends a partnership request
 */
async function updatePartnershipStatus(builderId, partnershipId, status, commissionRate = null) {
  // Normalize 'accepted' to 'approved'
  const normalizedStatus = status === 'accepted' ? 'approved' : status;

  if (!['approved', 'rejected', 'suspended'].includes(normalizedStatus)) {
    throw new Error(`Invalid partnership status: ${status}`);
  }

  const partnership = await Partnership.findById(partnershipId).populate('project');
  if (!partnership) {
    throw new Error('Partnership record not found.');
  }

  // Enforce builder ownership
  if (String(partnership.builder) !== String(builderId)) {
    throw new Error('Unauthorized. You do not own the project associated with this partnership.');
  }

  // If approving, verify that project still allows agent acquisition
  if (normalizedStatus === 'approved') {
    if (partnership.project && !partnership.project.allowAgentAcquisition && !partnership.project.networkEnabled) {
      throw new Error('Cannot accept request: Project is no longer accepting agent acquisition.');
    }
    partnership.approvedAt = new Date();
    partnership.rejectedAt = null;
    if (commissionRate !== null && commissionRate !== undefined) {
      partnership.commissionRate = Number(commissionRate);
    }
    // Ensure affiliateUrl is generated
    partnership.affiliateUrl = `/property/${partnership.project._id}?agent=${partnership.agentCode}`;
  } else if (normalizedStatus === 'rejected') {
    partnership.rejectedAt = new Date();
    partnership.affiliateUrl = '';
  }

  partnership.status = normalizedStatus;
  await partnership.save();

  // Real-time notification to Agent
  const notifTitle = normalizedStatus === 'approved' 
    ? 'Your Agent Request Has Been Accepted'
    : 'Your Agent Request Has Been Rejected';
  const notifMsg = normalizedStatus === 'approved'
    ? `Congratulations! Your request to become an agent for "${partnership.project?.title || 'the project'}" was approved.`
    : `Your request for "${partnership.project?.title || 'the project'}" was not accepted by the builder.`;

  emitToUser(String(partnership.agent), SOCKET_EVENTS.PARTNERSHIP_STATUS_CHANGED, {
    title: notifTitle,
    message: notifMsg,
    partnershipId: partnership._id,
    status: normalizedStatus,
    projectId: partnership.project?._id,
    projectTitle: partnership.project?.title,
    agentCode: partnership.agentCode,
    affiliateUrl: partnership.affiliateUrl || null,
    commissionRate: partnership.commissionRate,
  });

  return partnership;
}

/**
 * Bulk approve partnership requests by builder
 */
async function bulkApprovePartnerships(builderId, partnershipIds) {
  if (!Array.isArray(partnershipIds) || partnershipIds.length === 0) {
    throw new Error('Please provide an array of partnership IDs.');
  }

  const results = [];
  for (const id of partnershipIds) {
    try {
      const updated = await updatePartnershipStatus(builderId, id, 'approved');
      results.push({ id, success: true, agentCode: updated.agentCode });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Get all partnerships for an agent
 */
async function getAgentPartnerships(agentId) {
  return await Partnership.find({ agent: agentId })
    .populate('project', 'title images price priceDisplay location category status statusLabel allowAgentAcquisition networkEnabled defaultCommissionRate availableUnitsCount')
    .populate('builder', 'name email phone companyName builderProfile')
    .sort({ createdAt: -1 });
}

/**
 * Get all partnerships for a builder (all projects or specific project)
 */
async function getBuilderPartnerships(builderId, projectId = null) {
  const query = { builder: builderId };
  if (projectId) {
    query.project = projectId;
  }

  return await Partnership.find(query)
    .populate('agent', 'name email phone reraNumber agencyName reraCertificate agentProfile')
    .populate('project', 'title priceDisplay location category allowAgentAcquisition networkEnabled images')
    .sort({ createdAt: -1 });
}

module.exports = {
  generateAgentCode,
  requestPartnership,
  updatePartnershipStatus,
  bulkApprovePartnerships,
  getAgentPartnerships,
  getBuilderPartnerships,
};
