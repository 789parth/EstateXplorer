const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id || user.id,
      role: user.role || 'buyer',
      roles: user.roles || [user.role || 'buyer'],
      email: user.email,
    },
    process.env.JWT_ACCESS_SECRET || 'estatexplorer_access_secret',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id || user.id },
    process.env.JWT_REFRESH_SECRET || 'estatexplorer_refresh_secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
};

const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };

  res.cookie('refreshToken', refreshToken, cookieOptions);

  const userObj = {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    city: user.city || '',
    about: user.about || '',
    role: user.role || 'buyer',
    roles: user.roles && user.roles.length > 0 ? user.roles : [user.role || 'buyer'],
    avatar: user.avatar || '',
    isVerified: user.isVerified || false,
    isPhoneVerified: user.isPhoneVerified || false,
    twoFactorEnabled: user.twoFactorEnabled || false,
    emailNotifications: user.emailNotifications ?? true,
    smsNotifications: user.smsNotifications ?? false,
    builderProfile: user.builderProfile,
    agentProfile: user.agentProfile,
    ownerProfile: user.ownerProfile,
    createdAt: user.createdAt,
  };

  res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: userObj,
      accessToken,
    },
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  sendTokenResponse,
};
