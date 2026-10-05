const partnershipService = require('../services/partnershipService');
const Property = require('../models/Property');
const Partnership = require('../models/Partnership');

/**
 * @desc   Discover Projects and Properties available for Channel Partner selling rights
 * @route  GET /api/partnerships/discover
 * @access Private (Agent only)
 */
exports.discoverProjects = async (req, res) => {
  try {
    const { city, search, category } = req.query;
    const query = {
      isActive: true,
      $or: [
        { allowAgentAcquisition: true },
        { networkEnabled: true },
      ],
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (city && city !== 'all') {
      query['location.city'] = new RegExp(city, 'i');
    }
    if (search) {
      query.title = new RegExp(search, 'i');
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    // Parallelize count, property fetch, and agent partnership status in one round-trip
    const [total, projects, myPartnerships] = await Promise.all([
      Property.countDocuments(query),
      Property.find(query)
        .populate('builder', 'name companyName role reraNumber')
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Partnership.find({ agent: req.user._id })
        .select('project status agentCode commissionRate')
        .lean(),
    ]);

    const partnershipMap = {};
    myPartnerships.forEach((p) => {
      partnershipMap[p.project.toString()] = {
        id: p._id,
        status: p.status,
        agentCode: p.agentCode,
        commissionRate: p.commissionRate,
      };
    });

    const results = projects.map((p) => ({
      ...p,
      user: p.builder,
      partnershipStatus: partnershipMap[p._id.toString()]?.status || 'unapplied',
      partnershipDetails: partnershipMap[p._id.toString()] || null,
    }));

    res.status(200).json({
      success: true,
      count: results.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Request selling rights for a Master Project
 * @route  POST /api/partnerships/request
 * @access Private (Agent only)
 */
exports.requestPartnership = async (req, res) => {
  try {
    const { projectId, message } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid projectId.' });
    }

    const partnership = await partnershipService.requestPartnership(req.user._id, projectId, message);

    res.status(201).json({
      success: true,
      message: 'Selling rights application submitted successfully.',
      data: partnership,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Get Agent's active & pending partnerships (Network Inventory)
 * @route  GET /api/partnerships/my-partnerships
 * @access Private (Agent only)
 */
exports.getMyPartnerships = async (req, res) => {
  try {
    const partnerships = await partnershipService.getAgentPartnerships(req.user._id);

    res.status(200).json({
      success: true,
      count: partnerships.length,
      data: partnerships,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Get Builder's incoming Channel Partner requests & approved partners
 * @route  GET /api/partnerships/builder-partnerships
 * @access Private (Builder only)
 */
exports.getBuilderPartnerships = async (req, res) => {
  try {
    const { projectId } = req.query;
    const partnerships = await partnershipService.getBuilderPartnerships(req.user._id, projectId);

    res.status(200).json({
      success: true,
      count: partnerships.length,
      data: partnerships,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Approve, Reject, or Suspend a Channel Partner request
 * @route  PATCH /api/partnerships/:id/status
 * @access Private (Builder only)
 */
exports.updatePartnershipStatus = async (req, res) => {
  try {
    const { status, commissionRate, rejectionReason } = req.body;
    const partnership = await partnershipService.updatePartnershipStatus(
      req.user._id,
      req.params.id,
      status,
      commissionRate,
      rejectionReason
    );

    res.status(200).json({
      success: true,
      message: `Partnership ${status} successfully.`,
      data: partnership,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Bulk approve Channel Partner requests
 * @route  POST /api/partnerships/bulk-approve
 * @access Private (Builder only)
 */
exports.bulkApprovePartnerships = async (req, res) => {
  try {
    const { partnershipIds } = req.body;
    const results = await partnershipService.bulkApprovePartnerships(req.user._id, partnershipIds);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc   Get Agent's partnership status for a specific project
 * @route  GET /api/partnerships/project/:projectId
 * @access Private (Agent only)
 */
exports.getProjectPartnership = async (req, res) => {
  try {
    const partnership = await Partnership.findOne({
      agent: req.user._id,
      project: req.params.projectId,
    })
      .populate('project', 'title allowAgentAcquisition networkEnabled builder')
      .lean();

    res.status(200).json({
      success: true,
      data: partnership || null,
      status: partnership?.status || 'unapplied',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

