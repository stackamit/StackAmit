import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const useNotifications = (pollInterval = 30000) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const res = await api.get('/notifications', { params: { limit: 20 } });
      const data = res.data?.data;
      if (data) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data?.data?.count || 0);
    } catch (err) {
      // Silent fail for polling
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications(true);
    intervalRef.current = setInterval(fetchUnreadCount, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchNotifications, fetchUnreadCount, pollInterval]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllRead,
  };
};

export default useNotifications;
