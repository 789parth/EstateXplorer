/**
 * Masks a phone number: keeps leading country code and initial digits, masks middle digits.
 * e.g., "+91 9876543210" -> "+91 98765-XXXXX" or "9876543210" -> "98765-XXXXX"
 * @param {string} phone 
 * @returns {string}
 */
function maskPhone(phone) {
  if (!phone) return '+91******XXXX';
  const clean = String(phone).replace(/\s+/g, '').trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 4) return '+91******XXXX';
  const last4 = digits.slice(-4);
  return `+91******${last4}`;
}

/**
 * Masks an email address: keeps first character and domain.
 * e.g., "john.doe@example.com" -> "j***@example.com"
 * @param {string} email 
 * @returns {string}
 */
function maskEmail(email) {
  if (!email) return 'N/A';
  const parts = String(email).split('@');
  if (parts.length !== 2) return '***@***.com';
  const username = parts[0];
  const domain = parts[1];
  const visibleChar = username.charAt(0) || '*';
  return `${visibleChar}***@${domain}`;
}

/**
 * Projects a lead (Inquiry object) based on the requesting user's role and attribution.
 * 
 * Strict Invariant:
 * - If lead is ATTRIBUTED (agent assigned):
 *   - The authorized Agent gets FULL contact details (phone, email, name).
 *   - The Builder gets MASKED contact details (phone masked e.g. +91******1234, email masked) until token/booking,
 *     to prevent bypassing channel partners.
 * - If lead is DIRECT (unattributed):
 *   - The Builder gets 100% FULL unmasked contact details.
 * - If user is an Admin, they have complete visibility for audit/governance.
 * 
 * @param {Object} lead Raw Mongoose document or plain JS object
 * @param {Object} user Current authenticated user { _id, role }
 * @returns {Object} Clean projected lead
 */
function projectLeadForUser(lead, user) {
  const doc = lead.toObject ? lead.toObject() : { ...lead };
  const userId = String(user?._id || user?.id);
  const userRole = user?.role;

  if (userRole === 'admin') {
    // Admin sees everything
    return doc;
  }

  const isAttributed = !!doc.isAttributed && (!!doc.agent || !!doc.agentCode);
  const isAgent = userRole === 'agent' && String(doc.agent?._id || doc.agent) === userId;
  const isBuilder = userRole === 'builder' || userRole === 'owner' || String(doc.builder?._id || doc.builder) === userId;

  if (isAttributed && isBuilder) {
    // Lead is attributed to an agent: Mask buyer contact details from Builder
    const rawPhone = doc.phone || doc.buyerPhone || '';
    const rawEmail = doc.email || doc.buyerEmail || '';
    return {
      ...doc,
      buyerPhone: maskPhone(rawPhone),
      phone: maskPhone(rawPhone),
      buyerEmail: maskEmail(rawEmail),
      email: maskEmail(rawEmail),
      user: doc.user && typeof doc.user === 'object'
        ? { ...doc.user, phone: maskPhone(doc.user.phone || rawPhone), email: maskEmail(doc.user.email || rawEmail) }
        : doc.user,
      maskedBuyerContact: maskPhone(rawPhone),
      isContactMasked: true,
      maskingNotice: 'Contact info protected by Authorized Channel Partner attribution.',
    };
  }

  // Agents who own the lead, or Builders viewing direct leads, or Admins get full contact info
  return {
    ...doc,
    isContactMasked: false,
  };
}

/**
 * Projects an array of leads
 */
function projectLeadsForUser(leads, user) {
  return leads.map(lead => projectLeadForUser(lead, user));
}

module.exports = {
  maskPhone,
  maskEmail,
  projectLeadForUser,
  projectLeadsForUser,
};
