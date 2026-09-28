const User = require('../models/User');
const RoleRequest = require('../models/RoleRequest');
const AppError = require('../utils/AppError');
const sendEmail = require('../utils/sendEmail');
const { normalizeEmail } = require('../services/disposableEmailService');
const { memoryCache } = require('../utils/cache');

// Helper to format role names
const formatRoleTitle = (role) => {
  if (!role) return 'Buyer';
  return role.charAt(0).toUpperCase() + role.slice(1);
};

// @desc    Get all role requests (with optional status filter)
// @route   GET /api/admin/role-requests
// @access  Private / Admin
exports.getRoleRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }

    const requests = await RoleRequest.find(filter)
      .populate('userId', 'name email phone city role roles createdAt')
      .populate('reviewedBy', 'name email')
      .sort({ requestedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve a role request
// @route   PATCH /api/admin/role-requests/:id/approve
// @access  Private / Admin
exports.approveRoleRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await RoleRequest.findById(id);
    if (!request) {
      return next(new AppError('Role request not found', 404));
    }

    if (request.status !== 'PENDING') {
      return next(new AppError(`This request has already been ${request.status.toLowerCase()}`, 400));
    }

    const targetUser = await User.findById(request.userId);
    if (!targetUser) {
      return next(new AppError('User associated with this request no longer exists', 404));
    }

    // Grant approved role to user's roles array without forcing active role change
    if (!targetUser.roles || !Array.isArray(targetUser.roles)) {
      targetUser.roles = ['buyer'];
    }
    if (!targetUser.roles.includes(request.requestedRole)) {
      targetUser.roles.push(request.requestedRole);
    }
    // Note: Do not overwrite targetUser.role so the user is not unexpectedly redirected.
    // The user can explicitly switch to this approved role when they choose.
    await targetUser.save();

    // Update request record
    request.status = 'APPROVED';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    const roleTitle = formatRoleTitle(request.requestedRole);

    // Send congratulations approval email
    sendEmail({
      email: targetUser.email,
      subject: `Congratulations! You are now approved as a ${roleTitle}`,
      message: `Congratulations!\n\nYou are now approved as a ${roleTitle}.\n\nYou can now access ${roleTitle}-specific features and permissions on EstateXplorer.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 12px; background: #ecfdf5; border-radius: 50%; color: #059669; font-size: 28px; margin-bottom: 8px;">✓</div>
            <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 22px;">Congratulations!</h2>
            <p style="color: #059669; font-weight: 600; margin: 0; font-size: 16px;">You are now approved as a ${roleTitle}.</p>
          </div>
          <p>Dear <strong>${targetUser.name}</strong>,</p>
          <p>We are pleased to inform you that your request for <strong>${roleTitle}</strong> access on <strong>EstateXplorer</strong> has been approved by an administrator.</p>
          <p>You can now access ${roleTitle}-specific features and permissions, including listing properties, managing projects, and viewing your client leads.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to ${roleTitle} Dashboard</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">If you need to switch between your approved roles at any time, you can do so directly from your Profile settings.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch((err) => {
      console.error('Role approval email failed to send:', err.message);
    });

    res.status(200).json({
      success: true,
      message: `Role request approved. ${targetUser.email} is now authorized as ${roleTitle}.`,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a role request
// @route   PATCH /api/admin/role-requests/:id/reject
// @access  Private / Admin
exports.rejectRoleRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const request = await RoleRequest.findById(id);
    if (!request) {
      return next(new AppError('Role request not found', 404));
    }

    if (request.status !== 'PENDING') {
      return next(new AppError(`This request has already been ${request.status.toLowerCase()}`, 400));
    }

    request.status = 'REJECTED';
    request.rejectionReason = rejectionReason || 'Request was not approved at this time.';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Role request rejected',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Revoke/Cancel an approved role request
// @route   PATCH /api/admin/role-requests/:id/revoke
// @access  Private / Admin
exports.revokeRoleRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await RoleRequest.findById(id);
    if (!request) {
      return next(new AppError('Role request not found', 404));
    }

    const targetUser = await User.findById(request.userId);
    if (targetUser) {
      if (targetUser.roles && Array.isArray(targetUser.roles)) {
        targetUser.roles = targetUser.roles.filter((r) => r !== request.requestedRole);
        if (targetUser.roles.length === 0) {
          targetUser.roles = ['buyer'];
        }
      }
      if (targetUser.role === request.requestedRole) {
        targetUser.role = targetUser.roles.includes('buyer') ? 'buyer' : targetUser.roles[0];
      }
      await targetUser.save();
    }

    request.status = 'REVOKED';
    request.rejectionReason = reason || 'Role cancelled by administrator';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user.id;
    await request.save();

    const roleTitle = formatRoleTitle(request.requestedRole);

    res.status(200).json({
      success: true,
      message: `Role '${roleTitle}' has been cancelled for ${request.email}.`,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Directly grant role access to a user by email
// @route   POST /api/admin/grant-role
// @access  Private / Admin
exports.grantRoleDirectly = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const validRoles = ['builder', 'agent', 'admin', 'owner', 'buyer'];

    if (!email || !role) {
      return next(new AppError('Please provide both user email and target role', 400));
    }

    if (!validRoles.includes(role)) {
      return next(new AppError('Invalid role specified', 400));
    }

    const { normalizedEmail } = normalizeEmail(email);
    if (!normalizedEmail) {
      return next(new AppError('Please provide a valid email address', 400));
    }

    const targetUser = await User.findOne({ email: normalizedEmail });
    if (!targetUser) {
      return next(
        new AppError(
          `No registered user found with email '${email}'. Direct role assignment requires an existing registered account.`,
          404
        )
      );
    }

    // Ensure roles array is initialized
    if (!targetUser.roles || !Array.isArray(targetUser.roles)) {
      targetUser.roles = ['buyer'];
    }

    if (!targetUser.roles.includes(role)) {
      targetUser.roles.push(role);
    }
    // Maintain current active role so user isn't unexpectedly redirected
    if (!targetUser.role) {
      targetUser.role = 'buyer';
    }
    await targetUser.save();

    // Mark any pending role requests for this user & role as approved
    await RoleRequest.updateMany(
      { userId: targetUser._id, requestedRole: role, status: 'PENDING' },
      { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: req.user.id }
    );

    const roleTitle = formatRoleTitle(role);

    // Send congratulations approval email
    sendEmail({
      email: targetUser.email,
      subject: `Congratulations! You are now approved as a ${roleTitle}`,
      message: `Congratulations!\n\nYou are now approved as a ${roleTitle}.\n\nYou can now access ${roleTitle}-specific features and permissions on EstateXplorer.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 12px; background: #ecfdf5; border-radius: 50%; color: #059669; font-size: 28px; margin-bottom: 8px;">✓</div>
            <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 22px;">Congratulations!</h2>
            <p style="color: #059669; font-weight: 600; margin: 0; font-size: 16px;">You are now an approved ${roleTitle}.</p>
          </div>
          <p>Dear <strong>${targetUser.name}</strong>,</p>
          <p>An administrator has directly granted you <strong>${roleTitle}</strong> access on <strong>EstateXplorer</strong>.</p>
          <p>You can now access ${roleTitle}-specific features and permissions.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to ${roleTitle} Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    }).catch((err) => {
      console.error('Role grant email failed to send:', err.message);
    });

    res.status(200).json({
      success: true,
      message: `Role '${role}' successfully granted to ${targetUser.email}`,
      data: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        roles: targetUser.roles,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Directly revoke/cancel a role from a user by email or userId
// @route   POST /api/admin/revoke-role
// @access  Private / Admin
exports.revokeRoleDirectly = async (req, res, next) => {
  try {
    const { email, role, userId } = req.body;
    const validRoles = ['builder', 'agent', 'admin', 'owner'];

    if (!role || !validRoles.includes(role)) {
      return next(new AppError('Invalid role specified. Buyer role cannot be revoked.', 400));
    }

    let targetUser;
    if (userId) {
      targetUser = await User.findById(userId);
    } else if (email) {
      const { normalizedEmail } = normalizeEmail(email);
      targetUser = await User.findOne({ email: normalizedEmail });
    }

    if (!targetUser) {
      return next(new AppError('User not found with provided email/ID', 404));
    }

    // Protect primary administrator account
    if (
      role === 'admin' &&
      (targetUser.email === 'admin@estatexplorer.in' || targetUser._id.toString() === req.user.id)
    ) {
      return next(new AppError('Cannot revoke admin role from the primary administrator account', 403));
    }

    // Remove role from targetUser.roles
    if (targetUser.roles && Array.isArray(targetUser.roles)) {
      targetUser.roles = targetUser.roles.filter((r) => r !== role);
      if (targetUser.roles.length === 0) {
        targetUser.roles = ['buyer'];
      }
    } else {
      targetUser.roles = ['buyer'];
    }

    // Fallback active role to 'buyer' if it was the revoked role
    if (targetUser.role === role) {
      targetUser.role = targetUser.roles.includes('buyer') ? 'buyer' : targetUser.roles[0];
    }

    await targetUser.save();

    // Mark any approved RoleRequests as REVOKED
    await RoleRequest.updateMany(
      { userId: targetUser._id, requestedRole: role, status: 'APPROVED' },
      { status: 'REVOKED', reviewedAt: new Date(), reviewedBy: req.user.id, rejectionReason: 'Role access cancelled by administrator' }
    );

    const roleTitle = formatRoleTitle(role);

    res.status(200).json({
      success: true,
      message: `Successfully cancelled '${roleTitle}' role for ${targetUser.email}`,
      data: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        roles: targetUser.roles,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users list for admin review
// @route   GET /api/admin/users
// @access  Private / Admin
exports.getUsers = async (req, res, next) => {
  try {
    const { search, role } = req.query;
    const filter = {};

    if (role) {
      filter.roles = role;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('name email phone city role roles createdAt isVerified isBlocked blockedReason authProvider')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account and cascade delete user assets
// @route   DELETE /api/admin/users/:id
// @access  Private / Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return next(new AppError('User not found', 404));
    }

    // Prevent deleting own account or root admin
    if (
      targetUser._id.toString() === req.user.id.toString() ||
      targetUser.email === 'admin@estatexplorer.in'
    ) {
      return next(new AppError('Cannot delete main administrator account', 403));
    }

    // Cascade delete user and all associated data by ID and email
    const { cascadeDeleteAllUserData } = require('../services/cascadeDeleteService');
    await cascadeDeleteAllUserData({ userId: targetUser._id, email: targetUser.email });

    res.status(200).json({
      success: true,
      message: `User '${targetUser.email}' and all associated data have been permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Block or Unblock a user account
// @route   PATCH /api/admin/users/:id/toggle-block
// @access  Private / Admin
exports.toggleBlockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason } = req.body;

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return next(new AppError('User not found', 404));
    }

    // Prevent blocking own account or root admin
    if (
      targetUser._id.toString() === req.user.id.toString() ||
      targetUser.email === 'admin@estatexplorer.in'
    ) {
      return next(new AppError('Cannot block or suspend main administrator account', 403));
    }

    const newBlockedState = typeof isBlocked === 'boolean' ? isBlocked : !targetUser.isBlocked;
    targetUser.isBlocked = newBlockedState;
    targetUser.blockedReason = newBlockedState
      ? (reason || 'Your account access has been suspended by an administrator.')
      : '';

    await targetUser.save();

    res.status(200).json({
      success: true,
      message: newBlockedState
        ? `User '${targetUser.email}' has been blocked from accessing the platform.`
        : `User '${targetUser.email}' access has been successfully restored.`,
      data: {
        id: targetUser._id,
        email: targetUser.email,
        isBlocked: targetUser.isBlocked,
        blockedReason: targetUser.blockedReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

