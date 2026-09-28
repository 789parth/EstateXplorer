const express = require('express');
const router = express.Router();
const {
  createUnits,
  getProjectUnits,
  bookUnit,
  getMyBookings,
  markCommissionPaid,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public / Authenticated read units
router.get('/projects/:projectId/units', getProjectUnits);

// Builder unit management
router.post('/projects/:projectId/units', protect, authorize('builder', 'admin'), createUnits);

// Booking execution
router.post('/book', protect, authorize('agent', 'builder', 'admin'), bookUnit);

// Booking views
router.get('/my-bookings', protect, getMyBookings);

// Commission settlement
router.patch('/:id/commission-paid', protect, authorize('builder', 'admin'), markCommissionPaid);

module.exports = router;
