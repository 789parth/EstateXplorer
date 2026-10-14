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
  leavePartnership,
} = require('../controllers/partnershipController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Agent specific routes
router.get('/discover', protect, authorize('agent'), discoverProjects);
router.post('/request', protect, authorize('agent'), requestPartnership);
router.get('/my-partnerships', protect, authorize('agent'), getMyPartnerships);
router.get('/project/:projectId', protect, authorize('agent'), getProjectPartnership);
router.post('/:id/leave', protect, authorize('agent'), leavePartnership);

// Seller (Builder & Owner) specific routes
router.get('/builder-partnerships', protect, authorize('builder', 'owner', 'admin'), getBuilderPartnerships);
router.patch('/:id/status', protect, authorize('builder', 'owner', 'admin'), updatePartnershipStatus);
router.post('/bulk-approve', protect, authorize('builder', 'owner', 'admin'), bulkApprovePartnerships);

module.exports = router;
