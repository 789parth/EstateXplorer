const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (e) {}

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./services/socketManager');

const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Initialize periodic background threat intelligence synchronization
const threatIntelligenceSyncJob = require('./services/security/jobs/threatIntelligenceSyncJob');
threatIntelligenceSyncJob.startScheduler();

// Create HTTP server and attach Socket.io for real-time events (Spec §7, §41)
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`EstateXplorer Server running on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection Error:', err?.message || err);
  // Keep server alive in dev mode
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception Error:', err?.message || err);
});
