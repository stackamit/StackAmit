import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiCheckCircle, FiClock, FiAward, FiFileText, FiUsers, FiX } from 'react-icons/fi';
import useNotifications from '../hooks/useNotifications';

const typeConfig = {
  task_assigned:     { icon: FiFileText,  color: 'text-blue-500',    bg: 'bg-blue-100 dark:bg-blue-900/30' },
  task_reminder:     { icon: FiClock,     color: 'text-amber-500',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  task_completed:    { icon: FiCheck,     color: 'text-green-500',   bg: 'bg-green-100 dark:bg-green-900/30' },
  certificate_issued:{ icon: FiAward,     color: 'text-purple-500',  bg: 'bg-purple-100 dark:bg-purple-900/30' },
  application_status:{ icon: FiFileText,  color: 'text-indigo-500',  bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  internship_approved:{icon: FiCheck,     color: 'text-green-500',   bg: 'bg-green-100 dark:bg-green-900/30' },
  welcome:           { icon: FiUsers,     color: 'text-primary-500', bg: 'bg-primary-100 dark:bg-primary-900/30' },
  general:           { icon: FiFileText,  color: 'text-dark-500',    bg: 'bg-dark-100 dark:bg-dark-700' },
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

const NotificationPanel = ({ role, isOpen, onClose }) => {
  const { notifications, unreadCount, loading, markAsRead, markAllRead, fetchNotifications } = useNotifications();
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = (type) => {
    const cfg = typeConfig[type] || typeConfig.general;
    const Icon = cfg.icon;
    return <Icon size={16} className={cfg.color} />;
  };

  const getBg = (type) => (typeConfig[type] || typeConfig.general).bg;

  return (
    <div
      ref={panelRef}
      className="absolute right-12 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-100 dark:border-dark-700 animate-scale-in z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-100 dark:border-dark-700">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-dark-900 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary-600 hover:text-primary-700 px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700">
            <FiX size={14} className="text-dark-400" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-dark-400">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center">
            <FiCheckCircle size={32} className="mx-auto text-dark-300 dark:text-dark-600 mb-2" />
            <p className="text-sm text-dark-500">All caught up!</p>
            <p className="text-xs text-dark-400 mt-1">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.general;
            return (
              <div
                key={n._id}
                onClick={() => !n.isRead && markAsRead(n._id)}
                className={`flex gap-3 px-4 py-3 border-b border-dark-50 dark:border-dark-700/50 cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${
                  !n.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                }`}
              >
                <div className={`w-8 h-8 rounded-full ${getBg(n.type)} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.isRead ? 'font-semibold text-dark-900 dark:text-white' : 'font-medium text-dark-700 dark:text-dark-300'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-dark-400 mt-1">{getTimeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-dark-100 dark:border-dark-700">
          <Link
            to={`/${role}/notifications`}
            onClick={onClose}
            className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium py-1"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
