import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

/**
 * Real-Time Socket.io Hook — Spec §7, §41
 *
 * Establishes an authenticated WebSocket connection to the server.
 * Automatically reconnects on disconnect. Cleans up on unmount.
 *
 * Usage:
 *   const { on, off, isConnected } = useSocket(token);
 *   useEffect(() => {
 *     on('PARTNERSHIP_REQUEST_CREATED', (data) => { ... });
 *     return () => off('PARTNERSHIP_REQUEST_CREATED');
 *   }, [on, off]);
 *
 * @param {string|null} token - JWT access token (from auth context)
 * @returns {{ on, off, isConnected }}
 */
export function useSocket(token) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!token) return; // Only connect when authenticated

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.debug('[Socket.io] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.debug('[Socket.io] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      // Non-fatal: real-time is enhancement, not blocker
      console.debug('[Socket.io] Connection error (will retry):', err.message);
    });

    // Re-attach any listeners that were registered before connect
    Object.entries(listenersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  /** Register a listener for a socket event */
  const on = useCallback((event, handler) => {
    listenersRef.current[event] = handler;
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  /** Remove a listener for a socket event */
  const off = useCallback((event) => {
    delete listenersRef.current[event];
    if (socketRef.current) {
      socketRef.current.off(event);
    }
  }, []);

  return { on, off };
}

/**
 * Real-time event name constants — must match server-side SOCKET_EVENTS.
 */
export const SOCKET_EVENTS = {
  PARTNERSHIP_REQUEST_CREATED: 'PARTNERSHIP_REQUEST_CREATED',
  PARTNERSHIP_STATUS_CHANGED: 'PARTNERSHIP_STATUS_CHANGED',
  NEW_ATTRIBUTED_LEAD: 'NEW_ATTRIBUTED_LEAD',
  LEAD_STATUS_UPDATED: 'LEAD_STATUS_UPDATED',
  BOOKING_CREATED: 'BOOKING_CREATED',
  INVENTORY_STATUS_CHANGED: 'INVENTORY_STATUS_CHANGED',
  COMMISSION_CREATED: 'COMMISSION_CREATED',
};
