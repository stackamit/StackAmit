import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCalendar, FiClock, FiRadio, FiX, FiAlertTriangle } from 'react-icons/fi';
import api from '../services/api';
import { formatDateIST, formatDateTimeIST } from '../utils/dateTime';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export const PRIORITY_STYLES = {
  urgent: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    card: 'border-2 border-red-200 dark:border-red-900/50',
    label: 'Urgent',
  },
  important: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    card: 'border-2 border-orange-200 dark:border-orange-900/40',
    label: 'Important',
  },
  normal: {
    badge: 'bg-dark-100 text-dark-600 dark:bg-dark-700/50 dark:text-dark-300',
    card: '',
    label: 'Normal',
  },
};

const isInternalUrl = (url) => url && url.startsWith('/');

// ─── Notice Detail Modal ─────────────────────────────────────────────────────
const NoticeDetailModal = ({ notice, onClose }) => {
  if (!notice) return null;

  const styles = PRIORITY_STYLES[notice.priority] || PRIORITY_STYLES.normal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={notice.title}
    >
      <div
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-info">{notice.category}</span>
            <span className={`badge ${styles.badge}`}>{styles.label}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notice"
            className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500"
          >
            <FiX size={18} />
          </button>
        </div>

        <h3 className="mt-4 text-xl font-bold text-dark-900 dark:text-white">{notice.title}</h3>
        <p className="mt-1 text-sm text-dark-500 dark:text-dark-400">
          Published {formatDateTimeIST(notice.publishAt || notice.createdAt)} IST
          {notice.expiresAt ? ` · Expires ${formatDateTimeIST(notice.expiresAt)} IST` : ''}
        </p>

        <div className="mt-4 text-dark-600 dark:text-dark-300 whitespace-pre-line leading-relaxed">
          {notice.content}
        </div>

        {notice.actionUrl && (
          <div className="mt-6">
            {isInternalUrl(notice.actionUrl) ? (
              <Link to={notice.actionUrl} className="btn-primary inline-flex items-center gap-2 text-sm" onClick={onClose}>
                {notice.actionLabel || 'View Details'} <FiArrowRight size={16} />
              </Link>
            ) : (
              <a
                href={notice.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                {notice.actionLabel || 'View Details'} <FiArrowRight size={16} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Public Notice Section (Home / Contact) ──────────────────────────────────
const NoticeSection = ({ page, title = 'Latest Notices & Announcements', limit = 6 }) => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/notices/public', { params: { page, limit } })
      .then(({ data }) => {
        if (!cancelled) setNotices(Array.isArray(data?.data?.notices) ? data.data.notices : []);
      })
      .catch((err) => {
        console.error('Failed to fetch notices:', err);
        if (!cancelled) setNotices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, limit]);

  return (
    <section className="py-20 bg-dark-50 dark:bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeInUp} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 dark:text-white flex items-center justify-center gap-3">
            <FiRadio className="text-primary-600 dark:text-primary-400" /> {title}
          </h2>
          <p className="mt-4 text-lg text-dark-500 dark:text-dark-400">
            Important updates, deadlines and announcements from StackAmit
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : notices.length === 0 ? (
          <motion.div {...fadeInUp} className="card p-10 text-center">
            <FiRadio size={40} className="mx-auto mb-3 text-dark-300 dark:text-dark-600" />
            <p className="text-lg font-medium text-dark-500 dark:text-dark-400">No active notices right now</p>
            <p className="text-sm text-dark-400 dark:text-dark-500 mt-1">Please check back later for updates and announcements.</p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notices.map((notice, i) => {
              const styles = PRIORITY_STYLES[notice.priority] || PRIORITY_STYLES.normal;
              return (
                <motion.div
                  key={notice._id}
                  {...fadeInUp}
                  transition={{ delay: i * 0.05 }}
                  className={`card p-6 flex flex-col ${styles.card} ${notice.priority === 'urgent' ? 'md:col-span-2 lg:col-span-3' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {notice.priority === 'urgent' && <FiAlertTriangle size={16} className="text-red-500" />}
                    <span className="badge badge-info">{notice.category}</span>
                    {notice.priority !== 'normal' && (
                      <span className={`badge ${styles.badge}`}>{styles.label}</span>
                    )}
                    {notice.isPinned && <span className="badge badge-warning">Pinned</span>}
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-dark-900 dark:text-white line-clamp-2">
                    {notice.title}
                  </h3>
                  <p className="mt-2 text-sm text-dark-500 dark:text-dark-400 line-clamp-3 flex-1">
                    {notice.summary || notice.content}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs text-dark-400 dark:text-dark-500">
                      <FiCalendar size={13} /> {formatDateIST(notice.publishAt || notice.createdAt)}
                      {notice.expiresAt && (
                        <span className="ml-2 flex items-center gap-1">
                          · <FiClock size={13} /> until {formatDateIST(notice.expiresAt)}
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => setSelected(notice)}
                      className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      View Details
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <NoticeDetailModal notice={selected} onClose={() => setSelected(null)} />}
    </section>
  );
};

export default NoticeSection;
