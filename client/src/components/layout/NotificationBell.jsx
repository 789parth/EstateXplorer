import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, Clock, Mail, MessageSquare, AlertCircle, Calendar, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getNotificationLogsApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi,
} from '../../services/notificationService';
import { useAuth } from '../../hooks/useAuth';

const NotificationBell = () => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;
    try {
      if (!isSilent) setLoading(true);
      const res = await getNotificationLogsApi({ page: 1, limit: 15 });
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        const unread = typeof res.unreadCount === 'number'
          ? res.unreadCount
          : res.data.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.warn('[NotificationBell] Failed to fetch:', err?.message || err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch and auto-polling (paused when document is hidden in background tab)
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(false);
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          fetchNotifications(true);
        }
      }, 30000);

      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          fetchNotifications(true);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isAuthenticated, fetchNotifications]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    try {
      await markNotificationAsReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(true);
        }}
        aria-label="Notifications"
        className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-blue-600 animate-wiggle' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-[1100] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  You'll be alerted when inquiries, tours, or status updates occur.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isVisit = item.type?.includes('VISIT');
                const isLead = item.type?.includes('LEAD');
                return (
                  <div
                    key={item._id}
                    className={`p-3.5 transition-colors flex items-start gap-3 text-left ${
                      item.isRead ? 'bg-white hover:bg-slate-50/80' : 'bg-blue-50/40 hover:bg-blue-50/70'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isVisit
                          ? 'bg-purple-100 text-purple-600'
                          : isLead
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      {isVisit ? (
                        <Calendar size={15} />
                      ) : isLead ? (
                        <MessageSquare size={15} />
                      ) : (
                        <Mail size={15} />
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {item.title || (isVisit ? 'Site Tour Alert' : 'Notification Alert')}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 font-normal">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 pt-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {item.channel} &bull; {item.status}
                        </span>
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(item._id, e)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                          >
                            <Check size={12} /> Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
            <Link
              to="/dashboard"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>Go to Dashboard</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(NotificationBell);

