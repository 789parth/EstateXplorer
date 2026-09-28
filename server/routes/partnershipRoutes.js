const express = require('express');
const router = express.Router();
const {
  discoverProjects,
  requestPartnership,
  getMyPartnerships,
  getBuilderPartnerships,
  updatePartnershipStatus,
  bulkApprovePartnerships,
  getProjectPartnership,
} = require('../controllers/partnershipController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Agent specific routes
router.get('/discover', protect, authorize('agent'), discoverProjects);
router.post('/request', protect, authorize('agent'), requestPartnership);
router.get('/my-partnerships', protect, authorize('agent'), getMyPartnerships);
router.get('/project/:projectId', protect, authorize('agent'), getProjectPartnership);

// Builder specific routes
router.get('/builder-partnerships', protect, authorize('builder', 'admin'), getBuilderPartnerships);
router.patch('/:id/status', protect, authorize('builder', 'admin'), updatePartnershipStatus);
router.post('/bulk-approve', protect, authorize('builder', 'admin'), bulkApprovePartnerships);

module.exports = router;
