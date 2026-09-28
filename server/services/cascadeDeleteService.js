const User = require('../models/User');
const Property = require('../models/Property');
const RoleRequest = require('../models/RoleRequest');
const Inquiry = require('../models/Inquiry');
const Booking = require('../models/Booking');
const Partnership = require('../models/Partnership');
const Attribution = require('../models/Attribution');
const ProjectUnit = require('../models/ProjectUnit');
const LeadAuditLog = require('../models/LeadAuditLog');
const NotificationLog = require('../models/NotificationLog');
const Contact = require('../models/Contact');
const OTP = require('../models/OTP');
const { memoryCache } = require('../utils/cache');

/**
 * Permanently and completely purges all data related to a user's account and email address
 * across every collection in the EstateXplorer database.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} params.email
 */
exports.cascadeDeleteAllUserData = async ({ userId, email }) => {
  const normalizedEmail = (email || '').toString().trim().toLowerCase();
  const uid = userId;

  // 1. Identify all property/project IDs owned by this user (if builder/owner)
  const userProperties = await Property.find({
    $or: [{ builder: uid }]
  }).select('_id').lean();
  const propertyIds = userProperties.map((p) => p._id);

  // 2. Identify all bookings associated with this user or their properties
  const bookingFilter = {
    $or: [
      { buyer: uid },
      { builder: uid },
      { agent: uid },
      ...(normalizedEmail ? [{ buyerEmail: normalizedEmail }] : []),
      ...(propertyIds.length ? [{ project: { $in: propertyIds } }] : []),
    ],
  };
  const userBookings = await Booking.find(bookingFilter).select('_id').lean();
  const bookingIds = userBookings.map((b) => b._id);

  // 3. Identify all inquiries/leads associated with this user or their properties
  const inquiryFilter = {
    $or: [
      { user: uid },
      { builder: uid },
      { agent: uid },
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(propertyIds.length ? [{ property: { $in: propertyIds } }] : []),
      ...(bookingIds.length ? [{ bookingRef: { $in: bookingIds } }] : []),
    ],
  };
  const userInquiries = await Inquiry.find(inquiryFilter).select('_id').lean();
  const inquiryIds = userInquiries.map((i) => i._id);

  // 4. Delete Lead Audit Logs for these leads or where actor was this user
  await LeadAuditLog.deleteMany({
    $or: [
      { actor: uid },
      ...(inquiryIds.length ? [{ lead: { $in: inquiryIds } }] : []),
    ],
  });

  // 5. Delete Bookings
  if (bookingFilter.$or.length) {
    await Booking.deleteMany(bookingFilter);
  }

  // 6. Delete Inquiries / Leads
  if (inquiryFilter.$or.length) {
    await Inquiry.deleteMany(inquiryFilter);
  }

  // 7. Delete ProjectUnits for user's properties, or release/delete units booked by user/agent
  if (propertyIds.length) {
    await ProjectUnit.deleteMany({ project: { $in: propertyIds } });
  }
  // If user was an agent or buyer on project units belonging to other projects, reset them to available
  await ProjectUnit.updateMany(
    { $or: [{ bookedBy: uid }, { bookedByAgent: uid }] },
    {
      $set: {
        status: 'available',
        bookedBy: null,
        bookedByAgent: null,
        bookingId: null,
      },
    }
  );

  // 8. Delete Partnerships (where user is builder or agent)
  await Partnership.deleteMany({
    $or: [
      { builder: uid },
      { agent: uid },
      ...(propertyIds.length ? [{ project: { $in: propertyIds } }] : []),
    ],
  });

  // 9. Delete Attributions (where user is agent, buyer, or for user's properties)
  await Attribution.deleteMany({
    $or: [
      { agent: uid },
      { buyer: uid },
      ...(propertyIds.length ? [{ project: { $in: propertyIds } }] : []),
    ],
  });

  // 10. Delete Properties created by the user
  if (propertyIds.length) {
    await Property.deleteMany({ _id: { $in: propertyIds } });
  }

  // 11. Delete Role Requests by user ID or email
  await RoleRequest.deleteMany({
    $or: [
      { userId: uid },
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
    ],
  });

  // 12. Delete Notification Logs where user is recipient
  await NotificationLog.deleteMany({
    $or: [{ recipient: uid }],
  });

  // 13. Delete Contact form messages submitted with this email
  if (normalizedEmail) {
    await Contact.deleteMany({ email: normalizedEmail });
  }

  // 14. Delete any pending OTPs for this email
  if (normalizedEmail) {
    await OTP.deleteMany({ email: normalizedEmail });
  }

  // 15. If this user was part of any other builder's team, remove them from team array
  if (normalizedEmail) {
    await User.updateMany(
      { 'builderProfile.team.email': normalizedEmail },
      { $pull: { 'builderProfile.team': { email: normalizedEmail } } }
    );
  }

  // 16. Finally, permanently delete the User record itself
  await User.findByIdAndDelete(uid);
  if (normalizedEmail) {
    await User.deleteMany({ email: normalizedEmail });
  }

  // 17. Invalidate caches
  if (memoryCache && typeof memoryCache.clear === 'function') {
    memoryCache.clear('properties');
  }
};
