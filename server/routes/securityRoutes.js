const express = require('express');
const {
  getSecurityStats,
  getAuditLogs,
  getSecurityLists,
  addSecurityListEntry,
  removeSecurityListEntry,
  getSecurityPolicy,
  updateSecurityPolicy,
  checkEmailRisk,
} = require('../controllers/securityController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Enforce authentication AND admin role for all /api/security routes
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getSecurityStats);
router.get('/audit-logs', getAuditLogs);

router.route('/lists')
  .get(getSecurityLists)
  .post(addSecurityListEntry);

router.delete('/lists/:id', removeSecurityListEntry);

router.route('/policy')
  .get(getSecurityPolicy)
  .patch(updateSecurityPolicy);

router.post('/check-email', checkEmailRisk);

module.exports = router;
