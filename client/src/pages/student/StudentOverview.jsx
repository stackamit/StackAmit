import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiBriefcase, FiCheckSquare, FiAward, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const StudentOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/student/dashboard');
      setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Profile Completion', value: `${stats?.profileCompletion || 0}%`, icon: <FiUser size={24} />, color: 'bg-blue-500' },
    { label: 'Assigned Tasks', value: stats?.assignedTasks || 0, icon: <FiCheckSquare size={24} />, color: 'bg-orange-500' },
    { label: 'Certificates', value: stats?.certificates || 0, icon: <FiAward size={24} />, color: 'bg-green-500' },
    { label: 'Completion Rate', value: `${stats?.taskCompletionRate || 0}%`, icon: <FiTrendingUp size={24} />, color: 'bg-purple-500' },
  ];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Welcome, {user?.name?.split(' ')[0] || 'Student'}!</h1>
          <p className="page-subtitle">Here's your learning progress overview</p>
        </div>
        <button onClick={fetchStats} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-white`}>{s.icon}</div>
            <div><p className="text-sm text-dark-500 dark:text-dark-400">{s.label}</p><p className="text-2xl font-bold text-dark-900 dark:text-white">{s.value}</p></div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Current Internship</h3>
          {stats?.currentInternship ? (
            <div className="space-y-2">
              <p className="text-dark-700 dark:text-dark-300 font-medium">{stats.currentInternship.title}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{stats.currentInternship.category}</span>
                <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 capitalize">{stats.currentInternship.status}</span>
              </div>
              {stats.currentInternship.endDate && (
                <p className="text-sm text-dark-400 mt-2">Ends: {new Date(stats.currentInternship.endDate).toLocaleDateString()}</p>
              )}
            </div>
          ) : (
            <p className="text-dark-400 text-center py-8">No active internship</p>
          )}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats?.completedTasks || 0}</p>
              <p className="text-xs text-dark-400 mt-1">Tasks Completed</p>
            </div>
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats?.pendingTasks || 0}</p>
              <p className="text-xs text-dark-400 mt-1">Tasks Pending</p>
            </div>
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats?.applications || 0}</p>
              <p className="text-xs text-dark-400 mt-1">Applications</p>
            </div>
            <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats?.certificates || 0}</p>
              <p className="text-xs text-dark-400 mt-1">Certificates</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentOverview;
