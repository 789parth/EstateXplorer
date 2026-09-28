const rateLimit = require('express-rate-limit');

/**
 * Lightweight Express rate limiter for authentication endpoints
 * (Registration, Login, Forgot-Password).
 *
 * Configurable via:
 * - AUTH_RATE_LIMIT_WINDOW_MS (default: 900000 ms / 15 minutes)
 * - AUTH_RATE_LIMIT_MAX (default: 20 requests per window)
 */
const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
    });
  },
});

module.exports = {
  authRateLimiter,
};
