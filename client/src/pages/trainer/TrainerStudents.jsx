import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiUsers, FiRefreshCw, FiMail, FiBriefcase, FiUser } from 'react-icons/fi';
import api from '../../services/api';

const TrainerStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (search) params.search = search;
      const { data } = await api.get('/students', { params });
      setStudents(data?.data?.students || []);
      setPagination(prev => ({ ...prev, total: data.data.total, pages: data.data.pages }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => { fetchStudents(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchStudents();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">My Students</h1>
          <p className="page-subtitle">Students assigned to you by the admin</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-dark-500">
            Assigned: <strong className="text-dark-900 dark:text-white">{pagination.total}</strong>
          </span>
          <button onClick={fetchStudents} className="btn-outline flex items-center gap-2 text-sm">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search your students..." />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-dark-50 dark:bg-dark-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Student</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">College</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Course</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Internship</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <FiRefreshCw size={24} className="animate-spin text-primary-500 mx-auto" />
                    <p className="text-dark-400 mt-2">Loading students...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-dark-400 dark:text-dark-500">
                    <FiUsers size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium">No students assigned yet</p>
                    <p className="text-sm mt-1">The admin will assign students to you for specific internships.</p>
                  </td>
                </tr>
              ) : (
                students.map(s => (
                  <tr key={s._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {s.avatar?.url ? (
                          <img src={s.avatar.url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-semibold text-sm">
                            {(s.name || s.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-dark-900 dark:text-white text-sm">
                            {s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'N/A'}
                          </p>
                          <p className="text-xs text-dark-400">
                            {s.profileCompletion != null ? `${s.profileCompletion}% complete` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-dark-600 dark:text-dark-300">
                        <FiMail size={12} className="text-dark-400" />
                        {s.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-dark-600 dark:text-dark-300">{s.collegeName || 'N/A'}</p>
                      <p className="text-xs text-dark-400">{s.university || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-dark-600 dark:text-dark-300">
                      {s.course || 'N/A'} {s.branch ? `(${s.branch})` : ''}
                      <p className="text-xs text-dark-400">{s.year || ''}</p>
                    </td>
                    <td className="px-6 py-4">
                      {s.currentInternship ? (
                        <div className="flex items-center gap-1.5">
                          <FiBriefcase size={12} className="text-primary-500" />
                          <div>
                            <p className="text-sm text-dark-700 dark:text-dark-300 font-medium">{s.currentInternship.title}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              s.currentInternship.status === 'published'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : s.currentInternship.status === 'closed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {s.currentInternship.status}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-dark-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        s.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && students.length > 0 && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-100 dark:border-dark-700">
            <p className="text-sm text-dark-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} students
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Previous</button>
              <span className="text-sm text-dark-500">Page {pagination.page} of {pagination.pages}</span>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page >= pagination.pages} className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerStudents;
