/**
 * Multi-Tier Redis & In-Memory Threat Intelligence Cache Service
 * 
 * Architecture:
 * - Tier 1: Ultra-fast local memory Map with TTL and stale cleanup (< 1ms).
 * - Tier 2: Redis distributed cache (email-risk:domain:<domain>) if REDIS_URL or REDIS_HOST is configured.
 * - Resilience: Gracefully falls back to Tier 1 when Redis is unavailable, offline, or experiencing network partitions.
 */

class RedisCacheService {
  constructor() {
    this.memoryCache = new Map();
    this.redisClient = null;
    this.isRedisConnected = false;
    this.defaultTtlSec = 24 * 60 * 60; // 24 hours default TTL
    this.failureTtlSec = 5 * 60; // 5 minutes failure cache TTL
    this.keyPrefix = 'email-risk:domain:';

    this.stats = {
      hits: 0,
      misses: 0,
      tier1Hits: 0,
      tier2Hits: 0,
      sets: 0,
      errors: 0,
    };

    this.initRedis();
  }

  /**
   * Initializes Redis client if environment provides REDIS_URL or REDIS_HOST.
   */
  initRedis() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (!redisUrl) {
      // Redis not configured; operate in high-speed Tier 1 memory mode
      return;
    }

    try {
      // Attempt optional dynamic import of ioredis or redis if installed
      let RedisPackage = null;
      try {
        RedisPackage = require('ioredis');
      } catch (e) {
        try {
          RedisPackage = require('redis');
        } catch (e2) {}
      }

      if (RedisPackage) {
        this.redisClient = new RedisPackage(redisUrl, {
          lazyConnect: true,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
        });

        this.redisClient.on('connect', () => {
          this.isRedisConnected = true;
          console.log('[RedisCacheService] Connected to distributed Redis cache');
        });

        this.redisClient.on('error', (err) => {
          this.isRedisConnected = false;
          this.stats.errors++;
          // Do not log noisy stack traces during fallback
        });
      }
    } catch (err) {
      this.isRedisConnected = false;
    }
  }

  /**
   * Gets cached risk evaluation for a domain.
   *
   * @param {string} domain
   * @returns {Promise<object|null>}
   */
  async getDomainRisk(domain) {
    if (!domain) return null;
    const cleanDomain = domain.toLowerCase().trim();

    // 1. Tier 1: Check In-Memory Cache (< 1ms)
    const memEntry = this.memoryCache.get(cleanDomain);
    if (memEntry) {
      if (Date.now() < memEntry.expiresAt) {
        this.stats.hits++;
        this.stats.tier1Hits++;
        return { ...memEntry.data, cachedTier: 1 };
      }
      // Expired in memory
      this.memoryCache.delete(cleanDomain);
    }

    // 2. Tier 2: Check Redis if connected
    if (this.isRedisConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(`${this.keyPrefix}${cleanDomain}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Back-populate Tier 1 memory cache
          this.memoryCache.set(cleanDomain, {
            data: parsed,
            expiresAt: Date.now() + Math.min(300000, this.defaultTtlSec * 1000), // 5m in local memory
          });

          this.stats.hits++;
          this.stats.tier2Hits++;
          return { ...parsed, cachedTier: 2 };
        }
      } catch (redisErr) {
        this.stats.errors++;
        // Fall back gracefully to cache miss
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Caches domain risk evaluation in both Tier 1 and Tier 2.
   *
   * @param {string} domain
   * @param {object} riskData
   * @param {number} [ttlSeconds]
   */
  async setDomainRisk(domain, riskData, ttlSeconds = null) {
    if (!domain || !riskData) return;
    const cleanDomain = domain.toLowerCase().trim();
    const ttl = ttlSeconds || this.defaultTtlSec;

    // 1. Set in Tier 1 memory cache
    this.memoryCache.set(cleanDomain, {
      data: riskData,
      expiresAt: Date.now() + ttl * 1000,
    });
    this.stats.sets++;

    // 2. Set in Tier 2 Redis if connected
    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.set(
          `${this.keyPrefix}${cleanDomain}`,
          JSON.stringify(riskData),
          'EX',
          ttl
        );
      } catch (redisErr) {
        this.stats.errors++;
      }
    }
  }

  /**
   * Invalidates a domain from all cache tiers.
   */
  async invalidateDomain(domain) {
    if (!domain) return;
    const cleanDomain = domain.toLowerCase().trim();
    this.memoryCache.delete(cleanDomain);

    if (this.isRedisConnected && this.redisClient) {
      try {
        await this.redisClient.del(`${this.keyPrefix}${cleanDomain}`);
      } catch (e) {
        this.stats.errors++;
      }
    }
  }

  /**
   * Clears in-memory cache and returns stats.
   */
  clearCache() {
    this.memoryCache.clear();
  }

  /**
   * Returns cache metrics and hit ratios.
   */
  getStats() {
    const totalLookups = this.stats.hits + this.stats.misses;
    const hitRate = totalLookups > 0 ? (this.stats.hits / totalLookups) * 100 : 0;
    return {
      ...this.stats,
      totalLookups,
      hitRate: Math.round(hitRate * 10) / 10,
      memoryKeysCount: this.memoryCache.size,
      isRedisConnected: this.isRedisConnected,
    };
  }
}

module.exports = new RedisCacheService();
