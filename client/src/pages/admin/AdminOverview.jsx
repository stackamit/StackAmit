import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiUserCheck, FiBriefcase, FiAward, FiCheckCircle, FiClock, FiTrendingUp, FiRefreshCw, FiPlus } from 'react-icons/fi';
import api from '../../services/api';

const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/admin/dashboard');
      setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Total Students', value: stats.totalStudents, icon: <FiUsers size={24} />, color: 'bg-blue-500' },
    { label: 'Total Trainers', value: stats.totalTrainers, icon: <FiUserCheck size={24} />, color: 'bg-green-500' },
    { label: 'Active Internships', value: stats.activeInternships, icon: <FiBriefcase size={24} />, color: 'bg-purple-500' },
    { label: 'Certificates Issued', value: stats.totalCertificates, icon: <FiAward size={24} />, color: 'bg-yellow-500' },
    { label: 'Tasks Completed', value: stats.completedTasks, icon: <FiCheckCircle size={24} />, color: 'bg-emerald-500' },
    { label: 'Pending Applications', value: stats.pendingApplications, icon: <FiClock size={24} />, color: 'bg-orange-500' },
  ] : [];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening today.</p>
        </div>
        <button onClick={fetchDashboardStats} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {loading && !stats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse">
              <div className="w-12 h-12 bg-dark-200 dark:bg-dark-700 rounded-xl"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-dark-200 dark:bg-dark-700 rounded w-20"></div>
                <div className="h-6 bg-dark-200 dark:bg-dark-700 rounded w-12"></div>
              </div>
            </div>
          ))
        ) : (
          statCards.map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-dark-500 dark:text-dark-400">{stat.label}</p>
                <p className="text-2xl font-bold text-dark-900 dark:text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Task Completion + Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="table-header">
            <h3 className="font-semibold text-dark-900 dark:text-white">Task Completion Rate</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl font-bold text-dark-900 dark:text-white">
                {stats?.taskCompletionRate || 0}%
              </span>
              <span className="text-sm text-dark-400">
                {stats?.completedTasks || 0} / {stats?.totalTasks || 0} tasks
              </span>
            </div>
            <div className="w-full bg-dark-100 dark:bg-dark-700 rounded-full h-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats?.taskCompletionRate || 0}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="bg-primary-500 h-3 rounded-full"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-3">
                <p className="text-dark-400">Total Applications</p>
                <p className="text-lg font-semibold text-dark-900 dark:text-white">{stats?.totalApplications || 0}</p>
              </div>
              <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-3">
                <p className="text-dark-400">Total Internships</p>
                <p className="text-lg font-semibold text-dark-900 dark:text-white">{stats?.totalInternships || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="table-header">
            <h3 className="font-semibold text-dark-900 dark:text-white">Quick Actions</h3>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/admin/students')}
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <FiUsers size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-dark-900 dark:text-white">Add Student</p>
                <p className="text-xs text-dark-400">Manage students</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/trainers')}
              className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <FiUserCheck size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-dark-900 dark:text-white">Add Trainer</p>
                <p className="text-xs text-dark-400">Create new trainer</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/internships')}
              className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <FiBriefcase size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-dark-900 dark:text-white">Create Internship</p>
                <p className="text-xs text-dark-400">New internship</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/admin/certificates')}
              className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                <FiAward size={18} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-dark-900 dark:text-white">Certificates</p>
                <p className="text-xs text-dark-400">Issue certificates</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
