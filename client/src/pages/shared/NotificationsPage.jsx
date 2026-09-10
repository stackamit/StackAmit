import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiCheckCircle, FiClock, FiAward, FiFileText, FiUsers, FiTrash2, FiFilter } from 'react-icons/fi';
import api from '../../services/api';

const typeConfig = {
  task_assigned:      { icon: FiFileText,  color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30',    label: 'Task' },
  task_reminder:      { icon: FiClock,     color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30',   label: 'Reminder' },
  task_completed:     { icon: FiCheck,     color: 'text-green-500',   bg: 'bg-green-100 dark:bg-green-900/30',   label: 'Completed' },
  certificate_issued: { icon: FiAward,     color: 'text-purple-500',  bg: 'bg-purple-100 dark:bg-purple-900/30', label: 'Certificate' },
  application_status: { icon: FiFileText,  color: 'text-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/30', label: 'Application' },
  internship_approved:{ icon: FiCheck,     color: 'text-green-500',   bg: 'bg-green-100 dark:bg-green-900/30',   label: 'Internship' },
  welcome:            { icon: FiUsers,     color: 'text-primary-500', bg: 'bg-primary-100 dark:bg-primary-900/30',label: 'Welcome' },
  general:            { icon: FiBell,      color: 'text-dark-500',    bg: 'bg-dark-100 dark:bg-dark-700',        label: 'General' },
};

const getTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (filter === 'unread') params.isRead = 'false';
      if (filter === 'read') params.isRead = 'true';
      const res = await api.get('/notifications', { params });
      const data = res.data?.data;
      if (data) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, [filter]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) { console.error(err); }
  };

  const getIcon = (type) => {
    const cfg = typeConfig[type] || typeConfig.general;
    const Icon = cfg.icon;
    return <Icon size={18} className={cfg.color} />;
  };
  const getBg = (type) => (typeConfig[type] || typeConfig.general).bg;
  const getLabel = (type) => (typeConfig[type] || typeConfig.general).label;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-dark-900 dark:text-white flex items-center gap-2">
            <FiBell className="text-primary-500" /> Notifications
          </h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1">
              <FiCheckCircle size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <FiFilter size={14} className="text-dark-400" />
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1 px-1 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="card p-0 divide-y divide-dark-100 dark:divide-dark-700">
        {loading ? (
          <div className="p-8 text-center text-dark-400">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <FiCheckCircle size={40} className="mx-auto text-dark-300 dark:text-dark-600 mb-3" />
            <p className="text-dark-600 dark:text-dark-400 font-medium">No notifications</p>
            <p className="text-dark-400 text-sm mt-1">
              {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications`}
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              className={`flex gap-4 p-4 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${
                !n.isRead ? 'bg-primary-50/30 dark:bg-primary-900/5' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-full ${getBg(n.type)} flex items-center justify-center flex-shrink-0`}>
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm ${!n.isRead ? 'font-semibold text-dark-900 dark:text-white' : 'font-medium text-dark-700 dark:text-dark-300'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mt-0.5">{n.message}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getBg(n.type)} ${typeConfig[n.type]?.color || 'text-dark-500'}`}>
                    {getLabel(n.type)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-dark-400">{getTimeAgo(n.createdAt)}</span>
                  {!n.isRead && (
                    <button
                      onClick={() => markAsRead(n._id)}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <FiCheck size={12} /> Mark as read
                    </button>
                  )}
                </div>
              </div>
              {!n.isRead && (
                <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
