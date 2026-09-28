import { useEffect, useRef } from 'react';

export const SYNC_EVENTS = {
  AUTH: 'AUTH_STATE_CHANGED',
  ROLES: 'ROLE_REQUESTS_OR_PERMISSIONS_CHANGED',
  INQUIRIES: 'INQUIRIES_OR_VISITS_CHANGED',
  PROPERTIES: 'PROPERTIES_OR_INVENTORY_CHANGED',
  WISHLIST: 'WISHLIST_CHANGED',
  PARTNERSHIPS: 'PARTNERSHIPS_CHANGED',
  BOOKINGS: 'BOOKINGS_CHANGED',
  ALL: '*',
};

const CHANNEL_NAME = 'estatexplorer_realtime_sync';

// In-memory listeners for the current tab
const listeners = new Set();

let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type) {
        notifyListeners(event.data.type, event.data.payload, true);
      }
    };
  } catch (err) {
    console.warn('[RealtimeSync] BroadcastChannel init error, falling back to local listeners');
  }
}

// Fallback for storage events across tabs if BroadcastChannel is unavailable
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CHANNEL_NAME && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.type) {
          notifyListeners(parsed.type, parsed.payload, true);
        }
      } catch (err) {
        // ignore
      }
    }
  });
}

function notifyListeners(type, payload, isRemote = false) {
  if (type === SYNC_EVENTS.PROPERTIES || type === SYNC_EVENTS.ALL) {
    if (typeof window !== 'undefined' && window.__invalidateClientPropertyCache) {
      window.__invalidateClientPropertyCache();
    }
  }

  listeners.forEach((handler) => {
    try {
      handler({ type, payload, isRemote, timestamp: Date.now() });
    } catch (err) {
      console.error('[RealtimeSync] Listener execution error:', err);
    }
  });
}

/**
 * Broadcast an event to all subscribers in the current tab and all other open tabs
 */
export function broadcastRealtimeSync(type, payload = {}) {
  // Notify local listeners
  notifyListeners(type, payload, false);

  // Broadcast to other tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch (err) {
      // ignore
    }
  }

  // LocalStorage ping fallback for older browsers / isolated contexts
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        CHANNEL_NAME,
        JSON.stringify({ type, payload, _t: Date.now() })
      );
    } catch (err) {
      // ignore
    }
  }
}

/**
 * React Hook to subscribe to real-time sync events with auto focus-revalidation & interval polling
 */
export function useRealtimeSync(
  eventTypes = [SYNC_EVENTS.ALL],
  onSyncCallback,
  options = { revalidateOnFocus: true, intervalMs: 0 }
) {
  const callbackRef = useRef(onSyncCallback);
  callbackRef.current = onSyncCallback;

  const targetTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

  useEffect(() => {
    const handler = ({ type, payload, isRemote }) => {
      if (
        targetTypes.includes(SYNC_EVENTS.ALL) ||
        targetTypes.includes(type)
      ) {
        if (typeof callbackRef.current === 'function') {
          callbackRef.current({ type, payload, isRemote });
        }
      }
    };

    listeners.add(handler);

    // Focus & visibility change revalidation
    const handleFocusOrVisible = () => {
      if (
        options.revalidateOnFocus !== false &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        if (typeof callbackRef.current === 'function') {
          callbackRef.current({ type: 'WINDOW_FOCUS_REVALIDATE', isRemote: false });
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocusOrVisible);
      document.addEventListener('visibilitychange', handleFocusOrVisible);
    }

    // Optional background interval polling (if intervalMs > 0)
    let intervalTimer = null;
    if (options.intervalMs && options.intervalMs > 0) {
      intervalTimer = setInterval(() => {
        if (
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible'
        ) {
          if (typeof callbackRef.current === 'function') {
            callbackRef.current({ type: 'INTERVAL_POLL', isRemote: false });
          }
        }
      }, options.intervalMs);
    }

    return () => {
      listeners.delete(handler);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocusOrVisible);
        document.removeEventListener('visibilitychange', handleFocusOrVisible);
      }
      if (intervalTimer) {
        clearInterval(intervalTimer);
      }
    };
  }, [targetTypes.join(','), options.revalidateOnFocus, options.intervalMs]);
}
