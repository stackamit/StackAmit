import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiRefreshCw, FiMoreVertical, FiTrash2, FiStar, FiMessageSquare, FiSend, FiEye, FiArchive, FiCheckCircle, FiMail } from 'react-icons/fi';
import api from '../../services/api';

const FEEDBACK_TYPES = ['general', 'bug', 'feature', 'testimonial', 'complaint'];
const STATUS_OPTIONS = ['pending', 'read', 'replied', 'archived'];

const AdminFeedback = () => {
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, read: 0, replied: 0, archived: 0, avgRating: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionMenu, setActionMenu] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const isInitialMount = useRef(true);

  const fetchFeedback = async (pageNum = 1, limitNum = 20) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: limitNum };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get('/feedback', { params });
      const list = data?.data?.feedback;
      setFeedback(Array.isArray(list) ? list : []);
      setPagination(prev => ({ ...prev, total: data.data.total, pages: data.data.pages }));
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
      setFeedback([]);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/feedback/stats');
      setStats(data.data);
    } catch (err) { console.error('Failed to fetch stats:', err); }
  };

  useEffect(() => { fetchFeedback(1, 20); fetchStats(); }, []);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const t = setTimeout(() => { fetchFeedback(1, 20); }, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, typeFilter]);

  const openDetail = async (id) => {
    try {
      const { data } = await api.get(`/feedback/${id}`);
      setSelectedFeedback(data.data.feedback);
      setShowDetail(true);
      setActionMenu(null);
      setReplyText(data.data.feedback.adminReply || '');
    } catch (err) { console.error('Failed to fetch feedback detail:', err); }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      const { data } = await api.post(`/feedback/${selectedFeedback._id}/reply`, { adminReply: replyText });
      setSelectedFeedback(data.data.feedback);
      fetchFeedback(pagination.page, pagination.limit);
      fetchStats();
    } catch (err) { console.error('Failed to reply:', err); }
    finally { setReplying(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/feedback/${id}/status`, { status });
      fetchFeedback(pagination.page, pagination.limit);
      fetchStats();
      setActionMenu(null);
    } catch (err) { console.error('Failed to update status:', err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this feedback permanently?')) return;
    try {
      await api.delete(`/feedback/${id}`);
      fetchFeedback(pagination.page, pagination.limit);
      fetchStats();
      setShowDetail(false);
      setActionMenu(null);
    } catch (err) { console.error('Failed to delete:', err); }
  };

  const statusColor = (s) => ({
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    read: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    replied: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    archived: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  }[s] || 'bg-gray-100 text-gray-700');

  const typeColor = (t) => ({
    general: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
    bug: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    feature: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    testimonial: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    complaint: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }[t] || 'bg-gray-100 text-gray-700');

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const renderStars = (rating) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <FiStar key={s} size={14} className={s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-dark-300 dark:text-dark-600'} />
      ))}
    </div>
  );

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Feedback Management</h1>
          <p className="page-subtitle">View and manage all user feedback</p>
        </div>
        <button onClick={() => { fetchFeedback(1, 20); fetchStats(); }} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'bg-dark-50 dark:bg-dark-800/50' },
          { label: 'Pending', value: stats.pending, color: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Read', value: stats.read, color: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Replied', value: stats.replied, color: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Archived', value: stats.archived, color: 'bg-gray-50 dark:bg-gray-900/20' },
          { label: 'Avg Rating', value: stats.avgRating ? stats.avgRating + '/5' : 'N/A', color: 'bg-primary-50 dark:bg-primary-900/20' },
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} rounded-xl p-4 text-center`}>
            <p className="text-xs text-dark-500 dark:text-dark-400">{stat.label}</p>
            <p className="text-xl font-bold text-dark-900 dark:text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search by name, email, subject..." />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field py-2 w-auto">
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field py-2 w-auto">
            <option value="">All Types</option>
            {FEEDBACK_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><FiRefreshCw size={24} className="animate-spin text-primary-500 mx-auto" /><p className="text-dark-400 mt-2">Loading...</p></td></tr>
              ) : feedback.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-dark-400"><FiMessageSquare size={40} className="mx-auto mb-3 opacity-30" /><p className="text-lg font-medium">No feedback yet</p><p className="text-sm mt-1">Feedback from users will appear here.</p></td></tr>
              ) : feedback.map(fb => (
                <tr key={fb._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors cursor-pointer" onClick={() => openDetail(fb._id)}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-dark-900 dark:text-white text-sm">{fb.name}</p>
                    <p className="text-xs text-dark-400">{fb.email}</p>
                    <span className="text-xs text-dark-400 capitalize">{fb.userType}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-700 dark:text-dark-300 max-w-[200px] truncate">{fb.subject}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColor(fb.type)}`}>{fb.type}</span></td>
                  <td className="px-6 py-4">{renderStars(fb.rating)}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(fb.status)}`}>{fb.status}</span></td>
                  <td className="px-6 py-4 text-xs text-dark-500">{formatDate(fb.createdAt)}</td>
                  <td className="px-6 py-4 relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setActionMenu(actionMenu === fb._id ? null : fb._id)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                      <FiMoreVertical size={16} className="text-dark-500" />
                    </button>
                    {actionMenu === fb._id && (
                      <div className="absolute right-6 top-10 z-10 w-44 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 py-1">
                        <button onClick={() => openDetail(fb._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700"><FiEye size={16} /> View</button>
                        {fb.status !== 'replied' && <button onClick={() => handleStatusChange(fb._id, 'replied')} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"><FiCheckCircle size={16} /> Mark Replied</button>}
                        {fb.status !== 'archived' && <button onClick={() => handleStatusChange(fb._id, 'archived')} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20"><FiArchive size={16} /> Archive</button>}
                        <button onClick={() => handleDelete(fb._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><FiTrash2 size={16} /> Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && feedback.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-500">Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Previous</button>
              <span className="text-sm text-dark-500">Page {pagination.page}/{pagination.pages}</span>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.pages} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail / Reply Modal */}
      {showDetail && selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-dark-900 dark:text-white">{selectedFeedback.subject}</h2>
                <p className="text-sm text-dark-400 mt-1">From {selectedFeedback.name} ({selectedFeedback.email})</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(selectedFeedback.status)}`}>{selectedFeedback.status}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeColor(selectedFeedback.type)}`}>{selectedFeedback.type}</span>
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-dark-100 dark:border-dark-700">
              <div className="flex items-center gap-2 text-sm text-dark-500">
                {renderStars(selectedFeedback.rating)}
                <span>({selectedFeedback.rating}/5)</span>
              </div>
              <span className="text-sm text-dark-400">Submitted: {formatDate(selectedFeedback.createdAt)}</span>
              <span className="text-sm text-dark-400 capitalize">User type: {selectedFeedback.userType}</span>
            </div>

            {/* Message */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2">Feedback Message</h3>
              <div className="bg-dark-50 dark:bg-dark-900 rounded-xl p-4 text-sm text-dark-600 dark:text-dark-400 whitespace-pre-wrap">
                {selectedFeedback.message}
              </div>
            </div>

            {/* Existing Reply */}
            {selectedFeedback.adminReply && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                  <FiCheckCircle size={16} /> Admin Reply ({formatDate(selectedFeedback.repliedAt)})
                </h3>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">
                  {selectedFeedback.adminReply}
                </div>
              </div>
            )}

            {/* Reply Form */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-2 flex items-center gap-2">
                <FiMail size={16} /> {selectedFeedback.adminReply ? 'Update Reply' : 'Write a Reply'}
              </h3>
              <textarea
                rows={4}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="input-field resize-none"
                placeholder="Type your reply to this feedback..."
              />
              <div className="flex justify-end gap-3 mt-3">
                <button
                  onClick={handleReply}
                  disabled={replying || !replyText.trim()}
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {replying ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <FiSend size={14} />}
                  {replying ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
              <select
                value={selectedFeedback.status}
                onChange={e => handleStatusChange(selectedFeedback._id, e.target.value)}
                className="input-field py-2 text-sm w-auto"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <button onClick={() => handleDelete(selectedFeedback._id)} className="btn-outline text-sm text-red-600 flex items-center gap-2">
                <FiTrash2 size={14} /> Delete
              </button>
              <button onClick={() => setShowDetail(false)} className="btn-outline text-sm ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;
