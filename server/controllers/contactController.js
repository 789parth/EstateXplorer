const Contact = require('../models/Contact');
const AppError = require('../utils/AppError');
const { isDisposableEmail, normalizeEmail } = require('../services/disposableEmailService');

// @desc    Submit a contact inquiry message
// @route   POST /api/contact
// @access  Public
exports.submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !phone || !message) {
      return next(new AppError('Please provide name, email, phone, and message', 400));
    }

    // Phone Validation: 10-digit Indian mobile number
    const cleanDigits = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanDigits.length !== 10 || !/^[6-9]\d{9}$/.test(cleanDigits)) {
      return next(new AppError('Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9', 400));
    }

    // 1. Email Normalization & Syntax Validation
    const { normalizedEmail, isValid } = normalizeEmail(email);
    if (!isValid || !normalizedEmail) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    // 2. Anti-Abuse & Disposable / Temporary Email Prevention
    const securityContext = {
      ip: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'] || '',
      botToken: req.body.botToken || req.body.cfTurnstileToken || '',
      honeypot: req.body.hp_website || req.body.honeypot || '',
      formTimeMs: req.body.formTimeMs ? parseInt(req.body.formTimeMs, 10) : 0,
    };

    const disposableCheck = await isDisposableEmail(normalizedEmail, securityContext);
    if (disposableCheck.isDisposable) {
      return next(
        new AppError(
          'Temporary or disposable email addresses cannot be used to submit inquiries. Please use a valid email address from a supported provider.',
          400
        )
      );
    }

    const contact = await Contact.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      subject: subject || 'General Inquiry',
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been received! Our advisory team will reach out shortly.',
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all contact inquiries (admin/support) - excludes and cleans up replied inquiries
// @route   GET /api/contact
// @access  Public / Private
exports.getContactMessages = async (req, res, next) => {
  try {
    // Automatically purge any inquiries from database that were already replied to
    await Contact.deleteMany({
      $or: [
        { replyMessage: { $exists: true, $ne: '' } },
        { repliedAt: { $exists: true, $ne: null } },
      ],
    });

    const contacts = await Contact.find({
      $and: [
        {
          $or: [
            { replyMessage: { $exists: false } },
            { replyMessage: '' },
            { replyMessage: null },
          ],
        },
        {
          $or: [
            { repliedAt: { $exists: false } },
            { repliedAt: null },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update contact inquiry status
// @route   PATCH /api/contact/:id
// @access  Private / Admin
exports.updateContactStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['new', 'in_progress', 'resolved'];

    if (!status || !allowedStatuses.includes(status)) {
      return next(new AppError('Please provide a valid status: new, in_progress, or resolved', 400));
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return next(new AppError('Contact message not found', 404));
    }

    res.status(200).json({
      success: true,
      message: `Inquiry status updated to ${status}`,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete contact inquiry
// @route   DELETE /api/contact/:id
// @access  Private / Admin
exports.deleteContactMessage = async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return next(new AppError('Contact message not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Contact inquiry deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to contact inquiry via email
// @route   POST /api/contact/:id/reply
// @access  Private / Admin
exports.replyToContactMessage = async (req, res, next) => {
  try {
    const { replyMessage } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return next(new AppError('Please enter a reply message to send', 400));
    }

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return next(new AppError('Contact inquiry not found', 404));
    }

    const sendEmail = require('../utils/sendEmail');
    const emailSubject = `Re: ${contact.subject || 'Your Inquiry on EstateXplorer'}`;
    const emailText = `Hello ${contact.name},\n\nThank you for reaching out to EstateXplorer.\n\nOur Response:\n${replyMessage.trim()}\n\n---\nYour Original Inquiry:\n"${contact.message}"\n\nBest regards,\nEstateXplorer Team\nsupport@estatexplorer.in`;

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Estate<span style="color: #3b82f6;">Xplorer</span> Support</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Response to your inquiry</p>
        </div>
        
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Hello <strong>${contact.name}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Thank you for contacting EstateXplorer. Here is our response regarding <em>"${contact.subject || 'General Inquiry'}"</em>:</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <p style="font-size: 14px; line-height: 1.6; color: #1e293b; margin: 0; white-space: pre-wrap;">${replyMessage.trim()}</p>
        </div>
        
        <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #64748b; margin-bottom: 24px;">
          <strong>Your Original Inquiry:</strong><br />
          <span style="font-style: italic;">"${contact.message}"</span>
        </div>
        
        <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          If you have any further questions, feel free to reply to this email.<br />
          <strong>EstateXplorer Team</strong> · <a href="mailto:support@estatexplorer.in" style="color: #3b82f6; text-decoration: none;">support@estatexplorer.in</a>
        </p>
      </div>
    `;

    try {
      await sendEmail({
        email: contact.email,
        subject: emailSubject,
        message: emailText,
        html: emailHtml,
      });
    } catch (emailErr) {
      console.warn('[Contact Reply Email Warning]:', emailErr.message || emailErr);
    }

    // Automatically delete inquiry from database after sending reply
    await Contact.findByIdAndDelete(contact._id);

    res.status(200).json({
      success: true,
      message: `Reply email sent to ${contact.email} and inquiry automatically deleted from database.`,
      data: { _id: contact._id, deleted: true },
    });
  } catch (error) {
    next(error);
  }
};

