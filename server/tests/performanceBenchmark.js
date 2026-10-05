const http = require('http');
const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/db');

async function measureLatency(fn, iterations = 50) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // ms
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)].toFixed(2);
  const p95 = times[Math.floor(times.length * 0.95)].toFixed(2);
  const p99 = times[Math.floor(times.length * 0.99)].toFixed(2);
  const avg = (times.reduce((sum, t) => sum + t, 0) / times.length).toFixed(2);
  return { avg, p50, p95, p99 };
}

async function runBenchmark() {
  console.log('⚡ Starting Real Backend Performance & Latency Benchmark...');
  
  // 1. Measure DB Connection & Boot
  const bootStart = process.hrtime.bigint();
  await connectDB();
  const bootEnd = process.hrtime.bigint();
  const dbConnectMs = (Number(bootEnd - bootStart) / 1e6).toFixed(2);
  console.log(`⏱️ MongoDB Atlas Connection Time: ${dbConnectMs} ms`);

  // Start HTTP server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const makeRequest = (path, options = {}) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  };

  // 2. Benchmark Health Check (Fast Baseline)
  const healthStats = await measureLatency(() => makeRequest('/api/health'), 100);
  console.log(`\n📊 [GET /api/health] (100 reqs): avg: ${healthStats.avg}ms | p50: ${healthStats.p50}ms | p95: ${healthStats.p95}ms | p99: ${healthStats.p99}ms`);

  // 3. Benchmark Properties List (Cached vs DB Query)
  // First request to populate cache
  await makeRequest('/api/properties?page=1&limit=10');
  const cachedListStats = await measureLatency(() => makeRequest('/api/properties?page=1&limit=10'), 100);
  console.log(`📊 [GET /api/properties (Cache Hit)] (100 reqs): avg: ${cachedListStats.avg}ms | p50: ${cachedListStats.p50}ms | p95: ${cachedListStats.p95}ms | p99: ${cachedListStats.p99}ms`);

  // Uncached dynamic query
  const uncachedListStats = await measureLatency((i) => makeRequest(`/api/properties?page=1&limit=10&rand=${Math.random()}`), 20);
  console.log(`📊 [GET /api/properties (Parallel DB Query)] (20 reqs): avg: ${uncachedListStats.avg}ms | p50: ${uncachedListStats.p50}ms | p95: ${uncachedListStats.p95}ms | p99: ${uncachedListStats.p99}ms`);

  // 4. Memory Footprint
  const memUsage = process.memoryUsage();
  console.log('\n💾 Memory Utilization:');
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);

  server.close();
  await mongoose.connection.close();
  console.log('\n✅ Performance benchmark complete.\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
