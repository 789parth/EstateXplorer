const crypto = require('crypto');
const Partnership = require('../models/Partnership');
const Property = require('../models/Property');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
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
      throw new Error('You have already applied.');
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
    }).populate('agent', 'name email');

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

      // Notify the unselected applicants via Socket.io and Email
      for (const other of otherPending) {
        const otherAgentId = other.agent?._id ? String(other.agent._id) : String(other.agent);
        emitToUser(otherAgentId, SOCKET_EVENTS.PARTNERSHIP_STATUS_CHANGED, {
          title: 'Agent Application Status',
          message: `Your request for "${property.title}" has not been approved.`,
          partnershipId: other._id,
          status: 'rejected',
          projectId: property._id,
          projectTitle: property.title,
        });

        // Requirement 7: Automatically send rejection email with project or property name
        if (other.agent?.email) {
          const emailSubject = `Agent Application Status — ${property.title}`;
          const emailMessage = `Dear ${other.agent.name || 'Agent Partner'},\n\nThank you for applying to represent "${property.title}" on EstateXplorer.\n\nWe would like to inform you that you have not been selected for "${property.title}" as another agent has been assigned to this listing.\n\nYou are welcome to explore and apply for other active projects and properties on EstateXplorer.\n\nBest regards,\nEstateXplorer Team\nsupport@estatexplorer.in`;
          
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0f172a; margin-top: 0;">Estate<span style="color: #2563eb;">Xplorer</span></h2>
              <h3 style="color: #334155; font-size: 16px;">Agent Application Status Update</h3>
              <p>Dear <strong>${other.agent.name || 'Agent Partner'}</strong>,</p>
              <p>Thank you for submitting your application to represent <strong>${property.title}</strong> on EstateXplorer.</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #475569; font-size: 14px;">
                  We would like to inform you that you have not been selected for <strong>"${property.title}"</strong> as another agent has been approved for this listing.
                </p>
              </div>
              <p style="font-size: 13px; color: #475569;">
                You are encouraged to explore our wide range of active developer projects and exclusive properties to apply for new selling rights.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/agent" style="background: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">Explore Other Projects</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 24px 0;">
              <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; 2026 EstateXplorer. All rights reserved.</p>
            </div>
          `;

          sendEmail({
            email: other.agent.email,
            subject: emailSubject,
            message: emailMessage,
            html: emailHtml,
          }).catch((mailErr) => console.error(`[Agent Rejection Email Error] ${other.agent.email}:`, mailErr.message));
        }
      }
    }
  } else if (normalizedStatus === 'rejected') {
    partnership.rejectedAt = new Date();
    partnership.affiliateUrl = '';
    partnership.agentCode = undefined;
    const projectTitle = partnership.project?.title || property?.title || 'this listing';
    partnership.rejectionReason = String(rejectionReason || `Your request for "${projectTitle}" has not been approved.`).trim().slice(0, 1000);

    // Send individual rejection email
    const agentUser = await User.findById(partnership.agent).select('name email');
    if (agentUser?.email) {
      sendEmail({
        email: agentUser.email,
        subject: `Agent Application Status — ${projectTitle}`,
        message: `Dear ${agentUser.name || 'Agent Partner'},\n\nWe would like to inform you that your request for "${projectTitle}" has not been approved.\n\nBest regards,\nEstateXplorer Team\nsupport@estatexplorer.in`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Estate<span style="color: #2563eb;">Xplorer</span></h2>
            <h3 style="color: #334155; font-size: 16px;">Agent Application Status Update</h3>
            <p>Dear <strong>${agentUser.name || 'Agent Partner'}</strong>,</p>
            <p>We are writing to inform you that your request to represent <strong>${projectTitle}</strong> has not been approved at this time.</p>
            <p style="font-size: 13px; color: #475569;">You are encouraged to explore other projects and properties available on EstateXplorer.</p>
            <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 24px 0;">
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; 2026 EstateXplorer. All rights reserved.</p>
          </div>
        `,
      }).catch((mailErr) => console.error(`[Single Rejection Email Error] ${agentUser.email}:`, mailErr.message));
    }
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
    : 'Your Agent Request Has Not Been Approved';
  const itemType = partnership.project?.category === 'project' ? 'project' : 'property';
  const notifMsg = normalizedStatus === 'approved'
    ? `Congratulations! You have been assigned as the agent for "${partnership.project?.title || itemType}". The property is now public with your contact details!`
    : `Your request for "${partnership.project?.title || itemType}" has not been approved.`;

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

/**
 * Agent voluntarily leaves a partnership with a builder
 * Releases agent assignment from property and notifies builder
 */
async function leavePartnership(agentId, partnershipId, reasonMessage = '') {
  const partnership = await Partnership.findById(partnershipId)
    .populate('project', 'title category builder assignedAgent publishingStatus')
    .populate('agent', 'name email phone')
    .populate('builder', 'name email companyName');

  if (!partnership) {
    throw new Error('Partnership record not found.');
  }

  // Verify ownership: requesting agent must be the partner
  if (String(partnership.agent?._id || partnership.agent) !== String(agentId)) {
    throw new Error('You are not authorized to leave this partnership.');
  }

  // Ensure partnership is currently active/approved
  if (partnership.status !== 'approved') {
    throw new Error('You can only leave active and approved partnerships.');
  }

  const now = new Date();
  partnership.status = 'left';
  partnership.leftAt = now;
  partnership.leaveReason = reasonMessage?.trim() || 'Agent decided to leave listing.';
  partnership.affiliateUrl = '';
  await partnership.save();

  // If the property has this agent assigned, unassign and return to in_inventory so builder can reassign or re-open
  const property = await Property.findById(partnership.project?._id || partnership.project);
  if (property) {
    const isCurrentlyAssigned = String(property.assignedAgent) === String(agentId);
    if (isCurrentlyAssigned) {
      property.assignedAgent = null;
      property.agentAssignedAt = null;
      property.publishingStatus = 'in_inventory';
      property.allowAgentAcquisition = false;
      property.networkEnabled = false;
      await property.save();
    }
  }

  // Notify the Builder/Owner via real-time socket
  const sellerId = partnership.builder?._id ? String(partnership.builder._id) : String(partnership.builder);
  const agentName = partnership.agent?.name || 'Agent';
  const propertyTitle = partnership.project?.title || 'Listing';

  emitToUser(sellerId, SOCKET_EVENTS.PARTNERSHIP_STATUS_CHANGED, {
    title: 'Agent Left Listing',
    message: `${agentName} has left "${propertyTitle}". Reason: ${partnership.leaveReason}`,
    partnershipId: partnership._id,
    status: 'left',
    projectId: partnership.project?._id,
    projectTitle: propertyTitle,
    agentName,
    reason: partnership.leaveReason,
  });

  // Also send Email notification to Builder/Owner if email is configured
  if (partnership.builder?.email) {
    const emailSubject = `Agent Left Listing — ${propertyTitle}`;
    const emailMessage = `Dear ${partnership.builder.companyName || partnership.builder.name || 'Developer/Owner'},\n\nAgent ${agentName} has voluntarily relinquished their representation for "${propertyTitle}".\n\nReason provided by Agent:\n"${partnership.leaveReason}"\n\nThe property status has been reset to inventory. You may re-open it for agent assignment anytime from your builder dashboard.\n\nBest regards,\nEstateXplorer Team\nsupport@estatexplorer.in`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">Estate<span style="color: #2563eb;">Xplorer</span></h2>
        <h3 style="color: #334155; font-size: 16px;">Agent Relinquished Representation</h3>
        <p>Dear <strong>${partnership.builder.companyName || partnership.builder.name || 'Developer/Owner'}</strong>,</p>
        <p>Agent <strong>${agentName}</strong> has voluntarily left their active representation for <strong>${propertyTitle}</strong>.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: bold;">Reason provided by Agent:</p>
          <p style="margin: 6px 0 0; color: #7f1d1d; font-size: 14px; font-style: italic;">&ldquo;${partnership.leaveReason}&rdquo;</p>
        </div>
        <p style="font-size: 13px; color: #475569;">
          The listing has been moved to your inventory. You can re-open it for agent assignment or publish directly anytime from your dashboard.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 24px 0;">
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">&copy; 2026 EstateXplorer. All rights reserved.</p>
      </div>
    `;

    sendEmail({
      email: partnership.builder.email,
      subject: emailSubject,
      message: emailMessage,
      html: emailHtml,
    }).catch((mailErr) => console.error(`[Agent Left Email Error] ${partnership.builder.email}:`, mailErr.message));
  }

  return partnership;
}

module.exports = {
  generateAgentCode,
  requestPartnership,
  updatePartnershipStatus,
  bulkApprovePartnerships,
  getAgentPartnerships,
  getBuilderPartnerships,
  leavePartnership,
};
