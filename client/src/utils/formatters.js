/**
 * Universal Data Formatting & Sanitization Utilities
 * Formats all user-entered details into standard, clean, attractive representations every time.
 */

/**
 * Converts any text to proper Title Case, trims extra spaces and collapses multiple spaces.
 * Example: "parth aadthakkar" -> "Parth Aadthakkar", "  mumbai   " -> "Mumbai"
 */
export const formatName = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatTitleCase = formatName;

/**
 * Formats any input phone number into the standard Indian format: +91 XXXXXXXXXX
 * Example:
 *  "+917600973093" -> "+91 7600973093"
 *  "7600973093"    -> "+91 7600973093"
 *  "+91 98765 43210" -> "+91 9876543210"
 */
export const extract10Digits = (phone) => {
  if (!phone) return '';
  const str = String(phone).trim();
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
};

/**
 * Validates whether an input represents a valid 10-digit Indian mobile number
 * (Starts with 6, 7, 8, or 9 and has exactly 10 digits).
 */
export const isValidIndianMobile = (phone) => {
  if (!phone) return false;
  const digits = extract10Digits(phone);
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
};

export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const str = String(phone).trim();
  if (!str) return '';

  const allDigits = str.replace(/\D/g, '');

  if (allDigits.startsWith('91') && allDigits.length === 12) {
    const core = allDigits.slice(2);
    return `+91 ${core}`;
  }

  if (allDigits.length === 10) {
    return `+91 ${allDigits}`;
  }

  if (allDigits.length > 10) {
    return `+91 ${allDigits.slice(-10)}`;
  }

  if (allDigits) {
    return `+91 ${allDigits}`;
  }

  return str;
};

/**
 * Automatically formats any price or priceDisplay string to standard Indian representation.
 * Examples:
 *  "35L" -> "₹ 35.00 L"
 *  "1.45 Cr" -> "₹ 1.45 Cr"
 *  3500000 -> "₹ 35.00 L"
 *  250000 (with purpose='rent') -> "₹ 2.50 L / mo"
 */
export const formatPrice = (priceVal, priceDisplay = '', purpose = 'buy') => {
  if (priceDisplay && typeof priceDisplay === 'string' && priceDisplay.trim()) {
    let clean = priceDisplay.trim();
    if (!clean.startsWith('₹') && !clean.startsWith('Rs') && !clean.startsWith('INR')) {
      clean = `₹ ${clean}`;
    }
    return clean;
  }

  if (priceVal === null || priceVal === undefined || priceVal === '') {
    return '₹ Price on Request';
  }

  const str = String(priceVal).trim();
  if (str.startsWith('₹') || str.startsWith('Rs') || str.startsWith('INR')) {
    return str;
  }

  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) {
    return `₹ ${str}`;
  }

  if (purpose === 'rent') {
    if (num >= 100000) {
      const lac = (num / 100000).toFixed(2).replace(/\.00$/, '');
      return `₹ ${lac} L / mo`;
    }
    return `₹ ${num.toLocaleString('en-IN')} / mo`;
  }

  if (str.toLowerCase().includes('cr') || str.toLowerCase().includes('crore')) {
    return `₹ ${str}`;
  }
  if (str.toLowerCase().includes('l') || str.toLowerCase().includes('lac') || str.toLowerCase().includes('lakh')) {
    return `₹ ${str}`;
  }

  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${cr} Cr`;
  }
  if (num >= 100000) {
    const lac = (num / 100000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${lac} L`;
  }
  if (num >= 1000) {
    return `₹ ${num.toLocaleString('en-IN')}`;
  }

  return `₹ ${str}`;
};

/**
 * Formats numbers into standard Indian Lakhs / Crores string or comma formatted.
 * Example:
 *   3500000 -> "₹ 35 L"
 *   12500000 -> "₹ 1.25 Cr"
 *   50000 -> "₹ 50,000"
 */
export const formatIndianCurrency = (num) => {
  if (!num || isNaN(num) || num <= 0) return '₹ 0';
  const val = Math.round(num);
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${cr} Cr`;
  }
  if (val >= 100000) {
    const lakh = (val / 100000).toFixed(2).replace(/\.00$/, '');
    return `₹ ${lakh} L`;
  }
  return `₹ ${val.toLocaleString('en-IN')}`;
};

/**
 * Formats area into clean display with units: "1,200 sq.ft"
 */
export const formatArea = (areaVal) => {
  if (!areaVal && areaVal !== 0) return '';
  const num = parseFloat(String(areaVal).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return String(areaVal);
  return `${num.toLocaleString('en-IN')} sq.ft`;
};

/**
 * Formats address and city, deduplicating repeated components
 */
export const formatAddress = (address, city = '', state = '') => {
  if (!address && !city && !state) return '';
  if (typeof address === 'object') {
    city = address.city || city;
    state = address.state || state;
    address = address.address || '';
  }

  const parts = [address, city, state]
    .filter(Boolean)
    .flatMap((p) => p.split(',').map((s) => s.trim()))
    .filter(Boolean);

  const deduped = parts.filter((part, idx) => parts.findIndex((p) => p.toLowerCase() === part.toLowerCase()) === idx);
  return deduped.join(', ');
};

/**
 * Formats codes like RERA ID, GST, PAN, CIN to clean uppercase
 */
export const formatCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/\s+/g, ' ');
};

/**
 * Formats email to lowercase and trimmed
 */
export const formatEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

/**
 * Universal text sanitizer
 */
export const sanitizeInput = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
};

/**
 * Universal Image URL resolver.
 * Handles:
 *  - External full URLs (https://images.unsplash.com/...)
 *  - Uploaded relative paths (/uploads/property-xxx.jpg)
 *  - Data URLs (data:image/...)
 *  - Base URL resolution for both local dev and production
 */
export const getPublicImageUrl = (
  url,
  fallback = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop'
) => {
  if (!url || typeof url !== 'string' || !url.trim()) return fallback;
  const trimmed = url.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Handle relative upload path
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const backendBase = apiUrl.replace(/\/api\/?$/, '');

  if (backendBase) {
    return `${backendBase}${cleanPath}`;
  }

  return cleanPath;
};

/**
 * Checks whether a given media URL is a video.
 */
export const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.trim().toLowerCase();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.m4v') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.avi') ||
    lower.includes('/property-video-') ||
    lower.startsWith('data:video/')
  );
};
