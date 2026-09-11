import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUser, FiBriefcase, FiCheckSquare, FiAward, FiTrendingUp, FiRefreshCw, FiFileText, FiCalendar, FiCheckCircle, FiClock, FiDownload, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const StudentOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [offerLetters, setOfferLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchOfferLetters();
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

  const fetchOfferLetters = async () => {
    try {
      const { data } = await api.get('/applications/offer-letters');
      setOfferLetters(data?.data?.offerLetters || []);
    } catch (err) {
      console.error('Failed to fetch offer letters:', err);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  const handlePDF = async (offer, mode = 'download') => {
    if (downloadingId) return;
    setDownloadingId(offer._id);
    try {
      const res = await api.get(`/applications/offer-letters/${offer._id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const title = (offer.internshipId?.title || 'Offer-Letter').replace(/[^a-z0-9]+/gi, '-');
      const fileName = `Offer-Letter-${title}.pdf`;
      if (mode === 'view') {
        window.open(url, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        toast.success('Offer letter downloaded');
      }
    } catch (err) {
      console.error('Failed to get offer letter:', err);
      toast.error('Failed to download offer letter');
    } finally {
      setDownloadingId(null);
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

      {/* Offer Letters Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <FiFileText size={20} className="text-green-500" />
            <h3 className="font-semibold text-dark-900 dark:text-white text-lg">Internship Offer Letters</h3>
            {offerLetters.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                {offerLetters.length}
              </span>
            )}
          </div>
          {offerLetters.length > 0 && (
            <Link to="/student/offer-letters" className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium">
              View All &rarr;
            </Link>
          )}
        </div>

        {offerLetters.length === 0 ? (
          <div className="card p-8 text-center text-dark-400">
            <FiFileText size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No offer letters yet</p>
            <p className="text-xs mt-1">Your offer letters will appear here when your internship applications are approved.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {offerLetters.map((offer) => {
              const internship = offer.internshipId;
              return (
                <motion.div
                  key={offer._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-6 border-l-4 border-l-green-500"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                        <FiCheckCircle size={22} className="text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-dark-900 dark:text-white text-sm">{internship?.title || 'Internship'}</p>
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Approved
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {internship?.category && (
                      <p className="text-xs text-dark-500 dark:text-dark-400">
                        <span className="font-medium">Category:</span> {internship.category}
                      </p>
                    )}
                    {internship?.duration && (
                      <p className="text-xs text-dark-500 dark:text-dark-400">
                        <span className="font-medium">Duration:</span> {internship.duration.weeks} weeks ({internship.duration.hoursPerWeek || 20} hrs/week)
                      </p>
                    )}
                    <p className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                      <FiCalendar size={12} />
                      <span className="font-medium">Offer Date:</span> {formatDate(offer.reviewedAt || offer.updatedAt)}
                    </p>
                    {offer.reviewedBy?.name && (
                      <p className="text-xs text-dark-500 dark:text-dark-400">
                        <span className="font-medium">Approved By:</span> {offer.reviewedBy.name}
                      </p>
                    )}
                  </div>
                  {internship?.skills?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {internship.skills.slice(0, 4).map((skill, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400">{skill}</span>
                      ))}
                      {internship.skills.length > 4 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-500">+{internship.skills.length - 4}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-dark-100 dark:border-dark-700 flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePDF(offer, 'view')}
                      disabled={downloadingId === offer._id}
                      className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-100 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-600 transition-colors text-xs font-medium disabled:opacity-50"
                    >
                      <FiEye size={14} /> {downloadingId === offer._id ? 'Loading...' : 'View PDF'}
                    </button>
                    <button
                      onClick={() => handlePDF(offer, 'download')}
                      disabled={downloadingId === offer._id}
                      className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50"
                    >
                      <FiDownload size={14} /> {downloadingId === offer._id ? 'Loading...' : 'Download PDF'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentOverview;
