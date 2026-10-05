const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers?.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      throw new Error('JWT access secret is not configured securely.');
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    // Attach user to req
    const user = await User.findById(decoded.id)
      .select('name email role roles isVerified isBlocked blockedReason')
      .lean();
    if (!user) {
      return next(new AppError('No user found with this id', 401));
    }

    if (user.isBlocked) {
      return next(
        new AppError(
          user.blockedReason || 'Your account access has been suspended by an administrator. Please contact support.',
          403
        )
      );
    }

    const approvedRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['buyer'];
    const activeRole = approvedRoles.includes(user.role) ? user.role : 'buyer';

    req.user = {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: activeRole,
      roles: approvedRoles,
      isVerified: user.isVerified,
      isBlocked: user.isBlocked,
    };

    next();
  } catch (err) {
    return next(new AppError('Not authorized to access this route', 401));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// optionalAuth - attaches user if token present, continues even without token
const optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers?.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next(); // no token — just continue as guest

  try {
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      return next();
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );
    const user = await User.findById(decoded.id)
      .select('name email role roles isVerified isBlocked blockedReason')
      .lean();
    if (user && !user.isBlocked) {
      const approvedRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['buyer'];
      const activeRole = approvedRoles.includes(user.role) ? user.role : 'buyer';

      req.user = {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: activeRole,
        roles: approvedRoles,
        isVerified: user.isVerified,
        isBlocked: user.isBlocked,
      };
    }
    next();
  } catch (err) {
    next(); // continue as guest if token invalid
  }
};

module.exports = { protect, authorize, optionalAuth };
