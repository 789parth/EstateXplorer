const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * EstateXplorer Real-Time Socket Manager — Spec §7, §41
 * 
 * Implements authenticated, user-scoped Socket.io connections.
 * Events are never globally broadcast — only emitted to the correct recipient(s).
 *
 * Supported real-time events:
 *   PARTNERSHIP_REQUEST_CREATED  → to Builder
 *   PARTNERSHIP_STATUS_CHANGED   → to Agent
 *   NEW_ATTRIBUTED_LEAD          → to Agent
 *   LEAD_STATUS_UPDATED          → to Agent + Builder
 *   BOOKING_CREATED              → to Agent + Builder
 *   INVENTORY_STATUS_CHANGED     → to Builder
 *   COMMISSION_CREATED           → to Agent
 */

let _io = null;

// Map: userId (string) → Set of socket IDs
const userSockets = new Map();

/**
 * Initialise Socket.io on the HTTP server.
 * Call once from server.js after the http server is created.
 */
function initSocket(httpServer) {
  const { Server } = require('socket.io');

  _io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Use long-polling first for compatibility, then upgrade to WebSocket
    transports: ['polling', 'websocket'],
  });

  // Authentication middleware — validate JWT on every connection
  _io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required: no token provided.'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'estatexplorer_access_secret'
      );

      const user = await User.findById(decoded.id)
        .select('name email role isBlocked')
        .lean();

      if (!user || user.isBlocked) {
        return next(new Error('Authentication failed: user not found or blocked.'));
      }

      socket.userId = String(user._id);
      socket.userRole = user.role;
      socket.userName = user.name;
      next();
    } catch (err) {
      next(new Error('Authentication failed: invalid or expired token.'));
    }
  });

  _io.on('connection', (socket) => {
    const uid = socket.userId;

    // Register socket in userSockets map
    if (!userSockets.has(uid)) {
      userSockets.set(uid, new Set());
    }
    userSockets.get(uid).add(socket.id);

    // Join user-specific room for scoped delivery
    socket.join(`user:${uid}`);

    socket.on('disconnect', () => {
      const set = userSockets.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(uid);
      }
    });
  });

  console.log('[Socket.io] Real-time server initialised');
  return _io;
}

/**
 * Emit a real-time event to a specific user by their userId.
 * Safe to call even if the user has no active sockets (no-op).
 *
 * @param {string} userId    MongoDB ObjectId as string
 * @param {string} event     Event name (use SOCKET_EVENTS constants)
 * @param {Object} payload   Event data (never include protected buyer contact fields for builder recipients)
 */
function emitToUser(userId, event, payload) {
  if (!_io || !userId) return;
  _io.to(`user:${String(userId)}`).emit(event, payload);
}

/**
 * Emit a real-time event to multiple users simultaneously.
 */
function emitToUsers(userIds, event, payload) {
  if (!_io) return;
  for (const id of userIds) {
    emitToUser(id, event, payload);
  }
}

/**
 * Real-time event names — single source of truth.
 * Import these constants wherever you emit events.
 */
const SOCKET_EVENTS = {
  // Partnership events
  PARTNERSHIP_REQUEST_CREATED: 'PARTNERSHIP_REQUEST_CREATED',
  PARTNERSHIP_STATUS_CHANGED: 'PARTNERSHIP_STATUS_CHANGED',

  // Lead / Inquiry events
  NEW_ATTRIBUTED_LEAD: 'NEW_ATTRIBUTED_LEAD',
  LEAD_STATUS_UPDATED: 'LEAD_STATUS_UPDATED',

  // Booking / Inventory events
  BOOKING_CREATED: 'BOOKING_CREATED',
  INVENTORY_STATUS_CHANGED: 'INVENTORY_STATUS_CHANGED',
  COMMISSION_CREATED: 'COMMISSION_CREATED',
};

module.exports = {
  initSocket,
  emitToUser,
  emitToUsers,
  SOCKET_EVENTS,
};
