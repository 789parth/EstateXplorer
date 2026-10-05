const sendEmail = require('../utils/sendEmail');
const NotificationLog = require('../models/NotificationLog');

/**
 * Sends a real-time lead notification email to property owner/builder/agent
 * when a buyer inquires or books a site visit, respecting seller email preferences.
 */
async function notifySellerOnNewLeadEmail({ sellerUser, inquiry, property }) {
  if (!sellerUser || !sellerUser.email) {
    return { skipped: true, reason: 'NO_SELLER_EMAIL' };
  }

  // Check email notifications preference
  if (sellerUser.emailNotifications === false) {
    return { skipped: true, reason: 'SELLER_EMAIL_NOTIFICATIONS_DISABLED' };
  }

  const { projectLeadForUser } = require('./leadPrivacyService');
  const safeInquiry = projectLeadForUser(inquiry, sellerUser);

  const propTitle = property?.title || inquiry?.propertyTitle || 'Property Listing';
  const buyerName = inquiry?.name || 'A prospective buyer';
  const buyerEmail = safeInquiry?.email || 'N/A';
  const buyerPhone = safeInquiry?.phone || 'N/A';
  const buyerMessage = safeInquiry?.message || 'I am interested in this property.';
  const isVisit = Boolean(inquiry.visitRequested || inquiry.visitDate);

  const subject = isVisit
    ? `EstateXplorer: New Site Visit Tour Booked for "${propTitle}"`
    : `EstateXplorer: New Lead Inquired for "${propTitle}"`;

  const dashboardUrl = `${process.env.CLIENT_URL || 'https://estatexplorer.com'}/dashboard`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 12px; background: #eff6ff; border-radius: 50%; color: #2563eb; font-size: 24px; margin-bottom: 8px;">
          ${isVisit ? '📅' : '📩'}
        </div>
        <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 22px;">
          ${isVisit ? 'New Site Visit Appointment' : 'New Buyer Lead Alert'}
        </h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">EstateXplorer Real-Time Lead Notification</p>
      </div>

      <p>Hello <strong>${sellerUser.name || 'Partner'}</strong>,</p>
      <p>You have received a new ${isVisit ? 'site visit appointment booking' : 'property inquiry'} for <strong>"${propTitle}"</strong>.</p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Lead Information
        </h4>
        <table style="width: 100%; font-size: 13px; color: #334155; line-height: 1.8;">
          <tr>
            <td style="width: 35%; font-weight: bold; color: #64748b;">Buyer Name:</td>
            <td>${buyerName}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #64748b;">Email Address:</td>
            <td><a href="mailto:${buyerEmail}" style="color: #2563eb;">${buyerEmail}</a></td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #64748b;">Phone Number:</td>
            <td><a href="tel:${buyerPhone}" style="color: #2563eb;">${buyerPhone}</a></td>
          </tr>
          ${isVisit ? `
          <tr>
            <td style="font-weight: bold; color: #64748b;">Requested Date:</td>
            <td><strong>${inquiry.visitDate || 'To be confirmed'}</strong></td>
          </tr>
          <tr>
            <td style="font-weight: bold; color: #64748b;">Time Slot:</td>
            <td><strong>${inquiry.visitTime || 'Standard Hours (10 AM - 6 PM)'}</strong></td>
          </tr>
          ` : ''}
          <tr>
            <td style="font-weight: bold; color: #64748b;">Buyer Message:</td>
            <td>${buyerMessage}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${dashboardUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          View Lead in Dashboard
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; text-align: center;">
        You are receiving this lead alert because email notifications are enabled in your EstateXplorer notification preferences.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: sellerUser.email,
      subject,
      message: `${isVisit ? 'New site visit booked' : 'New lead received'} by ${buyerName} for "${propTitle}". View details in your dashboard: ${dashboardUrl}`,
      html,
    });

    // Record notification log in database for real-time notification bell
    try {
      await NotificationLog.create({
        recipient: sellerUser._id || sellerUser.id,
        recipientPhone: sellerUser.phone || '0000000000',
        recipientName: sellerUser.name || 'Seller',
        channel: 'email',
        type: isVisit ? 'SITE_VISIT_BOOKED' : 'LEAD_ALERT',
        title: isVisit ? `New Site Visit Tour Booked` : `New Lead Inquired`,
        message: `${buyerName} inquired about "${propTitle}"`,
        gateway: 'email',
        status: 'DELIVERED',
        isRead: false,
        metadata: {
          inquiryId: inquiry?._id,
          propertyId: property?._id,
          propertyTitle: propTitle,
          buyerName,
        },
      });
    } catch (logErr) {
      console.warn('[NotificationLog creation warning]:', logErr.message);
    }

    return { success: true };
  } catch (err) {
    console.warn('[Notification Email Warning]: Failed to dispatch seller lead alert email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a confirmation email to the buyer after submitting an inquiry or booking a visit.
 */
async function notifyBuyerOnInquiryConfirmationEmail({ buyerUser, inquiry, property }) {
  const buyerEmail = inquiry?.email || buyerUser?.email;
  if (!buyerEmail) {
    return { skipped: true, reason: 'NO_BUYER_EMAIL' };
  }

  // Check buyer email notifications preference if buyerUser exists
  if (buyerUser && buyerUser.emailNotifications === false) {
    return { skipped: true, reason: 'BUYER_EMAIL_NOTIFICATIONS_DISABLED' };
  }

  const propTitle = property?.title || inquiry?.propertyTitle || 'Property';
  const isVisit = Boolean(inquiry.visitRequested || inquiry.visitDate);

  const subject = isVisit
    ? `EstateXplorer: Site Visit Request Received for "${propTitle}"`
    : `EstateXplorer: Inquiry Received for "${propTitle}"`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 12px; background: #ecfdf5; border-radius: 50%; color: #059669; font-size: 24px; margin-bottom: 8px;">
          ✓
        </div>
        <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 22px;">
          ${isVisit ? 'Site Visit Requested' : 'Inquiry Successfully Submitted'}
        </h2>
        <p style="color: #059669; font-weight: 600; margin: 0; font-size: 14px;">We have notified the property sales team</p>
      </div>

      <p>Dear <strong>${inquiry.name || 'Valued Home Buyer'}</strong>,</p>
      <p>Thank you for reaching out regarding <strong>"${propTitle}"</strong>. Your request has been transmitted directly to the official sales office and developer representative.</p>

      ${isVisit ? `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b;">Site Tour Schedule Details</h4>
        <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Preferred Date:</strong> ${inquiry.visitDate || 'Prompt confirmation'}</p>
        <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Time Slot:</strong> ${inquiry.visitTime || 'Standard Hours'}</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">The representative will contact you via phone (${inquiry.phone}) to confirm directions and gate pass access.</p>
      </div>
      ` : ''}

      <p style="font-size: 13px; color: #475569;">
        You can track all your inquiries, scheduled appointments, and saved properties in your Buyer Dashboard.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${process.env.CLIENT_URL || 'https://estatexplorer.com'}/dashboard" style="background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          View My Inquiries
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: buyerEmail,
      subject,
      message: `Thank you for your ${isVisit ? 'visit booking' : 'inquiry'} regarding "${propTitle}". The property representative will connect with you shortly.`,
      html,
    });
    return { success: true };
  } catch (err) {
    console.warn('[Notification Email Warning]: Failed to dispatch buyer confirmation email:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a status update email to the buyer when a site tour is scheduled, rescheduled, or completed.
 */
async function notifyBuyerOnStatusChangeEmail({ buyerUser, inquiry, property, newStatus, extraData = {} }) {
  const recipientEmail = buyerUser?.email || inquiry?.email;
  if (!recipientEmail) return { skipped: true, reason: 'NO_BUYER_EMAIL' };

  if (buyerUser && buyerUser.emailNotifications === false) {
    return { skipped: true, reason: 'BUYER_EMAIL_NOTIFICATIONS_DISABLED' };
  }

  const propTitle = property?.title || inquiry?.propertyTitle || 'Property';
  let subject = '';
  let headline = '';
  let description = '';

  if (newStatus === 'closed') {
    subject = `EstateXplorer: Site Tour Completed for "${propTitle}"`;
    headline = 'Site Tour Completed';
    description = `Your visit to "${propTitle}" has been marked completed by the property representative. Thank you for exploring with EstateXplorer! If you have any further questions or wish to proceed with booking details, feel free to contact us.`;
  } else if (newStatus === 'visit') {
    const dateStr = extraData.visitDate || inquiry.visitDate || 'Scheduled date';
    const timeStr = extraData.visitTime || inquiry.visitTime ? ` (${extraData.visitTime || inquiry.visitTime})` : '';
    subject = `EstateXplorer: Site Tour Confirmed for "${propTitle}"`;
    headline = 'Site Visit Appointment Confirmed';
    description = `Your property visit for "${propTitle}" has been confirmed for ${dateStr}${timeStr}. Please ensure you carry a valid photo ID for security clearance.`;
  } else {
    return { skipped: true, reason: 'NO_EMAIL_TEMPLATE_FOR_STATUS' };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #0a1628; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 12px; background: #eff6ff; border-radius: 50%; color: #2563eb; font-size: 24px; margin-bottom: 8px;">
          🔔
        </div>
        <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 22px;">${headline}</h2>
        <p style="color: #64748b; margin: 0; font-size: 14px;">Appointment Status Update</p>
      </div>

      <p>Dear <strong>${inquiry?.name || buyerUser?.name || 'Home Seeker'}</strong>,</p>
      <p>${description}</p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${process.env.CLIENT_URL || 'https://estatexplorer.com'}/dashboard" style="background: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Open Dashboard
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; 2026 EstateXplorer. All rights reserved.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: recipientEmail,
      subject,
      message: description,
      html,
    });

    try {
      await NotificationLog.create({
        recipient: buyerUser?._id || buyerUser?.id || inquiry?.user || null,
        recipientPhone: inquiry?.phone || '0000000000',
        recipientName: inquiry?.name || buyerUser?.name || 'Buyer',
        channel: 'email',
        type: newStatus === 'visit' ? 'SITE_VISIT_CONFIRMED' : 'STATUS_UPDATE',
        title: headline,
        message: description,
        gateway: 'email',
        status: 'DELIVERED',
        isRead: false,
        metadata: {
          inquiryId: inquiry?._id,
          propertyId: property?._id,
          propertyTitle: propTitle,
          status: newStatus,
        },
      });
    } catch (logErr) {
      console.warn('[Buyer NotificationLog Warning]:', logErr.message);
    }

    return { success: true };
  } catch (err) {
    console.warn('[Notification Email Warning]: Failed to dispatch status update email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  notifySellerOnNewLeadEmail,
  notifyBuyerOnInquiryConfirmationEmail,
  notifyBuyerOnStatusChangeEmail,
};
