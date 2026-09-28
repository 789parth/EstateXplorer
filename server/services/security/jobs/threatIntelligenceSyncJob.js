const DomainReputation = require('../../../models/DomainReputation');
const redisCacheService = require('../cache/redisCacheService');

// Default reliable public threat intelligence feeds for disposable domains
const DEFAULT_THREAT_FEEDS = [
  'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf',
];

class ThreatIntelligenceSyncJob {
  constructor() {
    this.isSyncing = false;
    this.lastSyncAt = null;
    this.lastSyncCount = 0;
    this.syncIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
    this.timer = null;
  }

  /**
   * Starts periodic threat intelligence sync in background.
   */
  startScheduler() {
    if (this.timer) return;
    // Initial sync after 10 seconds of startup
    setTimeout(() => this.syncThreatIntelligence(), 10000);
    this.timer = setInterval(() => this.syncThreatIntelligence(), this.syncIntervalMs);
  }

  /**
   * Stops scheduler (for graceful shutdown or tests).
   */
  stopScheduler() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Downloads threat feeds, parses domains, and syncs to MongoDB & Redis.
   */
  async syncThreatIntelligence() {
    if (this.isSyncing) return { status: 'already_syncing' };
    this.isSyncing = true;
    const startTime = Date.now();
    let syncedDomains = 0;

    try {
      const feedUrls = process.env.DISPOSABLE_DOMAIN_FEED_URLS
        ? process.env.DISPOSABLE_DOMAIN_FEED_URLS.split(',').map((s) => s.trim())
        : DEFAULT_THREAT_FEEDS;

      const discoveredDomains = new Set();

      for (const url of feedUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const text = await res.text();
            const lines = text.split('\n');
            for (const line of lines) {
              const clean = line.trim().toLowerCase();
              if (clean && !clean.startsWith('#') && clean.includes('.')) {
                discoveredDomains.add(clean);
              }
            }
          }
        } catch (feedErr) {
          // Feed fetch error, continue to next feed
        }
      }

      // Persist discovered domains into MongoDB DomainReputation if DB is connected
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1 && discoveredDomains.size > 0) {
        const batch = [];
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL

        for (const dom of discoveredDomains) {
          batch.push({
            updateOne: {
              filter: { domain: dom },
              update: {
                $set: {
                  domain: dom,
                  classification: 'DISPOSABLE',
                  riskScore: 100,
                  confidence: 95,
                  source: 'threat_intelligence_sync',
                  isDisposable: true,
                  isBlocked: true,
                  isAllowed: false,
                  lastSeenAt: new Date(),
                  expiresAt,
                },
                $setOnInsert: { firstSeenAt: new Date() },
              },
              upsert: true,
            },
          });

          // Pre-warm Tier 1 memory cache for top domains
          if (syncedDomains < 500) {
            redisCacheService.setDomainRisk(dom, {
              isDisposable: true,
              classification: 'DISPOSABLE',
              riskScore: 100,
              confidence: 95,
              source: 'threat_sync',
            });
          }

          syncedDomains++;
        }

        if (batch.length > 0) {
          await DomainReputation.bulkWrite(batch.slice(0, 5000), { ordered: false }).catch(() => {});
        }
      }

      this.lastSyncAt = new Date();
      this.lastSyncCount = discoveredDomains.size;
      const latencyMs = Date.now() - startTime;

      return {
        success: true,
        totalFetched: discoveredDomains.size,
        syncedCount: syncedDomains,
        latencyMs,
        syncedAt: this.lastSyncAt,
      };
    } catch (err) {
      console.warn('[ThreatIntelligenceSyncJob] Sync failed:', err.message);
      return { success: false, error: err.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns current sync status.
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
      lastSyncCount: this.lastSyncCount,
      intervalHours: this.syncIntervalMs / (60 * 60 * 1000),
    };
  }
}

module.exports = new ThreatIntelligenceSyncJob();
