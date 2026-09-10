import { useState, useEffect } from 'react';
import {
  FiRefreshCw, FiClock, FiCheckCircle, FiXCircle, FiFileText,
  FiBriefcase, FiCalendar, FiArrowRight, FiExternalLink,
  FiAlertCircle, FiChevronRight, FiUsers,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const StudentApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { fetchApplications(); }, []);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/applications/my');
      console.log('[MyApplications] API response:', JSON.stringify(data, null, 2));
      setApplications(data?.data?.applications || []);
    } catch (err) {
      console.error('[MyApplications] Error fetching applications:', err.response?.status, err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to load applications');
    } finally { setLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const isDeadlinePassed = (deadline) => deadline && new Date(deadline) < new Date();

  const statusConfig = {
    pending: {
      label: 'Under Review',
      color: 'text-yellow-700 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      border: 'border-l-yellow-400',
      icon: <FiClock size={18} className="text-yellow-500" />,
      step: 1,
    },
    approved: {
      label: 'Approved',
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      border: 'border-l-green-500',
      icon: <FiCheckCircle size={18} className="text-green-500" />,
      step: 2,
    },
    rejected: {
      label: 'Not Selected',
      color: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      border: 'border-l-red-400',
      icon: <FiXCircle size={18} className="text-red-500" />,
      step: -1,
    },
    withdrawn: {
      label: 'Withdrawn',
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-900/30',
      border: 'border-l-gray-400',
      icon: <FiAlertCircle size={18} className="text-gray-400" />,
      step: -1,
    },
  };

  // Stats
  const total = applications.length;
  const pending = applications.filter(a => a.status === 'pending').length;
  const approved = applications.filter(a => a.status === 'approved').length;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">My Applications</h1><p className="page-subtitle">Track your internship application progress</p></div>
        <button onClick={fetchApplications} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-dark-900 dark:text-white">{total}</p>
          <p className="text-xs text-dark-400 mt-1">Total Applied</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-yellow-400">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pending}</p>
          <p className="text-xs text-dark-400 mt-1">Pending</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-green-400">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{approved}</p>
          <p className="text-xs text-dark-400 mt-1">Approved</p>
        </div>
      </div>

      {/* Applications */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>
      ) : error ? (
        <div className="table-container p-8 text-center">
          <FiAlertCircle size={48} className="mx-auto mb-4 text-red-400" />
          <p className="text-lg font-medium text-red-600 dark:text-red-400">{error}</p>
          <button onClick={fetchApplications} className="btn-primary mt-4 text-sm">Try Again</button>
        </div>
      ) : applications.length === 0 ? (
        <div className="table-container p-12 text-center text-dark-400">
          <FiFileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No applications yet</p>
          <p className="text-sm mt-1 mb-4">Browse available internships and apply to start tracking your progress.</p>
          <Link to="/student/internships" className="btn-primary inline-flex items-center gap-2 text-sm">
            <FiBriefcase size={16} /> Browse Internships
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const config = statusConfig[app.status] || statusConfig.pending;
            const internship = app.internshipId;

            return (
              <div key={app._id} className={`card p-6 border-l-4 ${config.border}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Internship title & status */}
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-dark-900 dark:text-white text-lg">{internship?.title || 'Unknown Internship'}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {internship?.category && (
                            <span className="text-xs px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">{internship.category}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-4 text-sm text-dark-500 dark:text-dark-400 pl-13">
                      <span className="flex items-center gap-1.5"><FiCalendar size={14} /> Applied: {formatDate(app.appliedDate || app.createdAt)}</span>
                      {internship?.duration && <span>Duration: {internship.duration.weeks} weeks</span>}
                      {internship?.deadline && (
                        <span className={isDeadlinePassed(internship.deadline) ? 'text-red-500' : ''}>
                          Deadline: {formatDate(internship.deadline)} {isDeadlinePassed(internship.deadline) ? '(Passed)' : ''}
                        </span>
                      )}
                      {internship?.seats && (
                        <span className="flex items-center gap-1"><FiUsers size={14} /> Seats: {internship.seats.filled}/{internship.seats.total}</span>
                      )}
                    </div>

                    {/* Progress Tracker */}
                    {app.status !== 'withdrawn' && (
                      <div className="pl-13 pt-2">
                        <div className="flex items-center gap-0">
                          {/* Step 1: Applied */}
                          <div className="flex items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              config.step >= 0 ? 'bg-green-500 text-white' : app.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-dark-200 dark:bg-dark-700 text-dark-500'
                            }`}>
                              {app.status === 'rejected' ? <FiXCircle size={14} /> : <FiCheckCircle size={14} />}
                            </div>
                            <span className="text-xs font-medium ml-1.5 text-dark-600 dark:text-dark-400">Applied</span>
                          </div>
                          <div className={`flex-1 h-0.5 mx-2 ${config.step >= 1 ? 'bg-green-500' : 'bg-dark-200 dark:bg-dark-700'}`} />
                          {/* Step 2: Under Review */}
                          <div className="flex items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              config.step >= 1 ? (app.status === 'pending' ? 'bg-yellow-500 text-white animate-pulse' : 'bg-green-500 text-white') : 'bg-dark-200 dark:bg-dark-700 text-dark-500'
                            }`}>
                              {app.status === 'pending' ? <FiClock size={14} /> : <FiCheckCircle size={14} />}
                            </div>
                            <span className="text-xs font-medium ml-1.5 text-dark-600 dark:text-dark-400">Review</span>
                          </div>
                          <div className={`flex-1 h-0.5 mx-2 ${config.step >= 2 ? 'bg-green-500' : 'bg-dark-200 dark:bg-dark-700'}`} />
                          {/* Step 3: Decision */}
                          <div className="flex items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              app.status === 'approved' ? 'bg-green-500 text-white' : app.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-dark-200 dark:bg-dark-700 text-dark-500'
                            }`}>
                              {app.status === 'approved' ? <FiCheckCircle size={14} /> : app.status === 'rejected' ? <FiXCircle size={14} /> : <FiChevronRight size={14} />}
                            </div>
                            <span className="text-xs font-medium ml-1.5 text-dark-600 dark:text-dark-400">
                              {app.status === 'approved' ? 'Accepted' : app.status === 'rejected' ? 'Rejected' : 'Decision'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Review notes */}
                    {app.reviewNotes && (
                      <div className="pl-13 mt-2 p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                        <p className="text-xs font-medium text-dark-500 mb-1">Review Notes</p>
                        <p className="text-sm text-dark-600 dark:text-dark-300">{app.reviewNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentApplications;
