import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

/**
 * Real-Time Socket.io Hook — Spec §7, §41
 *
 * Establishes an authenticated WebSocket connection to the server.
 * Uses a module-level singleton socket to avoid spawning multiple concurrent
 * connections when multiple components mount simultaneously (e.g., dashboards).
 *
 * Usage:
 *   const { on, off } = useSocket(token);
 *   useEffect(() => {
 *     on('PARTNERSHIP_REQUEST_CREATED', (data) => { ... });
 *     return () => off('PARTNERSHIP_REQUEST_CREATED');
 *   }, [on, off]);
 *
 * @param {string|null} token - JWT access token (from auth context)
 * @returns {{ on, off }}
 */

// Module-level singleton — shared across all hook instances
let sharedSocket = null;
let consumerCount = 0;
let currentToken = null;

function getOrCreateSocket(token) {
  // If token changed (e.g. after re-login), disconnect and recreate
  if (sharedSocket && currentToken !== token) {
    sharedSocket.disconnect();
    sharedSocket = null;
    consumerCount = 0;
    currentToken = null;
  }
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    sharedSocket.on('connect_error', (_err) => {
      // Non-fatal: real-time is enhancement, not blocker — silently retry
    });
    currentToken = token;
  }
  return sharedSocket;
}

export function useSocket(token) {
  const listenersRef = useRef({});

  useEffect(() => {
    if (!token) return; // Only connect when authenticated

    const socket = getOrCreateSocket(token);
    consumerCount++;

    // Re-attach any listeners registered before this effect ran
    Object.entries(listenersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // Remove only this component's listeners from the shared socket
      Object.entries(listenersRef.current).forEach(([event, handler]) => {
        socket.off(event, handler);
      });

      consumerCount--;
      // Disconnect and destroy the singleton only when no consumers remain
      if (consumerCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        currentToken = null;
        consumerCount = 0;
      }
    };
  }, [token]);

  /** Register a listener for a socket event */
  const on = useCallback((event, handler) => {
    listenersRef.current[event] = handler;
    if (sharedSocket) {
      sharedSocket.on(event, handler);
    }
  }, []);

  /** Remove a listener for a socket event */
  const off = useCallback((event) => {
    const handler = listenersRef.current[event];
    if (handler && sharedSocket) {
      sharedSocket.off(event, handler);
    }
    delete listenersRef.current[event];
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
