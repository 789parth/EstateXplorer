/**
 * Backend Data Formatting & Normalization Utilities
 * Ensures all user-entered details are stored in standard, clean formats.
 */

// Converts text to Title Case (e.g., "parth aadthakkar" -> "Parth Aadthakkar")
const normalizeTitleCase = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Formats phone numbers into standard Indian format (+91 XXXXXXXXXX)
const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const str = String(phone).trim();
  if (!str) return '';

  const digits = str.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }
  if (digits.length > 10) {
    return `+91 ${digits.slice(-10)}`;
  }
  if (digits) {
    return `+91 ${digits}`;
  }
  return str;
};

// Formats price into standard Indian currency representation (e.g., ₹ 45.00 L, ₹ 1.25 Cr)
const normalizePriceDisplay = (priceVal, priceDisplay = '', purpose = 'buy') => {
  if (priceDisplay && typeof priceDisplay === 'string' && priceDisplay.trim()) {
    let clean = priceDisplay.trim();
    if (!clean.startsWith('₹') && !clean.startsWith('Rs') && !clean.startsWith('INR')) {
      clean = `₹ ${clean}`;
    }
    return clean;
  }

  const num = Number(priceVal);
  if (isNaN(num) || num <= 0) {
    return '₹ Price on Request';
  }

  if (purpose === 'rent') {
    if (num >= 100000) {
      const lac = (num / 100000).toFixed(2).replace(/\.00$/, '');
      return `₹ ${lac} L / mo`;
    }
    return `₹ ${num.toLocaleString('en-IN')} / mo`;
  }

  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${cr} Cr`;
  }
  if (num >= 100000) {
    const lac = (num / 100000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${lac} L`;
  }
  return `₹ ${num.toLocaleString('en-IN')}`;
};

// Formats codes (RERA IDs, PAN, GST, CIN) into clean uppercase
const normalizeCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/\s+/g, ' ');
};

// Formats email to lowercase and trimmed
const normalizeEmailStr = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

module.exports = {
  normalizeTitleCase,
  normalizePhoneNumber,
  normalizePriceDisplay,
  normalizeCode,
  normalizeEmailStr,
};
