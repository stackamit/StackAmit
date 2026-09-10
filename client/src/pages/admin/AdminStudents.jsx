import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiDownload, FiMoreVertical, FiToggleLeft, FiToggleRight, FiTrash2, FiRefreshCw, FiUser } from 'react-icons/fi';
import api from '../../services/api';

const AdminStudents = () => {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, verified: 0, inactive: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [actionMenu, setActionMenu] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;

      const { data } = await api.get('/students', { params });
      setStudents(data.data.students);
      setPagination(prev => ({ ...prev, total: data.data.total, pages: data.data.pages }));
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/students/stats');
      setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchStudents();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleToggleStatus = async (studentId) => {
    try {
      const { data } = await api.patch(`/students/${studentId}/status`);
      setStudents(prev => prev.map(s =>
        s._id === studentId ? { ...s, isActive: data.data.isActive } : s
      ));
      fetchStats();
      setActionMenu(null);
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleResetPassword = async (studentId) => {
    if (!window.confirm('Reset this student\'s password? A temporary password will be generated.')) return;
    try {
      const { data } = await api.post(`/students/${studentId}/reset-password`);
      alert(`Password reset. Temporary password: ${data.data.tempPassword}`);
      setActionMenu(null);
    } catch (err) {
      console.error('Failed to reset password:', err);
    }
  };

  const handleDelete = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student? This action can be undone.')) return;
    try {
      await api.delete(`/students/${studentId}`);
      setStudents(prev => prev.filter(s => s._id !== studentId));
      fetchStats();
      setActionMenu(null);
    } catch (err) {
      console.error('Failed to delete student:', err);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Student Management</h1>
          <p className="page-subtitle">Manage all registered students</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-dark-500">Total: <strong className="text-dark-900 dark:text-white">{stats.total}</strong></span>
            <span className="text-green-500">Active: <strong>{stats.active}</strong></span>
            <span className="text-dark-400">Inactive: <strong>{stats.inactive}</strong></span>
          </div>
          <button onClick={() => { fetchStudents(); fetchStats(); }} className="btn-outline flex items-center gap-2 text-sm">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search by name, email, or college..." />
          </div>
          <button className="btn-outline flex items-center gap-2 text-sm"><FiDownload size={16} /> Export</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Student</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">College</th>
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
                      <p className="text-dark-400">Loading students...</p>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-dark-400 dark:text-dark-500">
                    <FiUser size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No students found</p>
                    <p className="text-sm mt-1">Students will appear here once they register.</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {student.avatar?.url ? (
                          <img src={student.avatar.url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm">
                            {(student.name || student.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-dark-900 dark:text-white text-sm">{student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'N/A'}</p>
                          <p className="text-xs text-dark-400">{student.phone || 'No phone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">{student.email}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-dark-600 dark:text-dark-300">{student.collegeName || 'N/A'}</p>
                      <p className="text-xs text-dark-400">{student.university || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-500">{formatDate(student.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        student.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${student.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {student.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 relative">
                      <button onClick={() => setActionMenu(actionMenu === student._id ? null : student._id)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors">
                        <FiMoreVertical size={16} className="text-dark-500" />
                      </button>
                      {actionMenu === student._id && (
                        <div className="absolute right-6 top-12 z-10 w-48 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 py-1">
                          <button onClick={() => handleToggleStatus(student._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700">
                            {student.isActive ? <FiToggleRight size={16} className="text-red-500" /> : <FiToggleLeft size={16} className="text-green-500" />}
                            {student.isActive ? 'Suspend' : 'Activate'}
                          </button>
                          <button onClick={() => handleResetPassword(student._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700">
                            <FiRefreshCw size={16} className="text-blue-500" /> Reset Password
                          </button>
                          <hr className="my-1 border-dark-200 dark:border-dark-700" />
                          <button onClick={() => handleDelete(student._id)} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
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
        {!loading && students.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} students
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-dark-500">Page {pagination.page} of {pagination.pages}</span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStudents;
