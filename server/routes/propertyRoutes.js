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
  getUserWishlist,
  toggleWishlist,
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

// Inquiry routes
router.get('/inquiries/mine', protect, getMyInquiries);
router.get('/inquiries/buyer', protect, getBuyerInquiries);
router.post('/inquiries/bulk-delete', protect, bulkDeleteInquiries);
router.patch('/inquiries/:id', protect, updateInquiryStatus);
router.delete('/inquiries/:id', protect, deleteInquiry);
router.post('/inquiries/:id/reply', protect, replyToPropertyInquiry);

router
  .route('/:id')
  .get(cacheMiddleware('properties:detail', 60), getProperty)
  .patch(protect, updateProperty)
  .delete(protect, deleteProperty);

// Inquiry submission: allow both authenticated and guest users (controller handles both)
router.post('/:id/inquiry', optionalAuth, submitInquiry);

module.exports = router;

