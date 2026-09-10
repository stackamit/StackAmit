import { useState, useEffect } from 'react';
import {
  FiSearch, FiRefreshCw, FiCheckCircle, FiXCircle, FiClock,
  FiUser, FiBriefcase, FiCalendar, FiAward, FiX, FiUserCheck,
  FiChevronDown, FiFilter, FiFileText,
} from 'react-icons/fi';
import api from '../../services/api';

const AdminApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trainers, setTrainers] = useState([]);

  // Modals
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchApplications();
    fetchTrainers();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchApplications(), 400);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/applications/all', { params });
      setApplications(data.data.applications || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchTrainers = async () => {
    try {
      const { data } = await api.get('/trainers', { params: { limit: 100 } });
      setTrainers(data.data.trainers || []);
    } catch (err) { console.error(err); }
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    setProcessing(true);
    try {
      await api.patch(`/applications/${approveModal._id}/approve`, {
        trainerId: selectedTrainer || undefined,
      });
      setApproveModal(null);
      setSelectedTrainer('');
      fetchApplications();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    } finally { setProcessing(false); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setProcessing(true);
    try {
      await api.patch(`/applications/${rejectModal._id}/reject`, {
        notes: rejectNotes,
      });
      setRejectModal(null);
      setRejectNotes('');
      fetchApplications();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    } finally { setProcessing(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const statusColor = (s) => ({
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    withdrawn: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
  }[s] || '');

  const getStudentName = (app) => {
    if (!app.studentId) return 'Unknown';
    if (app.studentId.name) return app.studentId.name;
    return `${app.studentId.firstName || ''} ${app.studentId.lastName || ''}`.trim() || 'Unknown';
  };

  // Stats
  const pending = applications.filter(a => a.status === 'pending').length;
  const approved = applications.filter(a => a.status === 'approved').length;
  const rejected = applications.filter(a => a.status === 'rejected').length;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">Applications</h1><p className="page-subtitle">Review and manage student internship applications</p></div>
        <button onClick={fetchApplications} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-dark-900 dark:text-white">{applications.length}</p>
          <p className="text-xs text-dark-400 mt-1">Total</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-yellow-400">
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pending}</p>
          <p className="text-xs text-dark-400 mt-1">Pending</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-green-400">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{approved}</p>
          <p className="text-xs text-dark-400 mt-1">Approved</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-red-400">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected}</p>
          <p className="text-xs text-dark-400 mt-1">Rejected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="table-container mb-6">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search by student name, email, or internship..." />
          </div>
          <div className="relative">
            <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field pl-9 py-2 w-auto">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>
      ) : applications.length === 0 ? (
        <div className="table-container p-12 text-center text-dark-400">
          <FiFileText size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No applications found</p>
          <p className="text-sm mt-1">Applications will appear here when students apply for internships.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map(app => (
            <div key={app._id} className={`card p-6 ${app.status === 'pending' ? 'border-l-4 border-l-yellow-400' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Student info */}
                  <div className="flex items-center gap-2">
                    <FiUser size={16} className="text-primary-500" />
                    <span className="font-semibold text-dark-900 dark:text-white">{getStudentName(app)}</span>
                    <span className="text-xs text-dark-400">{app.studentId?.email}</span>
                  </div>
                  {/* Internship info */}
                  <div className="flex items-center gap-2">
                    <FiBriefcase size={16} className="text-primary-500" />
                    <span className="text-sm text-dark-700 dark:text-dark-300">{app.internshipId?.title || 'Unknown Internship'}</span>
                    {app.internshipId?.category && (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">{app.internshipId.category}</span>
                    )}
                  </div>
                  {/* Meta */}
                  <div className="flex flex-wrap gap-4 text-xs text-dark-400">
                    <span className="flex items-center gap-1"><FiCalendar size={12} /> Applied: {formatDate(app.appliedDate || app.createdAt)}</span>
                    {app.studentId?.collegeName && <span>College: {app.studentId.collegeName}</span>}
                    {app.studentId?.course && <span>Course: {app.studentId.course}</span>}
                    {app.studentId?.year && <span>Year: {app.studentId.year}</span>}
                    {app.internshipId?.seats && (
                      <span>Seats: {app.internshipId.seats.filled}/{app.internshipId.seats.total}</span>
                    )}
                  </div>
                  {/* Skills */}
                  {app.studentId?.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.studentId.skills.slice(0, 5).map((skill, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400">{skill}</span>
                      ))}
                    </div>
                  )}
                  {/* Review notes */}
                  {app.reviewNotes && (
                    <div className="mt-2 p-2 bg-dark-50 dark:bg-dark-700/50 rounded text-xs text-dark-500">
                      <span className="font-medium">Review notes:</span> {app.reviewNotes}
                    </div>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex sm:flex-col items-center gap-2 sm:items-end">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(app.status)}`}>{app.status}</span>
                  {app.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => setApproveModal(app)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium transition-colors">
                        <FiCheckCircle size={12} /> Approve
                      </button>
                      <button onClick={() => setRejectModal(app)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium transition-colors">
                        <FiXCircle size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setApproveModal(null)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-dark-900 dark:text-white flex items-center gap-2"><FiCheckCircle className="text-green-500" /> Approve Application</h2>
              <button onClick={() => setApproveModal(null)}><FiX size={20} className="text-dark-400" /></button>
            </div>

            <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg mb-4">
              <p className="text-sm"><strong>Student:</strong> {getStudentName(approveModal)}</p>
              <p className="text-sm"><strong>Internship:</strong> {approveModal.internshipId?.title}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label flex items-center gap-2">
                  <FiUserCheck size={14} /> Assign Trainer <span className="text-dark-400 font-normal">(optional)</span>
                </label>
                <select value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)} className="input-field">
                  <option value="">— No trainer assignment —</option>
                  {trainers.map(t => {
                    const slots = (t.maxStudents || 20) - (t.assignedStudents?.length || 0);
                    return (
                      <option key={t._id} value={t._id}>
                        {t.name} {slots > 0 ? `(${slots} slots available)` : '(Full)'}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-dark-400 mt-1">
                  {selectedTrainer ? 'Student will be immediately assigned to this trainer and notified.' : 'You can assign a trainer later from the Assignments page.'}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setApproveModal(null)} className="btn-outline text-sm">Cancel</button>
                <button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {processing ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCheckCircle size={14} />}
                  {processing ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-dark-900 dark:text-white flex items-center gap-2"><FiXCircle className="text-red-500" /> Reject Application</h2>
              <button onClick={() => setRejectModal(null)}><FiX size={20} className="text-dark-400" /></button>
            </div>

            <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg mb-4">
              <p className="text-sm"><strong>Student:</strong> {getStudentName(rejectModal)}</p>
              <p className="text-sm"><strong>Internship:</strong> {rejectModal.internshipId?.title}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Reason (optional)</label>
                <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} className="input-field" rows={3} placeholder="Reason for rejection..." />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setRejectModal(null)} className="btn-outline text-sm">Cancel</button>
                <button onClick={handleReject} disabled={processing} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {processing ? <FiRefreshCw size={14} className="animate-spin" /> : <FiXCircle size={14} />}
                  {processing ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplications;
