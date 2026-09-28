const express = require('express');
const router = express.Router();
const {
  submitContactMessage,
  getContactMessages,
  updateContactStatus,
  deleteContactMessage,
  replyToContactMessage,
} = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(submitContactMessage)
  .get(protect, authorize('admin'), getContactMessages);

router.route('/:id')
  .patch(protect, authorize('admin'), updateContactStatus)
  .delete(protect, authorize('admin'), deleteContactMessage);

router.post('/:id/reply', protect, authorize('admin'), replyToContactMessage);


module.exports = router;
