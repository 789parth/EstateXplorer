/**
 * Enterprise Multi-Dimensional Sliding-Window Velocity Tracker
 * 
 * Tracks registration activity across:
 * - IP Address
 * - Subnet /24 (IPv4) or /48 (IPv6)
 * - Email Domain (catches domain-targeted farming/spam attacks)
 * - Email Hash (catches rapid repeat attempts)
 */

// Memory stores: key -> array of timestamps [t1, t2, ...]
const ipHistory = new Map();
const subnetHistory = new Map();
const domainHistory = new Map();
const emailHashHistory = new Map();

// Configurable velocity thresholds
const LIMITS = {
  ip: {
    '1m': 3,
    '5m': 6,
    '1h': 20,
  },
  subnet: {
    '5m': 12,
    '1h': 40,
  },
  domain: {
    '5m': 10,  // max 10 signups from same domain within 5 min (except allowlisted)
    '1h': 50,
  },
  emailHash: {
    '15m': 5,
  },
};

/**
 * Extracts subnet identifier from IP.
 */
function getSubnet(ip) {
  if (!ip) return 'unknown';
  if (ip.includes('.')) {
    // IPv4: take first 3 octets (/24)
    const parts = ip.split('.');
    if (parts.length >= 3) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  } else if (ip.includes(':')) {
    // IPv6: take first 3 segments
    const parts = ip.split(':');
    if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}::/48`;
  }
  return ip;
}

/**
 * Filters timestamps within a sliding window in ms and prunes older entries.
 */
function getCountsInWindow(historyMap, key, windowMs, now) {
  if (!key) return 0;
  let timestamps = historyMap.get(key) || [];
  const cutoff = now - windowMs;
  timestamps = timestamps.filter((t) => t > cutoff);
  historyMap.set(key, timestamps);
  return timestamps.length;
}

/**
 * Records a new registration attempt.
 */
function recordAttempt({ ip, domain, emailHash }, now = Date.now()) {
  if (ip) {
    const list = ipHistory.get(ip) || [];
    list.push(now);
    ipHistory.set(ip, list);

    const subnet = getSubnet(ip);
    const subList = subnetHistory.get(subnet) || [];
    subList.push(now);
    subnetHistory.set(subnet, subList);
  }

  if (domain) {
    const list = domainHistory.get(domain) || [];
    list.push(now);
    domainHistory.set(domain, list);
  }

  if (emailHash) {
    const list = emailHashHistory.get(emailHash) || [];
    list.push(now);
    emailHashHistory.set(emailHash, list);
  }
}

/**
 * Checks velocity across all dimensions and computes velocity risk points.
 *
 * @param {{ ip: string, domain: string, emailHash: string, isAllowlisted: boolean }} context
 * @returns {{
 *   velocityRisk: number, // 0 to 100
 *   isRateLimited: boolean,
 *   reason: string,
 *   details: object
 * }}
 */
function checkVelocity({ ip, domain, emailHash, isAllowlisted = false }) {
  const now = Date.now();
  let velocityRisk = 0;
  let isRateLimited = false;
  const reasons = [];

  // 1. IP checks
  const ip1m = getCountsInWindow(ipHistory, ip, 60 * 1000, now);
  const ip5m = getCountsInWindow(ipHistory, ip, 5 * 60 * 1000, now);
  const ip1h = getCountsInWindow(ipHistory, ip, 60 * 60 * 1000, now);

  if (ip1m >= LIMITS.ip['1m']) {
    velocityRisk += 40;
    reasons.push(`ip_velocity_1m_exceeded_${ip1m}`);
  }
  if (ip5m >= LIMITS.ip['5m']) {
    velocityRisk += 50;
    reasons.push(`ip_velocity_5m_exceeded_${ip5m}`);
  }
  if (ip1h >= LIMITS.ip['1h']) {
    velocityRisk += 60;
    isRateLimited = true;
    reasons.push(`ip_velocity_1h_exceeded_${ip1h}`);
  }

  // 2. Subnet checks
  const subnet = getSubnet(ip);
  const sub5m = getCountsInWindow(subnetHistory, subnet, 5 * 60 * 1000, now);
  if (sub5m >= LIMITS.subnet['5m']) {
    velocityRisk += 30;
    reasons.push(`subnet_velocity_5m_${sub5m}`);
  }

  // 3. Domain velocity checks (skip for trusted providers like gmail, outlook)
  let dom5m = 0;
  let dom1h = 0;
  if (!isAllowlisted && domain) {
    dom5m = getCountsInWindow(domainHistory, domain, 5 * 60 * 1000, now);
    dom1h = getCountsInWindow(domainHistory, domain, 60 * 60 * 1000, now);

    if (dom5m >= LIMITS.domain['5m']) {
      velocityRisk += 60;
      reasons.push(`domain_burst_${domain}_5m_${dom5m}`);
    }
    if (dom1h >= LIMITS.domain['1h']) {
      velocityRisk += 75;
      isRateLimited = true;
      reasons.push(`domain_farming_${domain}_1h_${dom1h}`);
    }
  }

  // 4. Single email repeated check
  const email15m = getCountsInWindow(emailHashHistory, emailHash, 15 * 60 * 1000, now);
  if (email15m >= LIMITS.emailHash['15m']) {
    velocityRisk += 35;
    reasons.push(`email_repeat_${email15m}`);
  }

  // Record this attempt after checking
  recordAttempt({ ip, domain, emailHash }, now);

  velocityRisk = Math.min(100, velocityRisk);
  if (velocityRisk >= 80) isRateLimited = true;

  return {
    velocityRisk,
    isRateLimited,
    reason: reasons.join('; ') || 'normal_velocity',
    details: {
      ip1m,
      ip5m,
      ip1h,
      sub5m,
      dom5m,
      dom1h,
      email15m,
    },
  };
}

/**
 * Clears velocity history (useful for tests).
 */
function clearVelocityHistory() {
  ipHistory.clear();
  subnetHistory.clear();
  domainHistory.clear();
  emailHashHistory.clear();
}

module.exports = {
  checkVelocity,
  recordAttempt,
  clearVelocityHistory,
  LIMITS,
};
