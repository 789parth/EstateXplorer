const dns = require('dns').promises;

// In-memory DNS cache: domain -> { data, expiresAt }
const dnsCache = new Map();
const DEFAULT_DNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DNS_TIMEOUT_MS = 1500; // 1.5 seconds maximum timeout per DNS step

/**
 * Executes a promise with an enforced timeout.
 */
function withTimeout(promise, ms, operationName) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`DNS operation '${operationName}' timed out after ${ms}ms`);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, ms);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

/**
 * Checks domain DNS status for MX records, Null MX, and A/AAAA fallbacks.
 *
 * @param {string} domain - Domain name to inspect
 * @returns {Promise<{
 *   hasMx: boolean,
 *   mxRecords: Array<{ exchange: string, priority: number }>,
 *   isNullMx: boolean,
 *   hasAddressFallback: boolean,
 *   dnsValid: boolean,
 *   confidence: number,
 *   reason: string,
 *   cached: boolean,
 *   latencyMs: number
 * }>}
 */
async function inspectDomainDNS(domain) {
  if (!domain || typeof domain !== 'string') {
    return {
      hasMx: false,
      mxRecords: [],
      isNullMx: false,
      hasAddressFallback: false,
      dnsValid: false,
      confidence: 100,
      reason: 'invalid_domain_string',
      cached: false,
      latencyMs: 0,
    };
  }

  const cleanDomain = domain.trim().toLowerCase();

  // 1. Check in-memory DNS cache
  const cached = dnsCache.get(cleanDomain);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      ...cached.data,
      cached: true,
      latencyMs: 0,
    };
  }

  const startTime = Date.now();
  let hasMx = false;
  let mxRecords = [];
  let isNullMx = false;
  let hasAddressFallback = false;
  let dnsValid = false;
  let reason = 'dns_checked';
  let confidence = 90;

  try {
    // 2. Resolve MX Records with timeout
    try {
      const records = await withTimeout(dns.resolveMx(cleanDomain), DNS_TIMEOUT_MS, 'resolveMx');
      if (Array.isArray(records) && records.length > 0) {
        mxRecords = records.sort((a, b) => a.priority - b.priority);

        // Check for RFC 7505 Null MX record ("." or empty exchange with priority 0)
        const firstMx = mxRecords[0];
        if (
          firstMx.exchange === '.' ||
          firstMx.exchange === '' ||
          (firstMx.priority === 0 && firstMx.exchange === '.')
        ) {
          isNullMx = true;
          hasMx = false;
          dnsValid = false;
          reason = 'null_mx_record_domain_rejects_email';
        } else {
          hasMx = true;
          dnsValid = true;
          reason = 'mx_records_verified';
        }
      }
    } catch (mxErr) {
      if (mxErr.code === 'ENODATA' || mxErr.code === 'ENOTFOUND') {
        // No MX record, check A/AAAA fallback as allowed by RFC 5321
        hasMx = false;
      } else if (mxErr.code === 'ETIMEDOUT') {
        reason = 'dns_mx_timeout';
        confidence = 50;
      } else {
        reason = `dns_mx_error_${mxErr.code || 'unknown'}`;
        confidence = 60;
      }
    }

    // 3. If no MX and not Null MX, check A / AAAA fallback (RFC 5321 mail routing fallback)
    if (!hasMx && !isNullMx) {
      try {
        const aRecords = await withTimeout(dns.resolve4(cleanDomain), DNS_TIMEOUT_MS, 'resolve4');
        if (Array.isArray(aRecords) && aRecords.length > 0) {
          hasAddressFallback = true;
          dnsValid = true;
          reason = 'no_mx_but_a_record_fallback_present';
        }
      } catch (aErr) {
        try {
          const aaaaRecords = await withTimeout(dns.resolve6(cleanDomain), DNS_TIMEOUT_MS, 'resolve6');
          if (Array.isArray(aaaaRecords) && aaaaRecords.length > 0) {
            hasAddressFallback = true;
            dnsValid = true;
            reason = 'no_mx_but_aaaa_record_fallback_present';
          }
        } catch (aaaaErr) {
          if (aErr.code === 'ENOTFOUND' || aErr.code === 'ENODATA') {
            dnsValid = false;
            reason = 'domain_has_no_mx_or_address_records';
          }
        }
      }
    }
  } catch (globalErr) {
    reason = `dns_resolution_failed_${globalErr.message}`;
    confidence = 40;
  }

  const latencyMs = Date.now() - startTime;
  const result = {
    hasMx,
    mxRecords,
    isNullMx,
    hasAddressFallback,
    dnsValid,
    confidence,
    reason,
    cached: false,
    latencyMs,
  };

  // 4. Cache result with TTL
  dnsCache.set(cleanDomain, {
    data: result,
    expiresAt: Date.now() + DEFAULT_DNS_CACHE_TTL_MS,
  });

  return result;
}

/**
 * Clears the DNS resolution cache (useful for testing).
 */
function clearDnsCache() {
  dnsCache.clear();
}

module.exports = {
  inspectDomainDNS,
  clearDnsCache,
  DEFAULT_DNS_CACHE_TTL_MS,
};
