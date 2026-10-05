const NotificationLog = require('../models/NotificationLog');
const { sendSmsGateway } = require('../services/smsNotificationService');
const sendEmail = require('../utils/sendEmail');
const AppError = require('../utils/AppError');

exports.sendTestSms = async (req, res, next) => {
  try {
    const targetPhone = req.body.phone || req.user.phone;
    if (!targetPhone) {
      return next(new AppError('Phone number is required. Please update your profile or provide a phone number.', 400));
    }

    const testMessage =
      req.body.message ||
      `[EstateXplorer] SMS Notification System Verification: Hello ${req.user.name || 'Valued User'}, your SMS alerts are active and verified. EstateXplorer updates will be delivered here.`;

    const result = await sendSmsGateway({
      phone: targetPhone,
      message: testMessage,
      type: 'TEST_ALERT',
      recipient: req.user,
      metadata: {
        initiatedBy: req.user._id,
        test: true,
      },
    });

    let responseMessage = '';
    if (result.success) {
      if (result.isLive) {
        responseMessage = `Live SMS alert dispatched successfully to +91 ${result.phone} via ${result.gateway.toUpperCase()}!`;
      } else {
        responseMessage = `SMS alert simulated successfully for +91 ${result.phone}. (Sandbox mode: Live cellular dispatch requires FAST2SMS_API_KEY in server/.env)`;
      }
    } else {
      responseMessage = `Failed to dispatch SMS: ${result.reason || 'Gateway error'}`;
    }

    res.status(200).json({
      success: result.success,
      message: responseMessage,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.sendTestEmail = async (req, res, next) => {
  try {
    const targetEmail = req.body.email || req.user.email;
    if (!targetEmail) {
      return next(new AppError('Email address is required to send test email alert', 400));
    }

    await sendEmail({
      email: targetEmail,
      subject: 'EstateXplorer Alert Gateway: Email Notifications Active',
      message: `Hello ${req.user.name || 'User'},\n\nThis is a test notification confirming that your EstateXplorer email notifications are active and properly configured.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; padding: 12px; background: #eff6ff; border-radius: 50%; color: #2563eb; font-size: 24px; margin-bottom: 8px;">🔔</div>
            <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Email Notifications Active</h2>
            <p style="color: #64748b; font-size: 14px; margin-top: 4px;">EstateXplorer Notification System</p>
          </div>
          <p>Hello <strong>${req.user.name || 'User'}</strong>,</p>
          <p>This email confirms that your <strong>EstateXplorer Email Notifications</strong> are fully operational.</p>
          <p>You will receive timely alerts for:</p>
          <ul style="color: #334155; font-size: 13px; line-height: 1.8;">
            <li>New buyer inquiries and booking requests</li>
            <li>Site visit scheduling and tour confirmations</li>
            <li>Direct property status updates and advisory messages</li>
          </ul>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/profile" style="background: #2563eb; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">Manage Preferences</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
        </div>
      `,
    });

    res.status(200).json({
      success: true,
      message: `Test email alert dispatched successfully to ${targetEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotificationLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.user.role !== 'admin') {
      const orClauses = [{ recipient: req.user._id }];
      if (req.user.phone) {
        orClauses.push({ recipientPhone: req.user.phone.replace(/\D/g, '').slice(-10) });
      }
      query = { $or: orClauses };
    }

    // Parallelize count, unread count, and paginated logs retrieval in one round-trip
    const [total, unreadCount, logs] = await Promise.all([
      NotificationLog.countDocuments(query),
      NotificationLog.countDocuments({ ...query, isRead: false }),
      NotificationLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      unreadCount,
      page,
      pages: Math.ceil(total / limit),
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filter = { _id: id };
    if (req.user.role !== 'admin') {
      filter.recipient = req.user._id;
    }

    const notification = await NotificationLog.findOneAndUpdate(
      filter,
      { $set: { isRead: true } },
      { new: true }
    ).lean();

    if (!notification) {
      // Check if it exists for another user vs not found
      const exists = await NotificationLog.exists({ _id: id });
      if (exists) {
        return next(new AppError('Not authorized to update this notification', 403));
      }
      return next(new AppError('Notification not found', 404));
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      const orClauses = [{ recipient: req.user._id }];
      if (req.user.phone) {
        orClauses.push({ recipientPhone: req.user.phone.replace(/\D/g, '').slice(-10) });
      }
      query = { $or: orClauses };
    }

    await NotificationLog.updateMany({ ...query, isRead: false }, { $set: { isRead: true } });

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};
