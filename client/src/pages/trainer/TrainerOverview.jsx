import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiCheckSquare, FiClock, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';
import api from '../../services/api';

const TrainerOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/reports/trainer/dashboard');
      setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Assigned Students', value: stats?.assignedStudents || 0, icon: <FiUsers size={24} />, color: 'bg-green-500' },
    { label: 'Pending Tasks', value: stats?.pendingTasks || 0, icon: <FiClock size={24} />, color: 'bg-orange-500' },
    { label: 'Completed Tasks', value: stats?.completedTasks || 0, icon: <FiCheckSquare size={24} />, color: 'bg-blue-500' },
    { label: 'Completion Rate', value: `${stats?.taskCompletionRate || 0}%`, icon: <FiTrendingUp size={24} />, color: 'bg-purple-500' },
  ];

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Trainer Dashboard</h1>
          <p className="page-subtitle">Manage your students and tasks</p>
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

      <div className="card p-6">
        <h3 className="font-semibold text-dark-900 dark:text-white mb-4">Task Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-dark-900 dark:text-white">{stats?.totalTasks || 0}</p>
            <p className="text-xs text-dark-400 mt-1">Total Tasks</p>
          </div>
          <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats?.completedTasks || 0}</p>
            <p className="text-xs text-dark-400 mt-1">Completed</p>
          </div>
          <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats?.pendingTasks || 0}</p>
            <p className="text-xs text-dark-400 mt-1">Pending</p>
          </div>
          <div className="bg-dark-50 dark:bg-dark-800/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats?.lateTasks || 0}</p>
            <p className="text-xs text-dark-400 mt-1">Late</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerOverview;
