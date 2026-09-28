const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const OTP = require('../models/OTP');
const RoleRequest = require('../models/RoleRequest');
const AppError = require('../utils/AppError');
const { sendTokenResponse, generateAccessToken } = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { normalizeEmail, isDisposableEmail } = require('../services/disposableEmailService');
const {
  normalizeTitleCase,
  normalizePhoneNumber,
  normalizeCode,
} = require('../utils/formatters');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, builderProfile, agentProfile, ownerProfile } = req.body;

    const { normalizedEmail } = normalizeEmail(email);
    if (!normalizedEmail) {
      return next(new AppError('Please provide a valid email', 400));
    }

    // Check if disposable/temporary email or high-risk registration
    const securityContext = {
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'] || '',
      botToken: req.body.botToken || req.body.cfTurnstileToken || '',
      honeypot: req.body.hp_website || req.body.honeypot || '',
      formTimeMs: req.body.formTimeMs ? parseInt(req.body.formTimeMs, 10) : 0,
    };
    const disposableCheck = await isDisposableEmail(normalizedEmail, securityContext);
    if (disposableCheck.isDisposable || disposableCheck.decision === 'BLOCK') {
      const isMailboxOrDnsError = disposableCheck.rejectionCategory === 'MAILBOX_NOT_FOUND' || disposableCheck.rejectionCategory === 'DNS_MX_INVALID';
      const statusCode = isMailboxOrDnsError ? 400 : 403;
      return next(
        new AppError(
          disposableCheck.publicMessage ||
            (isMailboxOrDnsError
              ? 'This email address does not exist or cannot receive emails. Please provide an active, existing email address.'
              : 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.'),
          statusCode
        )
      );
    }
    if (disposableCheck.decision === 'STEP_UP_CHALLENGE') {
      return res.status(403).json({
        success: false,
        requiresChallenge: true,
        message: disposableCheck.publicMessage || 'Security verification required.',
      });
    }
    if (disposableCheck.decision === 'TEMPORARY_REVIEW') {
      return res.status(429).json({
        success: false,
        message: disposableCheck.publicMessage || 'Too many registration attempts. Please try again later.',
      });
    }

    // Check if email already exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return next(new AppError('Email is already registered. Please log in.', 400));
    }

    // Requested role from registration form
    const requestedRole = req.body.role && ['buyer', 'owner', 'builder', 'agent', 'admin'].includes(req.body.role)
      ? req.body.role
      : 'buyer';

    // STRICT ROLE SECURITY: Users CANNOT sign up directly with privileged roles (builder, agent, owner, admin)
    // If a non-buyer role is requested during sign-up, reject immediately with 403 Forbidden
    if (requestedRole !== 'buyer') {
      return next(
        new AppError(
          `Sign-up with the '${requestedRole}' role is not permitted without prior administrator approval. Please sign up as Buyer and submit a role request from your dashboard.`,
          403
        )
      );
    }

    // All new sign-ups are strictly registered with role: 'buyer' and roles: ['buyer']
    const activeRole = 'buyer';
    const userRoles = ['buyer'];

    const user = await User.create({
      name: normalizeTitleCase(name),
      email: normalizedEmail,
      phone: normalizePhoneNumber(phone),
      password,
      role: activeRole,
      roles: userRoles,
      builderProfile: builderProfile || undefined,
      agentProfile: agentProfile || undefined,
      ownerProfile: ownerProfile || undefined,
    });

    // Send welcome greeting email asynchronously
    sendEmail({
      email: user.email,
      subject: 'Welcome to EstateXplorer!',
      message: `Welcome, ${user.name}! Thank you for registering on EstateXplorer as a Buyer.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin-top: 10px;">Welcome to EstateXplorer!</h2>
          </div>
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>Thank you for creating an account on <strong>EstateXplorer</strong> as a <strong>Buyer</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="background: #1e3a8a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Get Started</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch(err => {
      console.error('Welcome email failed to send:', err.message);
    });

    sendTokenResponse(user, 201, res, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Send Registration Email OTP
// @route   POST /api/auth/register-send-otp
// @access  Public
exports.sendRegistrationOTP = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const { normalizedEmail } = normalizeEmail(email);
    if (!normalizedEmail) {
      return next(new AppError('Please provide a valid email address', 400));
    }

    // Security context & Disposable Email Check
    const securityContext = {
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'] || '',
      botToken: req.body.botToken || req.body.cfTurnstileToken || '',
      honeypot: req.body.hp_website || req.body.honeypot || '',
      formTimeMs: req.body.formTimeMs ? parseInt(req.body.formTimeMs, 10) : 0,
    };

    const disposableCheck = await isDisposableEmail(normalizedEmail, securityContext);
    if (disposableCheck.isDisposable || disposableCheck.decision === 'BLOCK') {
      const isMailboxOrDnsError = disposableCheck.rejectionCategory === 'MAILBOX_NOT_FOUND' || disposableCheck.rejectionCategory === 'DNS_MX_INVALID';
      const statusCode = isMailboxOrDnsError ? 400 : 403;
      return next(
        new AppError(
          disposableCheck.publicMessage ||
            (isMailboxOrDnsError
              ? 'This email address does not exist or cannot receive emails. Please provide an active, existing email address.'
              : 'Access Blocked: Temporary or disposable email addresses are not permitted. Please use a valid email address from a supported provider.'),
          statusCode
        )
      );
    }
    if (disposableCheck.decision === 'STEP_UP_CHALLENGE') {
      return res.status(403).json({
        success: false,
        requiresChallenge: true,
        message: disposableCheck.publicMessage || 'Security verification required.',
      });
    }
    if (disposableCheck.decision === 'TEMPORARY_REVIEW') {
      return res.status(429).json({
        success: false,
        message: disposableCheck.publicMessage || 'Too many registration attempts. Please try again later.',
      });
    }

    // Check if email already registered
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return next(new AppError('Email is already registered. Please sign in.', 400));
    }

    // Strictly enforce buyer-only registration
    const requestedRole = role && ['buyer', 'owner', 'builder', 'agent', 'admin'].includes(role)
      ? role
      : 'buyer';

    if (requestedRole !== 'buyer') {
      return next(
        new AppError(
          `Sign-up with the '${requestedRole}' role is not permitted without prior administrator approval. Please sign up as Buyer and submit a role request from your dashboard.`,
          403
        )
      );
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clear previous pending OTPs for this email with email_verify purpose
    await OTP.deleteMany({ email: normalizedEmail, purpose: 'email_verify' });
    await OTP.create({
      email: normalizedEmail,
      code: otpCode,
      purpose: 'email_verify',
      expiresAt,
    });

    console.log('📧 Registration Email Verification OTP generated for %s: %s', normalizedEmail, otpCode);

    // Send verification email
    const recipientName = name ? normalizeTitleCase(name) : 'Valued User';
    sendEmail({
      email: normalizedEmail,
      subject: 'EstateXplorer - Verify Your Email to Create Your Account',
      message: `Hello ${recipientName}, your verification code is ${otpCode}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 520px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 16px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #0f172a; color: #38bdf8; font-weight: 800; font-size: 20px; padding: 10px 18px; border-radius: 12px; margin-bottom: 12px;">
              EstateXplorer
            </div>
            <h2 style="color: #0f172a; margin: 8px 0 4px 0; font-size: 22px;">Confirm Your Email Address</h2>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Complete your registration by entering this 6-digit code</p>
          </div>
          <p style="font-size: 14px; line-height: 1.6;">Hello <strong>${recipientName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">Thank you for registering on EstateXplorer. Please use the following 6-digit verification code to confirm your email address:</p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; background: #f1f5f9; padding: 14px 28px; border-radius: 12px; border: 1px solid #cbd5e1; display: inline-block; font-family: 'Courier New', monospace;">${otpCode}</span>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">This code is valid for <strong>10 minutes</strong>. If you did not request this registration, please disregard this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 24px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch(err => {
      console.error('Failed to send registration OTP email:', err.message);
    });

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email address.',
      email: normalizedEmail,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Registration OTP and Create User (Auto-Login)
// @route   POST /api/auth/register-verify-otp
// @access  Public
exports.verifyRegistrationOTP = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, code, otp, builderProfile, agentProfile, ownerProfile } = req.body;
    const otpInput = (code || otp || '').toString().trim();

    if (!otpInput) {
      return next(new AppError('Please provide the 6-digit verification code', 400));
    }

    const { normalizedEmail } = normalizeEmail(email);
    if (!normalizedEmail) {
      return next(new AppError('Please provide a valid email address', 400));
    }

    // Double-check existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(new AppError('An account with this email already exists. Please log in.', 400));
    }

    // Verify OTP record
    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      code: otpInput,
      purpose: 'email_verify',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return next(new AppError('Invalid or expired verification code. Please request a new one.', 400));
    }

    // Strict role validation
    const requestedRole = role && ['buyer', 'owner', 'builder', 'agent', 'admin'].includes(role)
      ? role
      : 'buyer';

    if (requestedRole !== 'buyer') {
      return next(
        new AppError(
          `Sign-up with the '${requestedRole}' role is not permitted without prior administrator approval.`,
          403
        )
      );
    }

    // Create user with isVerified: true
    const user = await User.create({
      name: normalizeTitleCase(name),
      email: normalizedEmail,
      phone: normalizePhoneNumber(phone),
      password,
      role: 'buyer',
      roles: ['buyer'],
      isVerified: true,
      builderProfile: builderProfile || undefined,
      agentProfile: agentProfile || undefined,
      ownerProfile: ownerProfile || undefined,
    });

    // Delete used OTP
    await OTP.findByIdAndDelete(otpRecord._id);

    // Send welcome email asynchronously
    sendEmail({
      email: user.email,
      subject: 'Welcome to EstateXplorer - Account Verified!',
      message: `Welcome, ${user.name}! Your account has been verified and created successfully.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 520px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 16px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 8px 0;">Welcome to EstateXplorer! 🎉</h2>
            <p style="color: #10b981; font-weight: bold; font-size: 14px; margin: 0;">✓ Email Verified Successfully</p>
          </div>
          <p>Dear <strong>${user.name}</strong>,</p>
          <p>Your EstateXplorer account is now active and verified. You can explore luxury properties, schedule verified site visits, and connect directly with builders and owners.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="background: #0f172a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Explore Properties</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch(err => console.error('Welcome email error:', err.message));

    // Automatically log user in with tokens and 201 Created
    sendTokenResponse(user, 201, res, 'Email verified and account created successfully!');
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    const { normalizedEmail } = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return next(new AppError('Please provide an email and password', 400));
    }

    // Find user & include password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        notRegistered: true,
        email: normalizedEmail,
        message: 'No account found with this email address. Please register to create an account.',
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if account uses a disposable domain
    const disposableCheck = await isDisposableEmail(user.email);
    if (disposableCheck.isDisposable) {
      return next(
        new AppError(
          'Access Blocked: Accounts registered with temporary or disposable email addresses are prohibited.',
          403
        )
      );
    }

    // Check if user is blocked by administrator
    if (user.isBlocked) {
      return next(
        new AppError(
          user.blockedReason ||
            'Access Blocked: Your account access has been suspended by an administrator. Please contact support.',
          403
        )
      );
    }

    // Ensure roles array is initialized
    if (!user.roles || user.roles.length === 0) {
      user.roles = [user.role || 'buyer'];
    }

    // STRICT ROLE SECURITY CHECK:
    // If the user selected a role during login other than 'buyer' (e.g. 'agent', 'builder', 'owner', 'admin')
    if (role && role !== 'buyer') {
      const isApproved = user.roles.includes(role);
      if (!isApproved) {
        // Check if there is a pending request
        const pendingReq = await RoleRequest.findOne({
          userId: user._id,
          requestedRole: role,
          status: 'PENDING',
        });

        if (pendingReq) {
          return next(
            new AppError(
              `Your request for the '${role}' role is pending administrator review. You can only log in as Buyer until approved.`,
              403
            )
          );
        }

        const rejectedReq = await RoleRequest.findOne({
          userId: user._id,
          requestedRole: role,
          status: 'REJECTED',
        });

        if (rejectedReq) {
          return next(
            new AppError(
              `Your request for the '${role}' role was declined. Please log in as Buyer or submit a new request from your profile.`,
              403
            )
          );
        }

        return next(
          new AppError(
            `You do not have approved access for the '${role}' role. Please log in as Buyer or request access from your profile.`,
            403
          )
        );
      }

      // Approved! Set active role to chosen role
      user.role = role;
      await user.save();
    } else if (role === 'buyer') {
      user.role = 'buyer';
      await user.save();
    }

    // Two-Factor Authentication Check
    if (user.twoFactorEnabled) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      await OTP.deleteMany({ email: user.email, purpose: 'two_factor' });
      await OTP.create({
        email: user.email,
        code: otpCode,
        purpose: 'two_factor',
        expiresAt,
      });

      console.log('🔐 Generated 2FA OTP for %s: %s', user.email, otpCode);

      sendEmail({
        email: user.email,
        subject: 'Your EstateXplorer Two-Factor Authentication Code',
        message: `Your login verification code is ${otpCode}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 500px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Two-Factor Authentication</h2>
            <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 0;">EstateXplorer Account Security</p>
            <p>Hello <strong>${user.name}</strong>,</p>
            <p>You are attempting to sign in to your EstateXplorer account. Use the verification code below to complete your login:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; background: #f1f5f9; padding: 12px 24px; border-radius: 8px; display: inline-block;">${otpCode}</span>
            </div>
            <p style="font-size: 13px; color: #64748b;">This code expires in 10 minutes. If you did not request this login code, please secure your account immediately.</p>
            <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 20px 0;">
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
          </div>
        `,
      }).catch((err) => console.error('2FA email send error:', err.message));

      return res.status(200).json({
        success: true,
        require2FA: true,
        email: user.email,
        role: user.role,
        message: 'Two-factor authentication code sent to your email',
      });
    }

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    res.cookie('refreshToken', '', {
      httpOnly: true,
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (Cookie)
exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return next(new AppError('Refresh token missing', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'estatexplorer_refresh_secret'
      );
    } catch (err) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    if (user.isBlocked) {
      return next(new AppError(user.blockedReason || 'Your account access has been suspended by an administrator.', 403));
    }

    const approvedRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['buyer'];
    const activeRole = approvedRoles.includes(user.role) ? user.role : 'buyer';
    if (user.role !== activeRole) {
      user.role = activeRole;
      await user.save();
    }

    const accessToken = generateAccessToken(user);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          city: user.city || '',
          about: user.about || '',
          role: activeRole,
          roles: approvedRoles,
          avatar: user.avatar || '',
          isVerified: user.isVerified || false,
          isPhoneVerified: user.isPhoneVerified || false,
          twoFactorEnabled: user.twoFactorEnabled || false,
          emailNotifications: typeof user.emailNotifications === 'boolean' ? user.emailNotifications : true,
          smsNotifications: typeof user.smsNotifications === 'boolean' ? user.smsNotifications : false,
          builderProfile: user.builderProfile,
          agentProfile: user.agentProfile,
          ownerProfile: user.ownerProfile,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const approvedRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['buyer'];
    const activeRole = approvedRoles.includes(user.role) ? user.role : 'buyer';
    if (user.role !== activeRole) {
      user.role = activeRole;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        city: user.city || '',
        state: user.state || '',
        about: user.about || '',
        role: activeRole,
        roles: approvedRoles,
        avatar: user.avatar || '',
        isVerified: user.isVerified || false,
        isPhoneVerified: user.isPhoneVerified || false,
        twoFactorEnabled: user.twoFactorEnabled || false,
        emailNotifications: typeof user.emailNotifications === 'boolean' ? user.emailNotifications : true,
        smsNotifications: typeof user.smsNotifications === 'boolean' ? user.smsNotifications : false,
        builderProfile: user.builderProfile,
        agentProfile: user.agentProfile,
        ownerProfile: user.ownerProfile,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { normalizedEmail } = normalizeEmail(email);

    if (!normalizedEmail) {
      return next(new AppError('Please provide a valid email', 400));
    }

    // Check disposable email: if disposable, return generic response and do NOT send email
    const disposableCheck = await isDisposableEmail(normalizedEmail);
    if (disposableCheck.isDisposable) {
      return res.status(200).json({
        success: true,
        message: 'If the account exists, a password reset email has been sent.',
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Return generic response without revealing whether an account exists
      return res.status(200).json({
        success: true,
        message: 'If the account exists, a password reset email has been sent.',
      });
    }

    // Generate 6 digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Clear old OTPs for this email
    await OTP.deleteMany({ email: normalizedEmail });

    // Save new OTP
    await OTP.create({
      email: normalizedEmail,
      code: otpCode,
      purpose: 'password_reset',
      expiresAt,
    });

    console.log('🔑 Generated OTP for %s: %s', normalizedEmail, otpCode);

    const message = `Your EstateXplorer password reset OTP is ${otpCode}. It is valid for 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628;">
        <h2>EstateXplorer Password Reset</h2>
        <p>You requested a password reset. Use the OTP below to complete the process:</p>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1e3a8a; margin: 20px 0;">
          ${otpCode}
        </div>
        <p>This code is valid for 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset OTP - EstateXplorer',
        message,
        html,
      });

      res.status(200).json({
        success: true,
        message: 'OTP sent to email',
      });
    } catch (emailError) {
      await OTP.deleteMany({ email: normalizedEmail });
      return next(new AppError('Email could not be sent. Please try again later.', 500));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const otp = req.body.otp || req.body.code;
    const { normalizedEmail } = normalizeEmail(email);

    if (!normalizedEmail || !otp) {
      return next(new AppError('Please provide email and OTP', 400));
    }

    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      code: otp,
      purpose: 'password_reset',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 mins

    await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        resetPasswordToken,
        resetPasswordExpire,
      }
    );

    // Delete used OTP
    await OTP.findByIdAndDelete(otpRecord._id);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      resetToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password with Direct OTP or Reset Token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken, password, newPassword, email } = req.body;
    const code = req.body.code || req.body.otp;
    const newPass = newPassword || password;

    if (!newPass) {
      return next(new AppError('Please provide a new password', 400));
    }

    // Flow 1: Direct 6-digit OTP Code verification
    if (code && email) {
      const { normalizedEmail } = normalizeEmail(email);
      if (!normalizedEmail) {
        return next(new AppError('Please provide a valid email', 400));
      }

      const otpRecord = await OTP.findOne({
        email: normalizedEmail,
        code,
        purpose: 'password_reset',
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        return next(new AppError('Invalid or expired OTP code', 400));
      }

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return next(new AppError('User not found', 404));
      }

      user.password = newPass;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      // Delete used OTP
      await OTP.findByIdAndDelete(otpRecord._id);

      return sendTokenResponse(user, 200, res, 'Password reset successfully! You are now logged in.');
    }

    // Flow 2: Reset Token verification
    if (resetToken) {
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
        return next(new AppError('Invalid or expired reset token', 400));
      }

      // Set new password
      user.password = newPass;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return sendTokenResponse(user, 200, res, 'Password reset successful. Please log in.');
    }

    return next(new AppError('Please provide your 6-digit OTP code or reset token, along with your new password', 400));
  } catch (error) {
    next(error);
  }
};

// @desc    Update Profile Details
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, city, state, about, avatar, emailNotifications, smsNotifications, twoFactorEnabled, builderProfile, agentProfile, ownerProfile } = req.body;

    const fieldsToUpdate = {};
    if (req.body.email) {
      const { normalizedEmail } = normalizeEmail(req.body.email);
      if (normalizedEmail && req.user && normalizedEmail !== req.user.email) {
        const disposableCheck = await isDisposableEmail(normalizedEmail, {
          ip: req.ip || '',
          userAgent: req.headers?.['user-agent'] || '',
        });
        if (disposableCheck.isDisposable) {
          return next(new AppError(disposableCheck.publicMessage || 'Temporary or disposable email addresses are not allowed.', 400));
        }
        const userExists = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user._id } });
        if (userExists) {
          return next(new AppError('Email address is already registered to another account', 400));
        }
        fieldsToUpdate.email = normalizedEmail;
        fieldsToUpdate.isVerified = false; // Require re-verification for changed email address
      }
    }
    if (name !== undefined) fieldsToUpdate.name = normalizeTitleCase(name);
    if (phone !== undefined) {
      const normalizedPhone = normalizePhoneNumber(phone);
      fieldsToUpdate.phone = normalizedPhone;
      // If phone number has been genuinely changed to a different 10-digit number, reset phone verification status
      const cleanNew = String(normalizedPhone).replace(/\D/g, '').slice(-10);
      const cleanExisting = String(req.user?.phone || '').replace(/\D/g, '').slice(-10);
      if (cleanExisting && cleanNew && cleanNew !== cleanExisting) {
        fieldsToUpdate.isPhoneVerified = false;
      }
    }
    if (city !== undefined) fieldsToUpdate.city = normalizeTitleCase(city);
    if (state !== undefined) fieldsToUpdate.state = normalizeTitleCase(state);
    if (about !== undefined) fieldsToUpdate.about = about.trim();
    if (avatar !== undefined) fieldsToUpdate.avatar = avatar.trim();
    if (emailNotifications !== undefined) fieldsToUpdate.emailNotifications = Boolean(emailNotifications);
    if (smsNotifications !== undefined) {
      const activePhone = fieldsToUpdate.phone !== undefined ? fieldsToUpdate.phone : req.user.phone;
      const cleanDigits = activePhone ? String(activePhone).replace(/\D/g, '') : '';
      const hasValidPhone = Boolean(cleanDigits.length === 10 && /^[6-9]\d{9}$/.test(cleanDigits));
      const isVerified = fieldsToUpdate.isPhoneVerified !== undefined ? fieldsToUpdate.isPhoneVerified : (req.user.isPhoneVerified || false);
      
      // SMS notifications can only be enabled if user has a verified phone number
      if (Boolean(smsNotifications) && (!hasValidPhone || !isVerified)) {
        return next(new AppError('Phone verification required. Please verify your mobile number with OTP via Twilio before enabling SMS notifications.', 400));
      }
      fieldsToUpdate.smsNotifications = Boolean(smsNotifications) && hasValidPhone && isVerified;
    }
    if (twoFactorEnabled !== undefined) fieldsToUpdate.twoFactorEnabled = Boolean(twoFactorEnabled);
    
    if (builderProfile !== undefined) {
      const bp = { ...builderProfile };
      if (bp.companyName) bp.companyName = bp.companyName.trim();
      if (bp.displayName) bp.displayName = bp.displayName.trim();
      if (bp.city) bp.city = normalizeTitleCase(bp.city);
      if (bp.reraId) bp.reraId = normalizeCode(bp.reraId);
      if (bp.pan) bp.pan = normalizeCode(bp.pan);
      if (bp.gst) bp.gst = normalizeCode(bp.gst);
      if (bp.cin) bp.cin = normalizeCode(bp.cin);
      if (bp.phone) bp.phone = normalizePhoneNumber(bp.phone);
      if (bp.alternatePhone) bp.alternatePhone = normalizePhoneNumber(bp.alternatePhone);
      if (bp.whatsapp) bp.whatsapp = normalizePhoneNumber(bp.whatsapp);
      fieldsToUpdate.builderProfile = bp;
    }

    if (agentProfile !== undefined) {
      const ap = { ...agentProfile };
      if (ap.agencyName) ap.agencyName = ap.agencyName.trim();
      if (ap.displayName) ap.displayName = ap.displayName.trim();
      if (ap.city) ap.city = normalizeTitleCase(ap.city);
      if (ap.state) ap.state = normalizeTitleCase(ap.state);
      if (ap.reraId) ap.reraId = normalizeCode(ap.reraId);
      if (ap.phone) ap.phone = normalizePhoneNumber(ap.phone);
      if (ap.whatsapp) ap.whatsapp = normalizePhoneNumber(ap.whatsapp);
      fieldsToUpdate.agentProfile = ap;
    }

    if (ownerProfile !== undefined) {
      const op = { ...ownerProfile };
      if (op.city) op.city = normalizeTitleCase(op.city);
      if (op.state) op.state = normalizeTitleCase(op.state);
      if (op.phone) op.phone = normalizePhoneNumber(op.phone);
      fieldsToUpdate.ownerProfile = op;
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        city: user.city || '',
        state: user.state || '',
        about: user.about || '',
        role: user.role,
        roles: user.roles && user.roles.length > 0 ? user.roles : [user.role || 'buyer'],
        avatar: user.avatar || '',
        isVerified: user.isVerified || false,
        isPhoneVerified: user.isPhoneVerified || false,
        twoFactorEnabled: user.twoFactorEnabled || false,
        emailNotifications: typeof user.emailNotifications === 'boolean' ? user.emailNotifications : true,
        smsNotifications: typeof user.smsNotifications === 'boolean' ? user.smsNotifications : false,
        builderProfile: user.builderProfile,
        agentProfile: user.agentProfile,
        ownerProfile: user.ownerProfile,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const currentPassword = req.body.currentPassword || req.body.oldPassword;
    const { newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new AppError('Please provide current and new password', 400));
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth Login & Sign-up
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = async (req, res, next) => {
  try {
    const {
      token,
      idToken,
      credential,
      role,
      intent = 'login',
      email: clientEmail,
      name: clientName,
      picture: clientPicture,
      sub: clientSub,
      googleId: clientGoogleId,
    } = req.body;

    let email = clientEmail || req.body.email;
    let name = clientName || req.body.name;
    let picture = clientPicture || req.body.picture;
    let googleId = clientSub || clientGoogleId || req.body.googleId;
    const rawToken = token || idToken || credential || req.body.token || req.body.idToken;

    // Verify or decode token if provided
    if (rawToken) {
      try {
        if (process.env.GOOGLE_CLIENT_ID) {
          const ticket = await googleClient.verifyIdToken({
            idToken: rawToken,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (payload) {
            email = payload.email || email;
            name = payload.name || name;
            picture = payload.picture || picture;
            googleId = payload.sub || googleId;
          }
        }
      } catch (err) {
        try {
          const decoded = jwt.decode(rawToken);
          if (decoded && decoded.email) {
            email = decoded.email || email;
            name = decoded.name || name;
            picture = decoded.picture || picture;
            googleId = decoded.sub || googleId;
          }
        } catch (decodeErr) {
          console.error('JWT fallback decode failed:', decodeErr.message);
        }
      }
    }

    if (!email) {
      return next(new AppError('Invalid Google authentication payload. Email is required.', 400));
    }

    const { normalizedEmail } = normalizeEmail(email);
    if (!normalizedEmail) {
      return next(new AppError('Invalid Google account email format.', 400));
    }

    // Check disposable email for Google signup
    const securityContext = {
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'] || '',
    };
    const disposableCheck = await isDisposableEmail(normalizedEmail, securityContext);
    if (disposableCheck.isDisposable) {
      return next(new AppError(disposableCheck.publicMessage || 'Temporary or disposable email addresses are not allowed.', 400));
    }

    if (!googleId) {
      googleId = 'google_' + Buffer.from(normalizedEmail).toString('hex').slice(0, 16);
    }
    if (!name) {
      name = normalizedEmail.split('@')[0];
    }

    // Selected role from frontend (buyer, owner, builder, agent, admin)
    const chosenRole = role && ['buyer', 'owner', 'builder', 'agent', 'admin'].includes(role)
      ? role
      : 'buyer';

    // Find existing user by exact normalizedEmail first, then by googleId
    let user = await User.findOne({ email: normalizedEmail });
    if (!user && googleId) {
      user = await User.findOne({ googleId });
    }

    if (user) {
      // Check if user is blocked by administrator
      if (user.isBlocked) {
        return next(
          new AppError(
            user.blockedReason || 'Your account access has been suspended by an administrator. Please contact support.',
            403
          )
        );
      }

      // Link existing local account to Google
      user.googleId = googleId;
      user.authProvider = 'google';
      if (picture && !user.avatar) user.avatar = picture;
      if (!user.roles || user.roles.length === 0) {
        user.roles = ['buyer'];
      }

      // STRICT ROLE SECURITY CHECK for Google Sign-in:
      if (chosenRole && chosenRole !== 'buyer') {
        const isApproved = user.roles.includes(chosenRole);
        if (!isApproved) {
          const pendingReq = await RoleRequest.findOne({
            userId: user._id,
            requestedRole: chosenRole,
            status: 'PENDING',
          });

          if (pendingReq) {
            return next(
              new AppError(
                `Your request for the '${chosenRole}' role is pending administrator review. You cannot sign in with the '${chosenRole}' role until approved.`,
                403
              )
            );
          }

          return next(
            new AppError(
              `You do not have approved access for the '${chosenRole}' role. You cannot sign in with the '${chosenRole}' role. Please sign in as Buyer or apply for role access from your profile.`,
              403
            )
          );
        }
        user.role = chosenRole;
      } else if (chosenRole === 'buyer' || !chosenRole) {
        user.role = 'buyer';
      }
      await user.save();
    } else {
      // Check if user was attempting to log in rather than register
      if (intent === 'login') {
        return res.status(404).json({
          success: false,
          notRegistered: true,
          email: normalizedEmail,
          message: 'Account does not exist. Please register first.',
        });
      }

      // Brand new Google user trying to sign up:
      // STRICT SECURITY: Cannot sign up directly into unapproved role
      if (chosenRole && chosenRole !== 'buyer') {
        return next(
          new AppError(
            `Sign-up with the '${chosenRole}' role is not permitted without prior administrator approval. Please sign up as Buyer and apply for '${chosenRole}' access from your dashboard.`,
            403
          )
        );
      }

      // Create brand new Google user - default is strictly 'buyer' with roles ['buyer']
      const userRoles = ['buyer'];

      user = await User.create({
        name,
        email: normalizedEmail,
        googleId,
        authProvider: 'google',
        role: 'buyer',
        roles: userRoles,
        avatar: picture || '',
        isVerified: true, // Google accounts are pre-verified
      });

      // Send welcome email (fire and forget)
      sendEmail({
        email: user.email,
        subject: 'Welcome to EstateXplorer!',
        message: `Welcome, ${user.name}! You have successfully signed in with Google on EstateXplorer as a Buyer.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a;">Welcome to EstateXplorer!</h2>
            <p>Dear <strong>${user.name}</strong>,</p>
            <p>You have successfully signed in with Google on <strong>EstateXplorer</strong> as a <strong>Buyer</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="background: #1e3a8a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Get Started</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 20px 0;">
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
          </div>
        `,
      }).catch((err) => console.error('Welcome email failed:', err.message));
    }

    sendTokenResponse(user, 200, res, 'Google sign-in successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Submit a role access request
// @route   POST /api/auth/request-role
// @access  Private
exports.requestRole = async (req, res, next) => {
  try {
    const { requestedRole } = req.body;
    const validRoles = ['builder', 'agent', 'owner'];

    if (requestedRole === 'admin') {
      return next(new AppError('Admin role cannot be self-requested. Contact system administration.', 403));
    }

    if (!requestedRole || !validRoles.includes(requestedRole)) {
      return next(new AppError('Invalid role requested. Allowed roles: builder, agent, owner', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if user already has approved access to this role
    const userRoles = user.roles || [user.role || 'buyer'];
    if (userRoles.includes(requestedRole)) {
      return res.status(200).json({
        success: true,
        message: `You already have approved access to the '${requestedRole}' role. You can switch to it anytime.`,
        data: { alreadyApproved: true, role: requestedRole },
      });
    }

    // Check for existing pending request
    const existingPending = await RoleRequest.findOne({
      userId: user._id,
      requestedRole,
      status: 'PENDING',
    });

    if (existingPending) {
      return next(new AppError(`You already have a pending request for the '${requestedRole}' role. Please wait for admin review.`, 400));
    }

    // Create new role request
    const roleRequest = await RoleRequest.create({
      userId: user._id,
      email: user.email,
      currentRole: user.role || 'buyer',
      requestedRole,
      status: 'PENDING',
      requestedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Request for '${requestedRole}' role submitted successfully. It is now pending admin approval.`,
      data: roleRequest,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's role requests
// @route   GET /api/auth/my-role-requests
// @access  Private
exports.getMyRoleRequests = async (req, res, next) => {
  try {
    const requests = await RoleRequest.find({ userId: req.user.id }).sort({ requestedAt: -1 });
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Switch user's current active role to an approved role
// @route   POST /api/auth/switch-role
// @access  Private
exports.switchRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['buyer', 'builder', 'agent', 'admin', 'owner'];

    if (!role || !validRoles.includes(role)) {
      return next(new AppError('Invalid role specified', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const approvedRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role || 'buyer'];

    // Buyer role is always accessible to all users
    if (role !== 'buyer' && !approvedRoles.includes(role)) {
      return next(new AppError(`You do not have approved access for the '${role}' role. Please request access from your profile and wait for administrator approval.`, 403));
    }

    user.role = role;
    await user.save();

    sendTokenResponse(user, 200, res, `Active role switched to ${role}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account
// @route   DELETE /api/auth/delete-account
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    const { cascadeDeleteAllUserData } = require('../services/cascadeDeleteService');

    // Cascade delete user and all associated data by ID and email
    await cascadeDeleteAllUserData({ userId, email: userEmail });

    // Clear refresh token cookie
    res.cookie('refreshToken', '', {
      httpOnly: true,
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      message: 'Account and all associated data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Aliases for route handlers
exports.verifyOtp = exports.verifyOTP;
exports.changePassword = exports.updatePassword;

// @desc    Verify 2FA login OTP
// @route   POST /api/auth/verify-2fa
// @access  Public
exports.verify2FALogin = async (req, res, next) => {
  try {
    const { email, code, role } = req.body;
    const { normalizedEmail } = normalizeEmail(email);

    if (!normalizedEmail || !code) {
      return next(new AppError('Please provide email and 6-digit verification code', 400));
    }

    const otpRecord = await OTP.findOne({
      email: normalizedEmail,
      code: code.toString().trim(),
      purpose: 'two_factor',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return next(new AppError('Invalid or expired verification code', 400));
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.isBlocked) {
      return next(new AppError(user.blockedReason || 'Your account access has been suspended.', 403));
    }

    if (role && user.roles && user.roles.includes(role)) {
      user.role = role;
      await user.save();
    }

    await OTP.findByIdAndDelete(otpRecord._id);

    sendTokenResponse(user, 200, res, 'Two-factor verification successful. Logged in.');
  } catch (error) {
    next(error);
  }
};

// @desc    Resend 2FA login OTP
// @route   POST /api/auth/resend-2fa
// @access  Public
exports.resend2FA = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { normalizedEmail } = normalizeEmail(email);

    if (!normalizedEmail) {
      return next(new AppError('Please provide a valid email', 400));
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.twoFactorEnabled) {
      return next(new AppError('Two-factor authentication is not enabled for this account', 400));
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.deleteMany({ email: user.email, purpose: 'two_factor' });
    await OTP.create({
      email: user.email,
      code: otpCode,
      purpose: 'two_factor',
      expiresAt,
    });

    console.log('🔁 Resent 2FA OTP for %s: %s', user.email, otpCode);

    sendEmail({
      email: user.email,
      subject: 'Your EstateXplorer Two-Factor Authentication Code',
      message: `Your login verification code is ${otpCode}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 500px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Two-Factor Authentication</h2>
          <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 0;">EstateXplorer Account Security</p>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>You requested a new verification code to sign in to your EstateXplorer account:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; background: #f1f5f9; padding: 12px 24px; border-radius: 8px; display: inline-block;">${otpCode}</span>
          </div>
          <p style="font-size: 13px; color: #64748b;">This code expires in 10 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch((err) => console.error('2FA resend email error:', err.message));

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle Two-Factor Authentication
// @route   PATCH /api/auth/toggle-2fa
// @access  Private
exports.toggleTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const newStatus = typeof req.body.enabled === 'boolean' ? req.body.enabled : !user.twoFactorEnabled;
    user.twoFactorEnabled = newStatus;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled,
      },
      message: `Two-factor authentication ${user.twoFactorEnabled ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Email Verification OTP
// @route   POST /api/auth/send-verify-email
// @access  Private
exports.sendVerifyEmailOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified',
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OTP.deleteMany({ email: user.email, purpose: 'email_verify' });
    await OTP.create({
      email: user.email,
      code: otpCode,
      purpose: 'email_verify',
      expiresAt,
    });

    console.log('📧 Generated Email Verification OTP for %s: %s', user.email, otpCode);

    sendEmail({
      email: user.email,
      subject: 'EstateXplorer - Verify Your Email Address',
      message: `Your verification code is ${otpCode}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #0a1628; max-width: 500px; margin: 0 auto; border: 1px solid #e2e6ee; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Verify Your Email</h2>
          <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 0;">EstateXplorer Account Verification</p>
          <p>Hello <strong>${user.name}</strong>,</p>
          <p>Please enter the 6-digit verification code below to verify your email address:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; background: #f1f5f9; padding: 12px 24px; border-radius: 8px; display: inline-block;">${otpCode}</span>
          </div>
          <p style="font-size: 13px; color: #64748b;">This code expires in 10 minutes. If you did not request this verification, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e6ee; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch((err) => console.error('Verification email send error:', err.message));

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email
// @access  Private
exports.verifyEmail = async (req, res, next) => {
  try {
    const code = req.body.code || req.body.otp;
    if (!code) {
      return next(new AppError('Please provide the 6-digit verification code', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const otpRecord = await OTP.findOne({
      email: user.email,
      code: code.toString().trim(),
      purpose: 'email_verify',
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return next(new AppError('Invalid or expired verification code', 400));
    }

    user.isVerified = true;
    await user.save();

    await OTP.findByIdAndDelete(otpRecord._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        isVerified: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send Mobile Phone Verification OTP via Twilio
// @route   POST /api/auth/send-phone-otp
// @access  Private
exports.sendPhoneVerificationOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const rawPhone = req.body.phone || user.phone;
    if (!rawPhone) {
      return next(new AppError('Please enter a phone number to verify', 400));
    }

    const cleanDigits = String(rawPhone).replace(/\D/g, '').slice(-10);
    if (cleanDigits.length !== 10 || !/^[6-9]\d{9}$/.test(cleanDigits)) {
      return next(new AppError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9', 400));
    }

    const { sendTwilioPhoneOtp } = require('../services/smsNotificationService');
    const result = await sendTwilioPhoneOtp({ phone: cleanDigits });

    if (!result.success) {
      return next(new AppError(result.message || 'Failed to dispatch phone verification code', 500));
    }

    res.status(200).json({
      success: true,
      message: result.message || 'Verification code sent to your mobile number.',
      phone: cleanDigits,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Mobile Phone Verification OTP via Twilio
// @route   POST /api/auth/verify-phone-otp
// @access  Private
exports.verifyPhoneOTP = async (req, res, next) => {
  try {
    const code = req.body.code || req.body.otp;
    if (!code || String(code).trim().length !== 6) {
      return next(new AppError('Please provide the 6-digit verification code', 400));
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const rawPhone = req.body.phone || user.phone;
    if (!rawPhone) {
      return next(new AppError('No phone number specified to verify', 400));
    }

    const cleanDigits = String(rawPhone).replace(/\D/g, '').slice(-10);
    const { verifyTwilioPhoneOtp } = require('../services/smsNotificationService');
    const verifyRes = await verifyTwilioPhoneOtp({ phone: cleanDigits, code: String(code).trim() });

    if (!verifyRes.success) {
      return next(new AppError(verifyRes.message || 'Invalid or expired verification code', 400));
    }

    // Save phone, verified status, and enable SMS notifications directly
    const formattedPhone = normalizePhoneNumber(cleanDigits);
    user.phone = formattedPhone;
    user.isPhoneVerified = true;
    user.smsNotifications = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mobile number verified successfully via Twilio! SMS notifications have been enabled.',
      data: {
        id: user._id,
        phone: user.phone,
        isPhoneVerified: true,
        smsNotifications: true,
      },
    });
  } catch (error) {
    next(error);
  }
};


