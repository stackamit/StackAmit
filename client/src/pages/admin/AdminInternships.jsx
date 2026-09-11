import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiRefreshCw, FiMoreVertical, FiTrash2, FiLock, FiBriefcase, FiEye } from 'react-icons/fi';
import api from '../../services/api';

const AdminInternships = () => {
  const [search, setSearch] = useState('');
  const [internships, setInternships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, published: 0, closed: 0, active: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [actionMenu, setActionMenu] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: 'Web Development', duration: { weeks: 8, hoursPerWeek: 20 }, seats: { total: 10 }, deadline: '', startDate: '', endDate: '', eligibility: '', skills: '' });
  const [saving, setSaving] = useState(false);

  const categories = ['Web Development', 'Mobile Development', 'Data Science', 'Machine Learning', 'UI/UX Design', 'Digital Marketing', 'Cloud Computing', 'Cyber Security', 'DevOps', 'Blockchain', 'Artificial Intelligence', 'Python Programming', 'Java Programming', 'Business Analytics', 'Other'];

  const fetchInternships = async (pageNum = 1, limitNum = 20) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: limitNum };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await api.get('/internships', { params });
      const list = data?.data?.internships;
      setInternships(Array.isArray(list) ? list : []);
      setPagination(prev => ({ ...prev, total: data.data.total, pages: data.data.pages }));
    } catch (err) {
      console.error('Failed to fetch internships:', err);
      setInternships([]);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try { const { data } = await api.get('/internships/stats'); setStats(data.data); }
    catch (err) { console.error('Failed to fetch stats:', err); }
  };

  // Initial load
  useEffect(() => { fetchInternships(1, 20); fetchStats(); }, []);

  // Debounced filter/search (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const t = setTimeout(() => { fetchInternships(1, 20); }, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, categoryFilter]);

  const handleClose = async (id) => {
    try { await api.patch(`/internships/${id}/close`); fetchInternships(1, 20); fetchStats(); setActionMenu(null); }
    catch (err) { console.error('Failed to close:', err); }
  };
  const handleReopen = async (id) => {
    try { await api.patch(`/internships/${id}/publish`); fetchInternships(1, 20); fetchStats(); setActionMenu(null); }
    catch (err) { console.error('Failed to reopen:', err); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this internship?')) return;
    try { await api.delete(`/internships/${id}`); fetchInternships(1, 20); fetchStats(); setActionMenu(null); }
    catch (err) { console.error('Failed to delete:', err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, skills: form.skills.split(',').map(s => s.trim()).filter(Boolean), deadline: form.deadline || undefined, startDate: form.startDate || undefined, endDate: form.endDate || undefined };
      await api.post('/internships', payload);
      setShowCreate(false); setForm({ title: '', description: '', category: 'Web Development', duration: { weeks: 8, hoursPerWeek: 20 }, seats: { total: 10 }, deadline: '', startDate: '', endDate: '', eligibility: '', skills: '' });
      await fetchInternships(1, 20); await fetchStats();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  const statusColor = (s) => ({ published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }[s] || 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400');
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">Internship Management</h1><p className="page-subtitle">Create and manage internship programs</p></div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-dark-500">Total: <strong className="text-dark-900 dark:text-white">{stats.total}</strong></span>
            <span className="text-green-500">Active: <strong>{stats.active}</strong></span>
            <span className="text-red-400">Closed: <strong>{stats.closed}</strong></span>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm"><FiPlus size={16} /> Create Internship</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search internships..." /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field py-2 w-auto"><option value="">All Status</option><option value="published">Active</option><option value="closed">Closed</option></select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input-field py-2 w-auto"><option value="">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <button onClick={() => { fetchInternships(1, 20); fetchStats(); }} className="btn-outline flex items-center gap-2 text-sm"><FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Seats</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {loading ? (<tr><td colSpan={9} className="px-6 py-12 text-center"><FiRefreshCw size={24} className="animate-spin text-primary-500 mx-auto" /><p className="text-dark-400 mt-2">Loading...</p></td></tr>)
              : internships.length === 0 ? (<tr><td colSpan={9} className="px-6 py-12 text-center text-dark-400"><FiBriefcase size={40} className="mx-auto mb-3 opacity-30" /><p className="text-lg font-medium">No internships yet</p><p className="text-sm mt-1">Create your first internship program.</p></td></tr>)
              : internships.map(i => (
                <tr key={i._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                  <td className="px-6 py-4"><p className="font-medium text-dark-900 dark:text-white text-sm">{i.title}</p><p className="text-xs text-dark-400 truncate max-w-[200px]">{i.description}</p></td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{i.category}</td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{i.duration.weeks} weeks</td>
                  <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{i.seats.filled}/{i.seats.total}</td>
                  <td className="px-6 py-4 text-sm text-dark-500">{i.deadline ? formatDate(i.deadline) : 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-dark-500">{i.startDate ? formatDate(i.startDate) : 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-dark-500">{i.endDate ? formatDate(i.endDate) : 'N/A'}</td>
                  <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(i.status)}`}>{i.status}</span></td>
                  <td className="px-6 py-4 relative">
                    <button onClick={() => setActionMenu(actionMenu === i._id ? null : i._id)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"><FiMoreVertical size={16} className="text-dark-500" /></button>
                    {actionMenu === i._id && (
                      <div className="absolute right-6 top-12 z-10 w-44 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 py-1">
                        {i.status === 'published' && <button onClick={() => handleClose(i._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"><FiLock size={16} /> Close</button>}
                        {(i.status === 'closed' || i.status === 'archived') && <button onClick={() => handleReopen(i._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"><FiEye size={16} /> Reopen</button>}
                        <button onClick={() => handleDelete(i._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><FiTrash2 size={16} /> Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && internships.length > 0 && pagination.pages > 1 && (
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

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">Create Internship</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="label">Title *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Internship title" /></div>
              <div><label className="label">Description *</label><textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} placeholder="Describe the internship" /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Category *</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="label">Duration (weeks) *</label><input type="number" min={1} required value={form.duration.weeks} onChange={e => setForm({ ...form, duration: { ...form.duration, weeks: +e.target.value } })} className="input-field" /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Total Seats *</label><input type="number" min={1} required value={form.seats.total} onChange={e => setForm({ ...form, seats: { ...form.seats, total: +e.target.value } })} className="input-field" /></div>
                <div><label className="label">Hours/Week</label><input type="number" min={1} max={40} value={form.duration.hoursPerWeek} onChange={e => setForm({ ...form, duration: { ...form.duration, hoursPerWeek: +e.target.value } })} className="input-field" /></div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><label className="label">Start Date</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="input-field" /></div>
                <div><label className="label">End Date</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="input-field" /></div>
                <div><label className="label">Application Deadline</label><input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="input-field" /></div>
              </div>
              <div><label className="label">Skills (comma separated)</label><input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} className="input-field" placeholder="React, Node.js, MongoDB" /></div>
              <div><label className="label">Eligibility</label><input value={form.eligibility} onChange={e => setForm({ ...form, eligibility: e.target.value })} className="input-field" placeholder="Eligibility criteria" /></div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-outline text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Creating...' : 'Create Internship'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInternships;
