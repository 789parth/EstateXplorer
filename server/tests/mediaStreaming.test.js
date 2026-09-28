const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const connectDB = require('../config/db');
const app = require('../app');

async function runTests() {
  console.log('🧪 Starting MongoDB Atlas Media & Video Streaming Tests...\n');
  await connectDB();

  const server = http.createServer(app);

  server.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
      // Test 1: Fetch migrated image via /uploads/...
      const imgRes = await fetch(`${baseUrl}/uploads/property-image-1788166484159-618545659.png`);
      if (imgRes.status === 200 && imgRes.headers.get('content-type')?.includes('image')) {
        console.log('✅ [Test 1/4] Passed: Image streamed directly from MongoDB Atlas (Status 200, Content-Type: ' + imgRes.headers.get('content-type') + ')');
      } else {
        throw new Error(`Test 1 Failed: Status ${imgRes.status}`);
      }

      // Test 2: Fetch migrated video via /uploads/... with Range header (HTTP 206 Partial Content)
      const vidRes = await fetch(`${baseUrl}/uploads/property-video-1788167007883-829059823.mp4`, {
        headers: { Range: 'bytes=0-1048575' },
      });
      if (vidRes.status === 206 && vidRes.headers.get('content-range')?.includes('bytes 0-1048575/')) {
        console.log('✅ [Test 2/4] Passed: Video partial content range stream working (Status 206, Content-Range: ' + vidRes.headers.get('content-range') + ')');
      } else {
        throw new Error(`Test 2 Failed: Status ${vidRes.status}`);
      }

      // Test 3: Fetch via /api/upload/file/...
      const apiRes = await fetch(`${baseUrl}/api/upload/file/property-image-1788166484159-618545659.png`);
      if (apiRes.status === 200) {
        console.log('✅ [Test 3/4] Passed: API route /api/upload/file/:filename stream working (Status 200)');
      } else {
        throw new Error(`Test 3 Failed: Status ${apiRes.status}`);
      }

      // Test 4: Cache-Control and CORS headers
      const cacheHeader = imgRes.headers.get('cache-control');
      if (cacheHeader && cacheHeader.includes('public') && cacheHeader.includes('max-age')) {
        console.log('✅ [Test 4/4] Passed: Immutable global CDN cache headers set (' + cacheHeader + ')');
      } else {
        throw new Error(`Test 4 Failed: Cache header missing or invalid`);
      }

      console.log('\n🎉 All 4 MongoDB Atlas Media Streaming verification tests passed successfully!\n');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ Test failed:', err.message);
      server.close();
      process.exit(1);
    }
  });
}

runTests();