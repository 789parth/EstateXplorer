const crypto = require('crypto');

// Standard known role / generic mailbox prefixes
const ROLE_ACCOUNT_PREFIXES = new Set([
  'admin',
  'administrator',
  'support',
  'sales',
  'info',
  'contact',
  'billing',
  'invoice',
  'accounts',
  'security',
  'privacy',
  'help',
  'helpdesk',
  'desk',
  'abuse',
  'postmaster',
  'hostmaster',
  'webmaster',
  'root',
  'noc',
  'compliance',
  'legal',
  'jobs',
  'careers',
  'hr',
  'marketing',
  'media',
  'press',
  'office',
  'team',
  'staff',
  'service',
  'feedback',
  'inquiry',
  'enquiry',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'notifications',
  'alerts',
]);

/**
 * Enterprise Email Normalization Pipeline
 * 
 * Performs:
 * - Trimming & Unicode NFC normalization
 * - Domain lowercasing & IDN / Punycode handling
 * - Clean local-part preservation (retains '+', '.', '-', '_')
 * - Role-account classification
 * - SHA-256 hash generation for privacy-first analytics and denylist checking
 * 
 * @param {string} rawEmail
 * @returns {{
 *   raw: string,
 *   normalizedEmail: string,
 *   domain: string,
 *   localPart: string,
 *   baseLocalPart: string,
 *   tag: string|null,
 *   emailHash: string,
 *   isRoleAccount: boolean,
 *   hasPlusAddressing: boolean,
 *   isValid: boolean,
 *   syntaxErrors: string[]
 * }}
 */
function normalizeEmail(rawEmail) {
  const errors = [];
  if (!rawEmail || typeof rawEmail !== 'string') {
    return {
      raw: rawEmail || '',
      normalizedEmail: '',
      domain: '',
      localPart: '',
      baseLocalPart: '',
      tag: null,
      emailHash: '',
      isRoleAccount: false,
      hasPlusAddressing: false,
      isValid: false,
      syntaxErrors: ['empty_or_non_string_email'],
    };
  }

  // 1. Unicode NFC normalization & whitespace trimming
  const trimmed = rawEmail.trim().normalize('NFC');
  if (trimmed.length > 254) {
    errors.push('email_exceeds_max_length');
  }

  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return {
      raw: rawEmail,
      normalizedEmail: trimmed.toLowerCase(),
      domain: '',
      localPart: trimmed.toLowerCase(),
      baseLocalPart: trimmed.toLowerCase(),
      tag: null,
      emailHash: crypto.createHash('sha256').update(trimmed.toLowerCase()).digest('hex'),
      isRoleAccount: false,
      hasPlusAddressing: false,
      isValid: false,
      syntaxErrors: ['missing_or_invalid_at_symbol'],
    };
  }

  let localPart = trimmed.substring(0, atIndex).trim();
  let domain = trimmed.substring(atIndex + 1).trim().toLowerCase();

  // 2. Domain conversion & validation
  // Strip trailing dot if present (FQDN)
  if (domain.endsWith('.')) {
    domain = domain.slice(0, -1);
  }

  // Handle Punycode/IDN if needed
  try {
    const url = new URL(`http://${domain}`);
    domain = url.hostname;
  } catch (e) {
    // If not standard URL format, retain trimmed domain
  }

  if (!domain.includes('.') || domain.length < 3) {
    errors.push('invalid_domain_format');
  }

  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    errors.push('invalid_domain_dots');
  }

  // 3. Local-part analysis
  if (localPart.length === 0 || localPart.length > 64) {
    errors.push('invalid_local_part_length');
  }

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    errors.push('invalid_local_part_dots');
  }

  // Normalize case of local part while preserving chars
  localPart = localPart.toLowerCase();

  // 4. Plus-addressing analysis (e.g. user+tag@example.com)
  let baseLocalPart = localPart;
  let tag = null;
  const plusIndex = localPart.indexOf('+');
  const hasPlusAddressing = plusIndex > 0;

  if (hasPlusAddressing) {
    baseLocalPart = localPart.substring(0, plusIndex);
    tag = localPart.substring(plusIndex + 1);
  }

  // 5. Role account detection
  const isRoleAccount = ROLE_ACCOUNT_PREFIXES.has(baseLocalPart);

  // 6. Canonical representation & cryptographic hash
  const normalizedEmail = `${localPart}@${domain}`;
  const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');

  const isValid = errors.length === 0;

  return {
    raw: rawEmail,
    normalizedEmail,
    domain,
    localPart,
    baseLocalPart,
    tag,
    emailHash,
    isRoleAccount,
    hasPlusAddressing,
    isValid,
    syntaxErrors: errors,
  };
}

module.exports = {
  normalizeEmail,
  ROLE_ACCOUNT_PREFIXES,
};
