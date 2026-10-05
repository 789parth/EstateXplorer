const express = require('express');
const { body } = require('express-validator');
const {
  getRoleRequests,
  approveRoleRequest,
  rejectRoleRequest,
  revokeRoleRequest,
  grantRoleDirectly,
  revokeRoleDirectly,
  getUsers,
  deleteUser,
  toggleBlockUser,
  getKycRequests,
  approveKycRequest,
  rejectKycRequest,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const validate = require('../middleware/validateMiddleware');

const router = express.Router();

// Enforce authentication AND admin role for all /api/admin routes
router.use(protect);
router.use(authorize('admin'));

// KYC Document Verification Management for Builder, Agent, Owner
router.get('/kyc-requests', getKycRequests);
router.patch('/kyc-requests/:userId/approve', approveKycRequest);
router.patch('/kyc-requests/:userId/reject', rejectKycRequest);

// Role request management
router.get('/role-requests', getRoleRequests);
router.patch('/role-requests/:id/approve', approveRoleRequest);
router.patch('/role-requests/:id/reject', rejectRoleRequest);
router.patch('/role-requests/:id/revoke', revokeRoleRequest);

// Direct role assignment and revocation
router.post(
  '/grant-role',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['builder', 'agent', 'admin', 'owner', 'buyer']).withMessage('Valid role is required'),
    validate,
  ],
  grantRoleDirectly
);

router.post(
  '/revoke-role',
  [
    body('role').isIn(['builder', 'agent', 'admin', 'owner']).withMessage('Valid non-buyer role is required to revoke'),
    validate,
  ],
  revokeRoleDirectly
);

// User directory & management
router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/toggle-block', toggleBlockUser);

module.exports = router;

