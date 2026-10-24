import { useState, useEffect, useRef } from 'react';
import {
  FiSearch, FiPlus, FiRefreshCw, FiMoreVertical, FiTrash2, FiEye, FiEyeOff,
  FiEdit3, FiRadio, FiFlag,
} from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { toLocalInputValue, fromLocalInputValue, formatDateTimeIST } from '../../utils/dateTime';

const CATEGORIES = [
  'Internship Updates',
  'Project Submission',
  'Important Announcements',
  'General Updates',
  'Maintenance & Service Updates',
  'Events & Training',
];

const PRIORITIES = ['normal', 'important', 'urgent'];

const EMPTY_FORM = {
  title: '', summary: '', content: '',
  category: 'Important Announcements', priority: 'normal',
  targetPages: ['home'],
  publishMode: 'now', publishAt: '', expiresAt: '',
  actionLabel: '', actionUrl: '', isPinned: false,
};

const priorityBadge = (p) => ({
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  important: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  normal: 'bg-dark-100 text-dark-600 dark:bg-dark-700/50 dark:text-dark-300',
}[p] || 'bg-dark-100 text-dark-600 dark:bg-dark-700/50 dark:text-dark-300');

const statusBadge = (s) => ({
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  unpublished: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}[s] || 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400');

const pageLabel = (pages) => {
  if (pages?.includes('home') && pages?.includes('contact')) return 'Home + Contact';
  if (pages?.includes('home')) return 'Home Page';
  if (pages?.includes('contact')) return 'Contact Page';
  return '—';
};

const AdminNotices = () => {
  const [search, setSearch] = useState('');
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [actionMenu, setActionMenu] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // notice being edited (full doc)
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detailNotice, setDetailNotice] = useState(null);

  const fetchNotices = async (pageNum = 1, limitNum = 20) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: limitNum };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const { data } = await api.get('/notices', { params });
      const list = data?.data?.notices;
      setNotices(Array.isArray(list) ? list : []);
      setPagination(prev => ({ ...prev, page: pageNum, limit: limitNum, total: data.data.total, pages: data.data.pages }));
    } catch (err) {
      console.error('Failed to fetch notices:', err);
      setNotices([]);
    } finally { setLoading(false); }
  };

  // Initial load
  useEffect(() => { fetchNotices(1, 20); }, []);

  // Debounced filter/search (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const t = setTimeout(() => { fetchNotices(1, 20); }, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, categoryFilter, priorityFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = async (id) => {
    setActionMenu(null);
    try {
      const { data } = await api.get(`/notices/${id}`);
      const n = data.data.notice;
      setEditing(n);
      setForm({
        title: n.title || '',
        summary: n.summary || '',
        content: n.content || '',
        category: n.category || 'Important Announcements',
        priority: n.priority || 'normal',
        targetPages: n.targetPages?.length ? n.targetPages : ['home'],
        publishMode:
          n.editorialStatus === 'scheduled' ? 'schedule'
            : n.editorialStatus === 'published' ? 'now' : 'draft',
        publishAt: toLocalInputValue(n.publishAt),
        expiresAt: toLocalInputValue(n.expiresAt),
        actionLabel: n.actionLabel || '',
        actionUrl: n.actionUrl || '',
        isPinned: Boolean(n.isPinned),
      });
      setModalOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load notice');
    }
  };

  const toggleTargetPage = (page) => {
    setForm(prev => {
      const has = prev.targetPages.includes(page);
      const next = has ? prev.targetPages.filter(p => p !== page) : [...prev.targetPages, page];
      return { ...prev, targetPages: next.length ? next : prev.targetPages };
    });
  };

  const validateForm = () => {
    if (!form.title.trim()) return 'Notice title is required';
    if (!form.content.trim()) return 'Notice message is required';
    if (!form.targetPages.length) return 'Select at least one page to display on';
    if (form.publishMode === 'schedule' && !form.publishAt) return 'Scheduled notices need a publication date and time';
    const publishISO = fromLocalInputValue(form.publishAt);
    const expiryISO = fromLocalInputValue(form.expiresAt);
    if (publishISO && expiryISO && new Date(expiryISO) <= new Date(publishISO)) {
      return 'Expiry must be later than the publication time';
    }
    if (form.actionUrl && !form.actionUrl.startsWith('/') && !/^https?:\/\//i.test(form.actionUrl)) {
      return 'Action URL must start with / (internal) or http(s)://';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) { toast.error(error); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        content: form.content,
        category: form.category,
        priority: form.priority,
        targetPages: form.targetPages,
        publishMode: form.publishMode,
        publishAt: fromLocalInputValue(form.publishAt) || undefined,
        expiresAt: fromLocalInputValue(form.expiresAt) || undefined,
        actionLabel: form.actionLabel,
        actionUrl: form.actionUrl,
        isPinned: form.isPinned,
      };
      if (editing) {
        await api.put(`/notices/${editing._id}`, payload);
        toast.success('Notice updated successfully');
      } else {
        await api.post('/notices', payload);
        toast.success('Notice created successfully');
      }
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await fetchNotices(pagination.page, pagination.limit);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save notice');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/notices/${id}/status`, { status });
      toast.success(status === 'published' ? 'Notice published' : 'Notice unpublished');
      setActionMenu(null);
      await fetchNotices(pagination.page, pagination.limit);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notice? It will disappear from all public pages immediately.')) return;
    try {
      await api.delete(`/notices/${id}`);
      toast.success('Notice deleted');
      setActionMenu(null);
      await fetchNotices(pagination.page, pagination.limit);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete notice');
    }
  };

  const viewDetail = async (id) => {
    setActionMenu(null);
    try {
      const { data } = await api.get(`/notices/${id}`);
      setDetailNotice(data.data.notice);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load notice');
    }
  };

  return (
    <div onClick={() => setActionMenu(null)}>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Notice Management</h1>
          <p className="page-subtitle">Create, schedule and publish notices for public pages</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <FiPlus size={16} /> Create Notice
        </button>
      </div>

      <div className="table-container">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search notices..." />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field py-2 w-auto">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
            <option value="expired">Expired</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field py-2 w-auto">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="input-field py-2 w-auto">
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <button onClick={() => fetchNotices(pagination.page, pagination.limit)} className="btn-outline flex items-center gap-2 text-sm">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Display On</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Publish At</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Expires At</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Created By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Updated</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {loading ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center">
                  <FiRefreshCw size={24} className="animate-spin text-primary-500 mx-auto" />
                  <p className="text-dark-400 mt-2">Loading...</p>
                </td></tr>
              ) : notices.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-dark-400">
                  <FiRadio size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">No notices found</p>
                  <p className="text-sm mt-1">Create your first notice to display on public pages.</p>
                </td></tr>
              ) : notices.map(n => (
                <tr key={n._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-dark-900 dark:text-white text-sm flex items-center gap-1.5">
                      {n.isPinned && <FiFlag size={13} className="text-primary-500" />}
                      {n.title}
                    </p>
                    <p className="text-xs text-dark-400 truncate max-w-[220px]">{n.summary}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{n.category}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${priorityBadge(n.priority)}`}>{n.priority}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(n.effectiveStatus)}`}>{n.effectiveStatus}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{pageLabel(n.targetPages)}</td>
                  <td className="px-6 py-4 text-xs text-dark-500">{n.publishAt ? formatDateTimeIST(n.publishAt) : '—'}</td>
                  <td className="px-6 py-4 text-xs text-dark-500">{n.expiresAt ? formatDateTimeIST(n.expiresAt) : 'Never'}</td>
                  <td className="px-6 py-4 text-xs text-dark-500">{n.createdBy?.name || [n.createdBy?.firstName, n.createdBy?.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-6 py-4 text-xs text-dark-500">{formatDateTimeIST(n.updatedAt)}</td>
                  <td className="px-6 py-4 relative">
                    <button onClick={(e) => { e.stopPropagation(); setActionMenu(actionMenu === n._id ? null : n._id); }} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                      <FiMoreVertical size={16} className="text-dark-500" />
                    </button>
                    {actionMenu === n._id && (
                      <div className="absolute right-6 top-12 z-10 w-44 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 py-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => viewDetail(n._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-50 dark:hover:bg-dark-700/50"><FiEye size={16} /> View</button>
                        <button onClick={() => openEdit(n._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"><FiEdit3 size={16} /> Edit</button>
                        {(n.editorialStatus === 'draft' || n.editorialStatus === 'unpublished') && n.effectiveStatus !== 'expired' && (
                          <button onClick={() => handleStatusChange(n._id, 'published')} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"><FiEye size={16} /> Publish</button>
                        )}
                        {n.editorialStatus === 'published' && (
                          <button onClick={() => handleStatusChange(n._id, 'unpublished')} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"><FiEyeOff size={16} /> Unpublish</button>
                        )}
                        <button onClick={() => handleDelete(n._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><FiTrash2 size={16} /> Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && notices.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-500">Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchNotices(pagination.page - 1, pagination.limit)} disabled={pagination.page === 1} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Previous</button>
              <span className="text-sm text-dark-500">Page {pagination.page}/{pagination.pages}</span>
              <button onClick={() => fetchNotices(pagination.page + 1, pagination.limit)} disabled={pagination.page >= pagination.pages} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">
              {editing ? 'Edit Notice' : 'Create Notice'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Notice Title *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Notice title" maxLength={200} />
              </div>
              <div>
                <label className="label">Short Summary</label>
                <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} className="input-field" rows={2} maxLength={500} placeholder="One or two lines shown on the notice card (optional)" />
              </div>
              <div>
                <label className="label">Full Notice Message *</label>
                <textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="input-field" rows={5} maxLength={10000} placeholder="The complete notice text" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Category *</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority *</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="input-field">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Display On *</label>
                <div className="flex flex-wrap gap-4 mt-1">
                  {[{ value: 'home', label: 'Home Page' }, { value: 'contact', label: 'Contact Us Page' }].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-dark-700 dark:text-dark-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.targetPages.includes(opt.value)}
                        onChange={() => toggleTargetPage(opt.value)}
                        className="rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Publish Mode *</label>
                <div className="flex flex-wrap gap-4 mt-1">
                  {[
                    { value: 'now', label: 'Publish Now' },
                    { value: 'schedule', label: 'Schedule' },
                    { value: 'draft', label: 'Save as Draft' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-dark-700 dark:text-dark-200 cursor-pointer">
                      <input
                        type="radio"
                        name="publishMode"
                        checked={form.publishMode === opt.value}
                        onChange={() => setForm({ ...form, publishMode: opt.value })}
                        className="border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Publication Date & Time {form.publishMode === 'schedule' ? '*' : '(optional)'}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={e => setForm({ ...form, publishAt: e.target.value })}
                    className="input-field"
                  />
                  <p className="text-xs text-dark-400 mt-1">Stored in UTC · shown in your local time</p>
                </div>
                <div>
                  <label className="label">Expiry Date & Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                    className="input-field"
                  />
                  <p className="text-xs text-dark-400 mt-1">Notice disappears from public pages after this time</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Action Button Label</label>
                  <input value={form.actionLabel} onChange={e => setForm({ ...form, actionLabel: e.target.value })} className="input-field" placeholder="e.g. Apply Now, View Details" maxLength={40} />
                </div>
                <div>
                  <label className="label">Action URL</label>
                  <input value={form.actionUrl} onChange={e => setForm({ ...form, actionUrl: e.target.value })} className="input-field" placeholder="/internships or https://..." maxLength={500} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-dark-700 dark:text-dark-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={e => setForm({ ...form, isPinned: e.target.checked })}
                  className="rounded border-dark-300 dark:border-dark-600 text-primary-600 focus:ring-primary-500"
                />
                Pin this notice to the top of its section
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-outline text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Detail Modal */}
      {detailNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailNotice(null)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-info">{detailNotice.category}</span>
                <span className={`badge ${priorityBadge(detailNotice.priority)} capitalize`}>{detailNotice.priority}</span>
                <span className={`badge ${statusBadge(detailNotice.effectiveStatus)} capitalize`}>{detailNotice.effectiveStatus}</span>
              </div>
              <button onClick={() => setDetailNotice(null)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500"><FiEyeOff size={18} /></button>
            </div>
            <h3 className="mt-4 text-xl font-bold text-dark-900 dark:text-white">{detailNotice.title}</h3>
            {detailNotice.summary && <p className="mt-2 text-sm font-medium text-dark-500 dark:text-dark-400">{detailNotice.summary}</p>}
            <p className="mt-1 text-xs text-dark-400">
              Publish: {detailNotice.publishAt ? formatDateTimeIST(detailNotice.publishAt) : '—'} IST
              {' · '}Expires: {detailNotice.expiresAt ? formatDateTimeIST(detailNotice.expiresAt) : 'Never'} IST
            </p>
            <div className="mt-4 text-sm text-dark-600 dark:text-dark-300 whitespace-pre-line leading-relaxed">{detailNotice.content}</div>
            {detailNotice.actionUrl && (
              <p className="mt-4 text-xs text-dark-500">
                Action: <span className="font-medium">{detailNotice.actionLabel || 'View'}</span> → {detailNotice.actionUrl}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;
