const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

dotenv.config();

const app = express();

// High-speed response compression (Gzip / Deflate)
app.use(compression({
  threshold: 1024, // only compress responses above 1KB
  filter: (req, res) => {
    if (req.headers?.['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Health check endpoint (always available, reports live server and db status)
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.status(200).json({
    status: 'ok',
    service: 'EstateXplorer API',
    database: states[dbState] || 'unknown',
    time: new Date(),
  });
});

// Ensure DB connection for request handlers
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in request middleware:', err.message);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message,
    });
  }
});

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin serverless)
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const { streamFileFromGridFS, migrateLocalUploadsToAtlas } = require('./services/mediaService');
const Property = require('./models/Property');
const Inquiry = require('./models/Inquiry');
const User = require('./models/User');
const Contact = require('./models/Contact');
const RoleRequest = require('./models/RoleRequest');

const SecurityAuditLog = require('./models/SecurityAuditLog');
const SecurityList = require('./models/SecurityList');
const SecurityConfig = require('./models/SecurityConfig');
const securityRoutes = require('./routes/securityRoutes');
const NotificationLog = require('./models/NotificationLog');
const notificationRoutes = require('./routes/notificationRoutes');

const partnershipRoutes = require('./routes/partnershipRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const Partnership = require('./models/Partnership');
const ProjectUnit = require('./models/ProjectUnit');
const Attribution = require('./models/Attribution');
const Booking = require('./models/Booking');
const LeadAuditLog = require('./models/LeadAuditLog');

// Background tasks on start: sync indexes and migrate uploads
connectDB().then(() => {
  Property.syncIndexes().catch(() => {});
  Inquiry.syncIndexes().catch(() => {});
  User.syncIndexes().catch(() => {});
  Contact.syncIndexes().catch(() => {});
  RoleRequest.syncIndexes().catch(() => {});
  SecurityAuditLog.syncIndexes().catch(() => {});
  SecurityList.syncIndexes().catch(() => {});
  SecurityConfig.syncIndexes().catch(() => {});
  NotificationLog.syncIndexes().catch(() => {});
  Partnership.syncIndexes().catch(() => {});
  ProjectUnit.syncIndexes().catch(() => {});
  Attribution.syncIndexes().catch(() => {});
  Booking.syncIndexes().catch(() => {});
  LeadAuditLog.syncIndexes().catch(() => {});
  migrateLocalUploadsToAtlas().catch((e) => console.warn('Atlas migration note:', e.message));
}).catch(() => {});

// Serve uploaded media directly from MongoDB Atlas GridFS (Worldwide persistent streaming)
app.get(['/uploads/:filename', '/uploads/*', '/api/uploads/:filename', '/api/uploads/*'], async (req, res) => {
  await streamFileFromGridFS(req, res, req.params.filename || req.params[0] || req.path);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/partnerships', partnershipRoutes);
app.use('/api/bookings', bookingRoutes);

// Error middleware
app.use(errorMiddleware);

module.exports = app;
