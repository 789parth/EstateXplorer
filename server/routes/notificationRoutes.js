const express = require('express');
const {
  sendTestSms,
  sendTestEmail,
  getNotificationLogs,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const notificationTestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many test notification requests. Please wait a few minutes before trying again.',
  },
});

router.use(protect);
router.post('/test-sms', notificationTestLimiter, sendTestSms);
router.post('/test-email', notificationTestLimiter, sendTestEmail);
router.get('/logs', getNotificationLogs);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;