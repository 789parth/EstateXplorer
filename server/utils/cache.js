class FastMemoryCache {
  constructor(maxItems = 500, defaultTTL = 60) {
    this.cache = new Map();
    this.maxItems = maxItems;
    this.defaultTTL = defaultTTL;
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }
  set(key, value, ttl = this.defaultTTL) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }
  del(key) {
    this.cache.delete(key);
  }
  clear(prefix = '') {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
  size() {
    return this.cache.size;
  }
}

const memoryCache = new FastMemoryCache(500, 60);

const cacheMiddleware = (prefix = 'api', ttlSeconds = 60) => {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const cacheKey = `${prefix}:${req.originalUrl || req.url}`;
    const cachedData = memoryCache.get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${Math.min(ttlSeconds, 60)}, stale-while-revalidate=120`);
      return res.status(200).json(cachedData);
    }
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success) {
        memoryCache.set(cacheKey, body, ttlSeconds);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', `public, max-age=${Math.min(ttlSeconds, 60)}, stale-while-revalidate=120`);
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = { memoryCache, cacheMiddleware };
