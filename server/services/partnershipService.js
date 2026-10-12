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
  // Verify agent exists and has agent role — fetch verification status
  const agent = await User.findById(agentId).select('name email role roles kycVerification roleKycVerification').lean();
  if (!agent || (agent.role !== 'agent' && !agent.roles?.includes('agent'))) {
    throw new Error('Only registered Channel Partner Agents can request selling rights.');
  }

  // Enforce Agent Document Verification Gate:
  // Even if user has builder KYC verified, they CANNOT request selling rights without agent document verification
  const agentKycStatus = agent.roleKycVerification?.agent?.status || (agent.kycVerification?.roleAtSubmission === 'agent' ? agent.kycVerification?.status : 'unverified');
  if (agentKycStatus !== 'verified') {
    const err = new Error('Agent document verification is mandatory before requesting selling rights or affiliate partnerships.');
    err.statusCode = 403;
    err.requiresKyc = true;
    err.kycStatus = agentKycStatus;
    throw err;
  }

  // Verify project or property exists and allows agent acquisition — fetch only needed fields
  const project = await Property.findById(projectId)
    .select('title builder allowAgentAcquisition networkEnabled category defaultCommissionRate')
    .lean();
  if (!project) {
    throw new Error('Listing not found.');
  }
  if (!project.builder) {
    throw new Error('Listing does not have an associated seller.');
  }
  if (!project.allowAgentAcquisition && !project.networkEnabled) {
    const itemType = project.category === 'project' ? 'project' : 'property';
    throw new Error(`This ${itemType} is not currently accepting Agent acquisition requests.`);
  }

  // Seller ID (builder or owner user)
  const sellerId = project.builder;

  // Verify seller is different from agent
  if (String(sellerId) === String(agentId)) {
    throw new Error('You cannot be an affiliate agent for your own listing.');
  }

  // Check if existing partnership exists
  let partnership = await Partnership.findOne({ agent: agentId, project: projectId });
  if (partnership) {
    if (partnership.status === 'approved') {
      throw new Error(`You are already an affiliated agent for this ${project.category === 'project' ? 'project' : 'property'}.`);
    }
    if (partnership.status === 'pending') {
      throw new Error('Your acquisition request is already pending review by the seller.');
    }
    // If previously rejected or suspended, allow re-applying by updating to pending
    partnership.status = 'pending';
    partnership.proposalNotes = message || partnership.proposalNotes;
    partnership.agentCode = undefined;
    partnership.affiliateUrl = '';
    partnership.rejectedAt = null;
    await partnership.save();

    // Re-notify seller
    emitToUser(String(sellerId), SOCKET_EVENTS.PARTNERSHIP_REQUEST_CREATED, {
      title: 'New Agent Request',
      message: `${agent.name} re-applied for affiliation on ${project.title}`,
      partnershipId: partnership._id,
      agentId,
      agentName: agent.name,
      agentEmail: agent.email,
      projectId,
      projectTitle: project.title,
      status: 'pending',
      createdAt: new Date(),
    });

    return partnership;
  }

  partnership = await Partnership.create({
    builder: sellerId,
    agent: agentId,
    project: projectId,
    commissionRate: project.defaultCommissionRate || 2.5,
    status: 'pending',
    proposalNotes: message,
  });

  // Real-time notification to Seller
  emitToUser(String(sellerId), SOCKET_EVENTS.PARTNERSHIP_REQUEST_CREATED, {
    title: 'New Agent Request',
    message: `${agent.name} requested affiliation for ${project.title}`,
    partnershipId: partnership._id,
    agentId,
    agentName: agent.name,
    agentEmail: agent.email,
    projectId,
    projectTitle: project.title,
    status: 'pending',
    createdAt: partnership.createdAt,
  });

  return partnership;
}

/**
 * Seller approves, rejects, or suspends a partnership request
 */
async function updatePartnershipStatus(builderId, partnershipId, status, commissionRate = null, rejectionReason = '') {
  // Normalize 'accepted' to 'approved'
  const normalizedStatus = status === 'accepted' ? 'approved' : status;

  if (!['approved', 'rejected', 'suspended'].includes(normalizedStatus)) {
    throw new Error(`Invalid partnership status: ${status}`);
  }

  const partnership = await Partnership.findById(partnershipId).populate('project');
  if (!partnership) {
    throw new Error('Partnership record not found.');
  }

  // Enforce seller ownership
  if (String(partnership.builder) !== String(builderId)) {
    throw new Error('Unauthorized. You do not own the project or property associated with this partnership.');
  }

  // If approving, verify that property exists and has no other agent assigned
  if (normalizedStatus === 'approved') {
    const property = await Property.findById(partnership.project?._id || partnership.project);
    if (!property) {
      throw new Error('Associated property not found.');
    }

    if (property.assignedAgent && String(property.assignedAgent) !== String(partnership.agent)) {
      throw new Error('Only one Agent can be assigned to a property/project at a time. This property already has an assigned Agent.');
    }

    partnership.approvedAt = new Date();
    partnership.rejectedAt = null;
    if (!partnership.agentCode) {
      let candidateCode;
      do {
        candidateCode = generateAgentCode();
      } while (await Partnership.exists({ agentCode: candidateCode }));
      partnership.agentCode = candidateCode;
    }
    if (commissionRate !== null && commissionRate !== undefined) {
      partnership.commissionRate = Number(commissionRate);
    }
    // Ensure affiliateUrl is generated
    partnership.affiliateUrl = `/property/${property._id}?agent=${partnership.agentCode}`;

    // Assign Agent to Property & Publish to Public Website (Spec Agent Workflow §3 & §5)
    property.assignedAgent = partnership.agent;
    property.publishingStatus = 'published_with_agent';
    property.agentAssignedAt = new Date();
    property.allowAgentAcquisition = false;
    property.networkEnabled = false;
    await property.save();

    // Invalidate properties cache so the listing is immediately visible publicly
    const { memoryCache } = require('../utils/cache');
    memoryCache.clear('properties');

    // Rule §3 & §9: Multiple agents can apply, but only one is assigned; reject other pending applicants
    const otherPending = await Partnership.find({
      project: property._id,
      _id: { $ne: partnership._id },
      status: 'pending',
    });

    if (otherPending.length > 0) {
      await Partnership.updateMany(
        { project: property._id, _id: { $ne: partnership._id }, status: 'pending' },
        {
          $set: {
            status: 'rejected',
            rejectionReason: 'Another agent was selected and assigned to this property.',
            rejectedAt: new Date(),
          },
        }
      );

      // Notify the unselected applicants
      for (const other of otherPending) {
        emitToUser(String(other.agent), SOCKET_EVENTS.PARTNERSHIP_STATUS_CHANGED, {
          title: 'Agent Application Status',
          message: `Another agent was selected for "${property.title}". You were not assigned.`,
          partnershipId: other._id,
          status: 'rejected',
          projectId: property._id,
          projectTitle: property.title,
        });
      }
    }
  } else if (normalizedStatus === 'rejected') {
    partnership.rejectedAt = new Date();
    partnership.affiliateUrl = '';
    partnership.agentCode = undefined;
    partnership.rejectionReason = String(rejectionReason || 'Application was declined by the owner.').trim().slice(0, 1000);
  } else if (normalizedStatus === 'suspended') {
    partnership.affiliateUrl = '';
    partnership.agentCode = undefined;
    partnership.rejectionReason = String(rejectionReason || '').trim().slice(0, 1000);
  }

  partnership.status = normalizedStatus;
  await partnership.save();

  // Real-time notification to Agent
  const notifTitle = normalizedStatus === 'approved' 
    ? 'Your Agent Request Has Been Accepted'
    : 'Your Agent Request Has Been Rejected';
  const itemType = partnership.project?.category === 'project' ? 'project' : 'property';
  const notifMsg = normalizedStatus === 'approved'
    ? `Congratulations! You have been assigned as the agent for "${partnership.project?.title || itemType}". The property is now public with your contact details!`
    : `Your request for "${partnership.project?.title || itemType}" was not accepted by the seller.`;

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
    .populate('project', 'title images price priceDisplay location category propertyType purpose bhk area status statusLabel allowAgentAcquisition networkEnabled defaultCommissionRate availableUnitsCount')
    .populate('builder', 'name companyName role reraNumber')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
}

/**
 * Get all partnerships for a seller (builder or owner)
 */
async function getBuilderPartnerships(builderId, projectId = null) {
  const query = { builder: builderId };
  if (projectId) {
    query.project = projectId;
  }

  return await Partnership.find(query)
    .populate('agent', 'name email phone reraNumber agencyName')
    .populate('project', 'title priceDisplay location category propertyType purpose bhk area allowAgentAcquisition networkEnabled images')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
}

module.exports = {
  generateAgentCode,
  requestPartnership,
  updatePartnershipStatus,
  bulkApprovePartnerships,
  getAgentPartnerships,
  getBuilderPartnerships,
};
