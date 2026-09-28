const SecurityList = require('../../models/SecurityList');

// Built-in Enterprise Allowlist of verified, legitimate email providers
const BUILT_IN_ALLOWLIST_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'google.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'ymail.com',
  'rocketmail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'protonmail.ch',
  'zoho.com',
  'zohomail.in',
  'zohomail.com',
  'aol.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'mail.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  'tutamail.com',
  'rediffmail.com',
]);

// In-memory cache for dynamic DB list entries
const memoryAllowlistDomains = new Set();
const memoryBlocklistDomains = new Set();
const memoryWatchlistDomains = new Set();
const memoryBlocklistHashes = new Set();
const memoryBlocklistIPs = new Set();

let lastSyncedAt = 0;
const SYNC_INTERVAL_MS = 60000; // sync from MongoDB every 60s

/**
 * Synchronizes active list rules from MongoDB into fast memory Sets.
 */
async function syncListsFromDB() {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      lastSyncedAt = Date.now();
      return;
    }

    const activeRules = await SecurityList.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();

    memoryAllowlistDomains.clear();
    memoryBlocklistDomains.clear();
    memoryWatchlistDomains.clear();
    memoryBlocklistHashes.clear();
    memoryBlocklistIPs.clear();

    for (const rule of activeRules) {
      const val = rule.value.toLowerCase().trim();
      if (rule.type === 'ALLOWLIST') {
        if (rule.targetType === 'domain') memoryAllowlistDomains.add(val);
      } else if (rule.type === 'BLOCKLIST') {
        if (rule.targetType === 'domain') memoryBlocklistDomains.add(val);
        else if (rule.targetType === 'email_hash') memoryBlocklistHashes.add(val);
        else if (rule.targetType === 'ip') memoryBlocklistIPs.add(val);
      } else if (rule.type === 'WATCHLIST' || rule.type === 'HIGH_RISK_LIST') {
        if (rule.targetType === 'domain') memoryWatchlistDomains.add(val);
      }
    }
    lastSyncedAt = Date.now();
  } catch (err) {
    // If database is not ready or during testing, continue using memory sets
    // console.warn('[SecurityListService] DB list sync skipped:', err.message);
  }
}

/**
 * Checks if a domain is allowlisted.
 */
async function isAllowlisted(domain) {
  if (!domain) return false;
  const clean = domain.toLowerCase().trim();
  if (BUILT_IN_ALLOWLIST_DOMAINS.has(clean)) return true;
  if (memoryAllowlistDomains.has(clean)) return true;

  if (Date.now() - lastSyncedAt > SYNC_INTERVAL_MS) {
    await syncListsFromDB();
    if (memoryAllowlistDomains.has(clean)) return true;
  }
  return false;
}

/**
 * Checks if domain, emailHash, or IP is explicitly blocklisted.
 */
async function isBlocklisted({ domain, emailHash, ip }) {
  if (Date.now() - lastSyncedAt > SYNC_INTERVAL_MS) {
    await syncListsFromDB();
  }

  if (domain && memoryBlocklistDomains.has(domain.toLowerCase().trim())) {
    return { blocked: true, reason: 'domain_blocklisted' };
  }
  if (emailHash && memoryBlocklistHashes.has(emailHash.toLowerCase().trim())) {
    return { blocked: true, reason: 'email_hash_blocklisted' };
  }
  if (ip && memoryBlocklistIPs.has(ip.trim())) {
    return { blocked: true, reason: 'ip_blocklisted' };
  }

  return { blocked: false, reason: '' };
}

/**
 * Checks if domain is watchlisted for enhanced scrutiny.
 */
async function isWatchlisted(domain) {
  if (!domain) return false;
  return memoryWatchlistDomains.has(domain.toLowerCase().trim());
}

/**
 * Adds an entry to a list and persists in DB.
 */
async function addEntry({ type, targetType, value, reason, addedBy, expiresAt }) {
  const cleanVal = value.toLowerCase().trim();
  let entry = { type, targetType, value: cleanVal, reason, addedBy, isActive: true, expiresAt, _id: 'mem_' + Date.now() };

  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 1) {
    entry = await SecurityList.findOneAndUpdate(
      { type, targetType, value: cleanVal },
      { type, targetType, value: cleanVal, reason, addedBy, isActive: true, expiresAt },
      { upsert: true, new: true }
    );
  }

  // Update memory immediately
  if (type === 'ALLOWLIST' && targetType === 'domain') memoryAllowlistDomains.add(cleanVal);
  if (type === 'BLOCKLIST') {
    if (targetType === 'domain') memoryBlocklistDomains.add(cleanVal);
    if (targetType === 'email_hash') memoryBlocklistHashes.add(cleanVal);
    if (targetType === 'ip') memoryBlocklistIPs.add(cleanVal);
  }
  if (type === 'WATCHLIST' && targetType === 'domain') memoryWatchlistDomains.add(cleanVal);

  return entry;
}

/**
 * Removes an entry from a list.
 */
async function removeEntry(id) {
  const mongoose = require('mongoose');
  let entry = null;
  if (mongoose.connection.readyState === 1) {
    entry = await SecurityList.findByIdAndDelete(id);
    await syncListsFromDB();
  }
  return entry || { _id: id };
}

/**
 * Gets all list entries.
 */
async function getAllEntries(filter = {}) {
  return await SecurityList.find(filter).sort({ createdAt: -1 }).lean();
}

module.exports = {
  isAllowlisted,
  isBlocklisted,
  isWatchlisted,
  addEntry,
  removeEntry,
  getAllEntries,
  syncListsFromDB,
  BUILT_IN_ALLOWLIST_DOMAINS,
};
