import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiPlus, FiDownload, FiRefreshCw, FiMoreVertical, FiTrash2, FiUserCheck, FiUser, FiX, FiMail, FiPhone, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '../../services/api';

const AdminTrainers = () => {
  const [search, setSearch] = useState('');
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [actionMenu, setActionMenu] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', password: '', bio: '', expertise: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchTrainers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;

      const { data } = await api.get('/trainers', { params });
      setTrainers(data.data.trainers);
      setPagination(prev => ({ ...prev, total: data.data.total, pages: data.data.pages }));
    } catch (err) {
      console.error('Failed to fetch trainers:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/trainers/stats');
      setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch trainer stats:', err);
    }
  };

  useEffect(() => {
    fetchTrainers();
    fetchStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchTrainers();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (trainerId) => {
    try {
      const { data } = await api.patch(`/trainers/${trainerId}/status`);
      setTrainers(prev => prev.map(t =>
        t._id === trainerId ? { ...t, isActive: data.data.isActive } : t
      ));
      fetchStats();
      setActionMenu(null);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (trainerId) => {
    if (!window.confirm('Are you sure you want to delete this trainer?')) return;
    try {
      await api.delete(`/trainers/${trainerId}`);
      setTrainers(prev => prev.filter(t => t._id !== trainerId));
      fetchStats();
      setActionMenu(null);
    } catch (err) {
      console.error('Failed to delete trainer:', err);
    }
  };

  const handleCreateTrainer = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      const payload = {
        name: createForm.name,
        email: createForm.email,
        phone: createForm.phone,
        password: createForm.password,
        bio: createForm.bio,
        expertise: createForm.expertise.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.post('/trainers', payload);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', phone: '', password: '', bio: '', expertise: '' });
      fetchTrainers();
      fetchStats();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create trainer');
    } finally {
      setCreateLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Trainer Management</h1>
          <p className="page-subtitle">Manage trainers and assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-dark-500">Total: <strong className="text-dark-900 dark:text-white">{stats.total}</strong></span>
            <span className="text-green-500">Active: <strong>{stats.active}</strong></span>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <FiPlus size={16} /> Add Trainer
          </button>
          <button onClick={() => { fetchTrainers(); fetchStats(); }} className="btn-outline flex items-center gap-2 text-sm">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search trainers..." />
          </div>
          <button className="btn-outline flex items-center gap-2 text-sm"><FiDownload size={16} /> Export</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Students</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FiRefreshCw size={24} className="animate-spin text-primary-500" />
                      <p className="text-dark-400">Loading trainers...</p>
                    </div>
                  </td>
                </tr>
              ) : trainers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-dark-400 dark:text-dark-500">
                    <FiUser size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No trainers found</p>
                    <p className="text-sm mt-1">Add trainers to get started.</p>
                  </td>
                </tr>
              ) : (
                trainers.map((trainer) => (
                  <tr key={trainer._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-semibold text-sm">
                          {(trainer.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-dark-900 dark:text-white text-sm">{trainer.name || 'N/A'}</p>
                          <p className="text-xs text-dark-400">{trainer.phone || 'No phone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{trainer.email}</td>
                    <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">
                      {trainer.assignedStudents?.length || 0} assigned
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-500">{formatDate(trainer.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        trainer.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${trainer.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {trainer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 relative">
                      <button onClick={() => setActionMenu(actionMenu === trainer._id ? null : trainer._id)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors">
                        <FiMoreVertical size={16} className="text-dark-500" />
                      </button>
                      {actionMenu === trainer._id && (
                        <div className="absolute right-6 top-12 z-10 w-48 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 py-1">
                          <button onClick={() => handleToggleStatus(trainer._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700">
                            <FiUserCheck size={16} className={trainer.isActive ? 'text-red-500' : 'text-green-500'} />
                            {trainer.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <hr className="my-1 border-dark-200 dark:border-dark-700" />
                          <button onClick={() => handleDelete(trainer._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                            <FiTrash2 size={16} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && trainers.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} trainers
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))} disabled={pagination.page === 1} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Previous</button>
              <span className="text-sm text-dark-500">Page {pagination.page} of {pagination.pages}</span>
              <button onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page >= pagination.pages} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Trainer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !createLoading && setShowCreateModal(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-800 rounded-2xl shadow-2xl animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-100 dark:border-dark-700">
              <div>
                <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Create New Trainer</h2>
                <p className="text-sm text-dark-400 mt-0.5">Add a new trainer to the system</p>
              </div>
              <button onClick={() => !createLoading && setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                <FiX size={18} className="text-dark-400" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateTrainer} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Full Name *</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input-field pl-10"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Email *</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                      className="input-field pl-10"
                      placeholder="trainer@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Phone</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
                    <input
                      type="tel"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="input-field pl-10"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Password *</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={createForm.password}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                      className="input-field pl-10 pr-10"
                      placeholder="Min 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                    >
                      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Expertise</label>
                  <input
                    type="text"
                    value={createForm.expertise}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, expertise: e.target.value }))}
                    className="input-field"
                    placeholder="React, Node.js (comma separated)"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Bio</label>
                  <textarea
                    rows={3}
                    value={createForm.bio}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, bio: e.target.value }))}
                    className="input-field resize-none"
                    placeholder="Brief description about the trainer..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-sm"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-sm flex items-center gap-2"
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <>
                      <FiRefreshCw size={14} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <FiPlus size={14} /> Create Trainer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTrainers;
