const express = require('express');
const {
  createProperty,
  getProperties,
  getProperty,
  recordPropertyAttribution,
  getFeatured,
  getMyProperties,
  updateProperty,
  deleteProperty,
  submitInquiry,
  getMyInquiries,
  getBuyerInquiries,
  updateInquiryStatus,
  deleteInquiry,
  bulkDeleteInquiries,
  replyToPropertyInquiry,
  payTokenAmount,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getUserWishlist,
  toggleWishlist,
  openPropertyForAgent,
  publishPropertyDirect,
  getPropertyAgentPerformance,
} = require('../controllers/propertyController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../utils/cache');

const router = express.Router();

router
  .route('/')
  .get(cacheMiddleware('properties:list', 60), getProperties)
  .post(protect, createProperty);

router.get('/featured', cacheMiddleware('properties:featured', 60), getFeatured);
router.get('/:id/attribution', recordPropertyAttribution);

router.get('/mine', protect, getMyProperties);

// Wishlist routes
router.get('/wishlist', protect, getUserWishlist);
router.post('/wishlist/:id', protect, toggleWishlist);

// Agent Workflow Lifecycle routes (Spec Agent Workflow §1, §4, §9)
router.post('/:id/open-for-agent', protect, openPropertyForAgent);
router.post('/:id/publish-direct', protect, publishPropertyDirect);
router.get('/:id/agent-performance', protect, getPropertyAgentPerformance);

// Inquiry routes
router.get('/inquiries/mine', protect, getMyInquiries);
router.get('/inquiries/buyer', protect, getBuyerInquiries);
router.post('/inquiries/bulk-delete', protect, bulkDeleteInquiries);
router.post('/inquiries/:id/pay-token', protect, payTokenAmount);
router.post('/inquiries/:id/razorpay/create-order', protect, createRazorpayOrder);
router.post('/inquiries/:id/razorpay/verify-payment', protect, verifyRazorpayPayment);
router.patch('/inquiries/:id', protect, updateInquiryStatus);
router.delete('/inquiries/:id', protect, deleteInquiry);
router.post('/inquiries/:id/reply', protect, replyToPropertyInquiry);

router
  .route('/:id')
  .get(optionalAuth, getProperty)
  .patch(protect, updateProperty)
  .delete(protect, deleteProperty);

// Inquiry submission: allow both authenticated and guest users (controller handles both)
router.post('/:id/inquiry', optionalAuth, submitInquiry);

module.exports = router;

