import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { formatDateIST, formatDateTimeIST, toLocalInputValue, fromLocalInputValue } from '../../utils/dateTime';

const getErrorMessage = (error) => {
  const raw = error?.response?.data?.message || error?.message || 'Something went wrong';
  if (typeof raw === 'string' && raw.includes('E11000')) {
    return 'A record with this information already exists.';
  }
  return raw;
};

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const emptyFilters = {
  state: 'all',
  trainerId: '',
  studentId: '',
  createdFrom: '',
  createdTo: '',
  deadlineFrom: '',
  deadlineTo: '',
};

const STATE_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'active', label: 'Active Tasks' },
  { value: 'pending', label: 'Pending Submissions' },
  { value: 'submitted', label: 'Submitted Tasks' },
  { value: 'late', label: 'Late Submissions' },
  { value: 'awaiting_review', label: 'Awaiting Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'closed', label: 'Closed' },
  { value: 'extended', label: 'Extended' },
];

const STATUS_BADGE = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-300',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  submitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  resubmission_requested: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  late: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400',
};

// ─── Small display helpers ─────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status] || 'bg-gray-100 text-gray-700'}`}>
    {status || '—'}
  </span>
);

// Window chip from SERVER-computed flags (aggregation rows carry isClosed/closesAt/isExtended)
const windowChip = (row) => {
  if (row.isClosed) {
    return <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-dark-700 dark:text-dark-300">Submission Closed</span>;
  }
  if (row.isExtended) {
    return <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Extended · closes {formatDateTimeIST(row.closesAt)}</span>;
  }
  return null;
};

const submissionChip = (row) => {
  const sub = row.submission;
  if (!sub) {
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400">Not submitted</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <StatusBadge status={sub.status} />
      {sub.isLateSubmission ? <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Late</span> : null}
      {sub.versions > 1 ? <span className="text-xs text-gray-500 dark:text-dark-400">Updated ×{sub.versions - 1}</span> : null}
    </span>
  );
};

const marksLabel = (marks) =>
  marks && marks.total > 0 ? `${marks.obtained ?? 0}/${marks.total}` : null;

const personCell = (person) => (
  person && (person.name || person.email) ? (
    <div className="max-w-[160px]">
      <p className="truncate text-sm font-medium text-dark-900 dark:text-white">{person.name || 'Unknown'}</p>
      <p className="truncate text-xs text-dark-400">{person.email || ''}</p>
    </div>
  ) : (
    <span className="text-sm text-dark-400">Unknown</span>
  )
);

// Detail modal window helpers (task document from GET /tasks/:id — virtuals included)
const GRACE_MS = 48 * 60 * 60 * 1000;

const detailClosesAt = (task) =>
  task?.submissionClosesAt ||
  (task?.effectiveDueDate || task?.dueDate ? new Date(new Date(task.effectiveDueDate || task.dueDate).getTime() + GRACE_MS) : null);

const detailIsClosed = (task) => {
  if (!task) return false;
  const closesAt = detailClosesAt(task);
  return !!task.submissionClosedAt || (!!closesAt && new Date(closesAt).getTime() <= Date.now());
};

const detailDeadlinePassed = (task) => {
  const eff = task?.effectiveDueDate || task?.dueDate;
  return eff ? new Date(eff).getTime() < Date.now() : false;
};

const detailWindowChip = (task) => {
  if (!task) return null;
  const closesAt = detailClosesAt(task);
  if (detailIsClosed(task)) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-dark-700 dark:text-dark-300">
        Submission Closed{task.submissionClosedAt ? ` on ${formatDateTimeIST(task.submissionClosedAt)}` : ` · ${formatDateTimeIST(closesAt)}`}
      </span>
    );
  }
  if ((task.deadlineExtensions?.length ?? 0) > 0 || task.isDeadlineExtended) {
    return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Extended · closes {formatDateTimeIST(closesAt)}</span>;
  }
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Open · closes {formatDateTimeIST(closesAt)}</span>;
};

const TH_CLASS = 'px-6 py-3 text-left text-xs font-semibold text-dark-500 dark:text-dark-400 uppercase whitespace-nowrap';
const TD_CLASS = 'px-6 py-4 whitespace-nowrap';

// ─── Main Component ────────────────────────────────────────────────────────
function AdminTasks() {
  const [view, setView] = useState('tasks');
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [trainerRows, setTrainerRows] = useState([]);
  const [studentRows, setStudentRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Search lives OUTSIDE filters: keystrokes must not regenerate loadList
  // (that would fire one request per keypress); only the debounced value
  // triggers a server round-trip.
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Detail modal
  const [taskDetail, setTaskDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Extend / reopen modal (reuses the audited /extend-deadline endpoint)
  const [extendModal, setExtendModal] = useState(null);
  const [extendForm, setExtendForm] = useState({ newDeadline: '', reason: '' });
  const [extending, setExtending] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => (key === 'state' ? value !== 'all' : !!value)).length +
      (search.trim() ? 1 : 0),
    [filters, search]
  );

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/tasks/admin/tasks/stats');
      setStats(data.data.stats);
    } catch {
      // Stats are non-critical; the table still loads without them
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 12 };
      Object.entries(filters).forEach(([key, value]) => {
        if (value && !(key === 'state' && value === 'all')) params[key] = value;
      });
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const { data } = await api.get('/tasks/admin/tasks', { params });
      setRows(data.data.tasks || []);
      setPagination(data.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, debouncedSearch]);

  const loadGroups = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        api.get('/tasks/admin/tasks/trainers'),
        api.get('/tasks/admin/tasks/students'),
      ]);
      setTrainerRows(t.data.data.trainers || []);
      setStudentRows(s.data.data.students || []);
    } catch {
      // Group overviews are secondary views; failure here must not block the list
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadGroups();
  }, [loadStats, loadGroups]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setSearch('');
    setPage(1);
  };

  const openDetails = async (id) => {
    setLoadingDetail(true);
    setError('');
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTaskDetail(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  const openExtendModal = (task) => {
    const effective = task.effectiveDueDate || task.dueDate;
    setExtendModal({
      id: task._id,
      title: task.title,
      effective: effective ? new Date(effective).toISOString() : null,
      closed: !!task.submissionClosedAt || detailIsClosed(task),
    });
    setExtendForm({ newDeadline: '', reason: '' });
  };

  const handleExtendDeadline = async () => {
    if (!extendModal || !extendForm.newDeadline) return;
    setExtending(true);
    setError('');
    try {
      await api.post(`/tasks/${extendModal.id}/extend-deadline`, {
        newDeadline: fromLocalInputValue(extendForm.newDeadline),
        reason: extendForm.reason.trim() || undefined,
      });
      setExtendModal(null);
      setTaskDetail(null);
      showToast('success', 'Deadline extended — window reopened and student notified');
      loadList();
      loadStats();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExtending(false);
    }
  };

  const detailTask = taskDetail?.task;
  const detailSubmission = taskDetail?.submission;

  // Trainer/Student overview row click → jump to the filtered task list
  const filterByPerson = (id, key) => {
    if (!id) return;
    setFilters({ ...emptyFilters, [key]: id });
    setSearch('');
    setPage(1);
    setView('tasks');
  };

  const overviewCards = [
    { label: 'Total Tasks', value: stats?.totalTasks, accent: 'text-dark-900 dark:text-white' },
    { label: 'Active', value: stats?.activeTasks, accent: 'text-blue-600' },
    { label: 'Pending Submissions', value: stats?.pendingSubmissions, accent: 'text-dark-500' },
    { label: 'Submitted', value: stats?.submittedTasks, accent: 'text-purple-600' },
    { label: 'Late Submissions', value: stats?.lateSubmissions, accent: 'text-orange-600' },
    { label: 'Awaiting Review', value: stats?.awaitingReview, accent: 'text-amber-600' },
    { label: 'Approved', value: stats?.approvedSubmissions, accent: 'text-green-600' },
    { label: 'Rejected', value: stats?.rejectedSubmissions, accent: 'text-red-600' },
    { label: 'Closed Windows', value: stats?.closedTasks, accent: 'text-dark-700' },
    { label: 'Extended', value: stats?.extendedTasks, accent: 'text-indigo-600' },
  ];

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[80] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Task Management</h1>
          <p className="page-subtitle">Centralized monitoring of every task across all trainers and students</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { loadStats(); loadGroups(); loadList(); }}
            className="btn-outline flex items-center gap-2 text-sm"
          >
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="flex rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden text-sm font-medium">
            {[
              { id: 'tasks', label: 'All Tasks' },
              { id: 'trainers', label: 'By Trainer' },
              { id: 'students', label: 'By Student' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`px-4 py-2 ${view === tab.id ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 text-dark-500 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-sm text-red-700 dark:text-red-400 flex items-start gap-2"
          role="alert"
        >
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>{error}</div>
        </div>
      )}

      {/* Summary statistics — computed by the backend from actual records */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {overviewCards.map((card) => (
          <div key={card.label} className="card p-4">
            <p className="text-xs font-medium text-dark-500 dark:text-dark-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.accent}`}>{card.value ?? '—'}</p>
          </div>
        ))}
      </div>

      {view === 'tasks' && (
        <div className="table-container">
          {/* Filters */}
          <div className="table-header flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by task title, trainer or student name/email..."
                  className="input-field pl-10 py-2"
                />
              </div>
              <select value={filters.state} onChange={(e) => setFilter('state', e.target.value)} className="input-field py-2 md:w-52" aria-label="Task view filter">
                {STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
              <select value={filters.trainerId} onChange={(e) => setFilter('trainerId', e.target.value)} className="input-field py-2 lg:w-56" aria-label="Filter by trainer">
                <option value="">All Trainers</option>
                {trainerRows.map((t) => (
                  <option key={t._id || 'unknown'} value={t._id || ''}>{t.name || 'Unknown'}{t.email ? ` (${t.email})` : ''}</option>
                ))}
              </select>
              <select value={filters.studentId} onChange={(e) => setFilter('studentId', e.target.value)} className="input-field py-2 lg:w-56" aria-label="Filter by student">
                <option value="">All Students</option>
                {studentRows.map((s) => (
                  <option key={s._id || 'unknown'} value={s._id || ''}>{s.name || 'Unknown'}{s.email ? ` (${s.email})` : ''}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-dark-400 flex-1 min-w-0">
                <span className="whitespace-nowrap">Created:</span>
                <input type="date" value={filters.createdFrom} onChange={(e) => setFilter('createdFrom', e.target.value)} className="input-field py-1.5 text-xs" aria-label="Created from" />
                <span>–</span>
                <input type="date" value={filters.createdTo} onChange={(e) => setFilter('createdTo', e.target.value)} className="input-field py-1.5 text-xs" aria-label="Created to" />
              </label>
              <label className="flex items-center gap-2 text-xs text-dark-400 flex-1 min-w-0">
                <span className="whitespace-nowrap">Deadline:</span>
                <input type="date" value={filters.deadlineFrom} onChange={(e) => setFilter('deadlineFrom', e.target.value)} className="input-field py-1.5 text-xs" aria-label="Deadline from" />
                <span>–</span>
                <input type="date" value={filters.deadlineTo} onChange={(e) => setFilter('deadlineTo', e.target.value)} className="input-field py-1.5 text-xs" aria-label="Deadline to" />
              </label>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="btn-outline text-xs px-3 py-1.5 whitespace-nowrap">
                  Clear Filters ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-50 dark:bg-dark-800/50">
                <tr>
                  <th className={TH_CLASS}>Task</th>
                  <th className={TH_CLASS}>Trainer</th>
                  <th className={TH_CLASS}>Student</th>
                  <th className={TH_CLASS}>Deadline</th>
                  <th className={TH_CLASS}>Submission</th>
                  <th className={TH_CLASS}>Review</th>
                  <th className={TH_CLASS}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FiRefreshCw size={24} className="animate-spin text-primary-500" />
                        <p className="text-dark-400">Loading tasks...</p>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-dark-400 dark:text-dark-500">
                      <p className="text-lg font-medium">No tasks found</p>
                      <p className="text-sm mt-1">No task matches the current filters.</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const deadlinePassed = detailDeadlinePassed(row);
                    const marks = marksLabel(row.submission?.marks);
                    return (
                      <tr key={row._id} className="hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors">
                        <td className={`${TD_CLASS} max-w-[260px]`}>
                          <p className="truncate font-medium text-dark-900 dark:text-white">{row.title}</p>
                          <p className="truncate text-xs text-dark-400">{row.description}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <StatusBadge status={row.status} />
                            <span className="text-xs text-dark-400">{formatDateIST(row.createdAt)}</span>
                          </div>
                        </td>
                        <td className={TD_CLASS}>{personCell(row.trainer)}</td>
                        <td className={TD_CLASS}>{personCell(row.student)}</td>
                        <td className={TD_CLASS}>
                          <p className="text-sm text-dark-900 dark:text-white">{formatDateIST(row.effectiveDeadline || row.dueDate)}</p>
                          {row.isExtended && row.dueDate ? (
                            <p className="text-xs text-dark-400 line-through">{formatDateIST(row.dueDate)}</p>
                          ) : null}
                          {windowChip(row)}
                        </td>
                        <td className={TD_CLASS}>
                          {submissionChip(row)}
                          {row.submission?.submittedDate ? (
                            <p className="mt-1 text-xs text-dark-400">{formatDateIST(row.submission.submittedDate)}</p>
                          ) : null}
                        </td>
                        <td className={TD_CLASS}>
                          {marks ? (
                            <span className="text-sm font-semibold text-dark-900 dark:text-white">{marks}</span>
                          ) : (
                            <span className="text-xs text-dark-400">—</span>
                          )}
                        </td>
                        <td className={TD_CLASS}>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => openDetails(row._id)} className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                              View
                            </button>
                            {(row.isClosed || deadlinePassed) && (
                              <button
                                type="button"
                                onClick={() => openExtendModal(row)}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                              >
                                {row.isClosed ? 'Reopen' : 'Extend'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Server-side pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-dark-100 dark:border-dark-700">
              <p className="text-xs text-dark-400">
                Page {pagination.page} of {pagination.pages} · {pagination.total} tasks
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  className="btn-outline text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trainer-wise overview */}
      {view === 'trainers' && (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-50 dark:bg-dark-800/50">
                <tr>
                  <th className={TH_CLASS}>Trainer</th>
                  <th className={TH_CLASS}>Total</th>
                  <th className={TH_CLASS}>Active</th>
                  <th className={TH_CLASS}>Pending</th>
                  <th className={TH_CLASS}>Submitted</th>
                  <th className={TH_CLASS}>Late</th>
                  <th className={TH_CLASS}>Awaiting Review</th>
                  <th className={TH_CLASS}>Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                {trainerRows.map((row) => (
                  <tr
                    key={row._id || 'unknown-trainer'}
                    onClick={() => filterByPerson(row._id, 'trainerId')}
                    className={row._id ? 'cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors' : 'opacity-60'}
                    title={row._id ? 'View all tasks for this trainer' : 'Tasks without a linked trainer record'}
                  >
                    <td className={TD_CLASS}>{personCell({ name: row.name, email: row.email })}</td>
                    <td className={TD_CLASS}>{row.totalTasks}</td>
                    <td className={TD_CLASS}>{row.activeTasks}</td>
                    <td className={TD_CLASS}>{row.pendingSubmissions}</td>
                    <td className={TD_CLASS}>{row.submittedTasks}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${row.lateSubmissions ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}`}>{row.lateSubmissions}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${row.awaitingReview ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>{row.awaitingReview}</td>
                    <td className={TD_CLASS}>{row.closedTasks}</td>
                  </tr>
                ))}
                {trainerRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-dark-400">No trainer task data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student-wise overview */}
      {view === 'students' && (
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-50 dark:bg-dark-800/50">
                <tr>
                  <th className={TH_CLASS}>Student</th>
                  <th className={TH_CLASS}>Total</th>
                  <th className={TH_CLASS}>Pending</th>
                  <th className={TH_CLASS}>Submitted</th>
                  <th className={TH_CLASS}>Late</th>
                  <th className={TH_CLASS}>Approved</th>
                  <th className={TH_CLASS}>Rejected</th>
                  <th className={TH_CLASS}>Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                {studentRows.map((row) => (
                  <tr
                    key={row._id || 'unknown-student'}
                    onClick={() => filterByPerson(row._id, 'studentId')}
                    className={row._id ? 'cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-800/30 transition-colors' : 'opacity-60'}
                    title={row._id ? 'View all tasks for this student' : 'Tasks without a linked student record'}
                  >
                    <td className={TD_CLASS}>{personCell({ name: row.name, email: row.email })}</td>
                    <td className={TD_CLASS}>{row.totalTasks}</td>
                    <td className={TD_CLASS}>{row.pendingSubmissions}</td>
                    <td className={TD_CLASS}>{row.submittedTasks}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${row.lateSubmissions ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}`}>{row.lateSubmissions}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${row.approvedSubmissions ? 'text-green-600 dark:text-green-400 font-medium' : ''}`}>{row.approvedSubmissions}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${row.rejectedSubmissions ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>{row.rejectedSubmissions}</td>
                    <td className={TD_CLASS}>{row.closedTasks}</td>
                  </tr>
                ))}
                {studentRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-dark-400">No student task data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {taskDetail && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ${loadingDetail ? 'pointer-events-none opacity-60' : ''}`}
          onClick={() => setTaskDetail(null)}
        >
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Task Details</h3>
                <button onClick={() => setTaskDetail(null)} className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-200" aria-label="Close">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8">
                  <FiRefreshCw size={24} className="animate-spin text-primary-500" />
                </div>
              ) : !detailTask ? (
                <p className="text-dark-400">Task could not be loaded.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-dark-900 dark:text-white">{detailTask.title}</h4>
                    <p className="text-sm text-dark-500 dark:text-dark-300 whitespace-pre-line mt-1">{detailTask.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={detailTask.status} />
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300">Priority: {detailTask.priority}</span>
                      {detailWindowChip(detailTask)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-dark-400 text-xs">Created</p>
                      <p className="text-dark-900 dark:text-white">{formatDateTimeIST(detailTask.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Original deadline</p>
                      <p className="text-dark-900 dark:text-white">{formatDateTimeIST(detailTask.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Effective deadline</p>
                      <p className={`text-dark-900 dark:text-white ${detailTask.effectiveDueDate ? 'font-semibold' : ''}`}>
                        {formatDateTimeIST(detailTask.effectiveDueDate || detailTask.dueDate)}
                        {detailTask.effectiveDueDate ? ' (current)' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Submissions close at</p>
                      <p className="text-dark-900 dark:text-white">{formatDateTimeIST(detailClosesAt(detailTask))}</p>
                    </div>
                  </div>

                  {/* Trainer & student records (field-limited server-side) */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="border border-dark-200 dark:border-dark-600 rounded-lg p-3">
                      <p className="text-xs text-dark-400 font-medium">Trainer</p>
                      <p className="text-dark-900 dark:text-white font-medium">{detailTask.assignedBy?.name || 'Unknown'}</p>
                      <p className="text-xs text-dark-400">{detailTask.assignedBy?.email || ''}</p>
                    </div>
                    <div className="border border-dark-200 dark:border-dark-600 rounded-lg p-3">
                      <p className="text-xs text-dark-400 font-medium">Student</p>
                      <p className="text-dark-900 dark:text-white font-medium">{detailTask.assignedTo?.name || 'Unknown'}</p>
                      <p className="text-xs text-dark-400">{detailTask.assignedTo?.email || ''}</p>
                      <p className="text-xs text-dark-400">{detailTask.assignedTo?.collegeName || ''}</p>
                    </div>
                  </div>

                  {/* Extension audit history */}
                  {(detailTask.deadlineExtensions?.length ?? 0) > 0 && (
                    <div className="border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg p-3">
                      <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-400 mb-2">Deadline extension history</p>
                      <ul className="space-y-2">
                        {detailTask.deadlineExtensions.map((entry, index) => (
                          <li key={index} className="text-xs text-dark-700 dark:text-dark-300">
                            <span className="font-medium">{formatDateTimeIST(entry.extendedAt)}</span> —{' '}
                            {formatDateIST(entry.previousDeadline)} → <span className="font-medium">{formatDateTimeIST(entry.newDeadline)}</span>
                            {entry.extendedByName ? ` by ${entry.extendedByName}${entry.extendedByRole ? ` (${entry.extendedByRole})` : ''}` : ''}
                            {entry.reason ? <span className="italic text-dark-400"> · {entry.reason}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actual submission inspection */}
                  <div className="border-t border-dark-100 dark:border-dark-700 pt-4">
                    <h4 className="font-semibold text-dark-900 dark:text-white mb-3">Submission</h4>
                    {detailSubmission ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={detailSubmission.status} />
                          {detailSubmission.isLateSubmission ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Late Submission</span>
                          ) : null}
                          {detailSubmission.versions > 1 ? (
                            <span className="text-xs text-dark-400">Updated ×{detailSubmission.versions - 1}</span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-dark-400">Submitted</p>
                            <p className="text-dark-900 dark:text-white">{formatDateTimeIST(detailSubmission.submittedDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-dark-400">Last updated</p>
                            <p className="text-dark-900 dark:text-white">{formatDateTimeIST(detailSubmission.lastUpdatedAt || detailSubmission.submittedDate)}</p>
                          </div>
                        </div>
                        {detailSubmission.remarks ? (
                          <div>
                            <p className="text-xs text-dark-400 font-medium">Remarks</p>
                            <p className="whitespace-pre-line text-dark-800 dark:text-dark-200">{detailSubmission.remarks}</p>
                          </div>
                        ) : null}
                        {(detailSubmission.githubLink || detailSubmission.liveUrl) && (
                          <div>
                            <p className="text-xs text-dark-400 font-medium">Links</p>
                            <ul className="mt-1 space-y-1">
                              {detailSubmission.githubLink ? (
                                <li>
                                  <a href={detailSubmission.githubLink} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">
                                    GitHub: {detailSubmission.githubLink}
                                  </a>
                                </li>
                              ) : null}
                              {detailSubmission.liveUrl ? (
                                <li>
                                  <a href={detailSubmission.liveUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">
                                    Live URL: {detailSubmission.liveUrl}
                                  </a>
                                </li>
                              ) : null}
                            </ul>
                          </div>
                        )}
                        {(detailSubmission.files?.length ?? 0) > 0 && (
                          <div>
                            <p className="text-xs text-dark-400 font-medium">Attachments</p>
                            <ul className="mt-1 space-y-1">
                              {detailSubmission.files.map((file, index) => (
                                <li key={index} className="text-sm">
                                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">
                                    {file.filename || 'attachment'}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {detailSubmission.documentation ? (
                          <div>
                            <p className="text-xs text-dark-400 font-medium">Documentation</p>
                            <p className="whitespace-pre-line text-dark-800 dark:text-dark-200">{detailSubmission.documentation}</p>
                          </div>
                        ) : null}
                        {detailSubmission.videoDemo ? (
                          <p className="text-sm">
                            <span className="text-dark-400">Video demo: </span>
                            <a href={detailSubmission.videoDemo} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">
                              {detailSubmission.videoDemo}
                            </a>
                          </p>
                        ) : null}
                        {marksLabel(detailSubmission.marks) ? (
                          <p className="text-sm">
                            <span className="text-dark-400">Marks: </span>
                            <span className="font-semibold text-dark-900 dark:text-white">{marksLabel(detailSubmission.marks)}</span>
                          </p>
                        ) : null}
                        {detailSubmission.reviewNotes ? (
                          <div className="bg-dark-50 dark:bg-dark-700/50 rounded-lg p-3">
                            <p className="text-xs text-dark-400 font-medium">Review feedback</p>
                            <p className="text-sm text-dark-800 dark:text-dark-200 whitespace-pre-line">{detailSubmission.reviewNotes}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-dark-400">Not submitted yet.</p>
                    )}
                  </div>

                  {/* Reuse the audited extend/reopen action */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => openExtendModal(detailTask)}
                      disabled={!detailIsClosed(detailTask) && !detailDeadlinePassed(detailTask)}
                      className="btn-outline text-sm disabled:opacity-50"
                    >
                      Extend Deadline / Reopen Window
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Extend deadline / reopen window modal */}
      {extendModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" onClick={() => !extending && setExtendModal(null)}>
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                {extendModal.closed ? 'Reopen Submission Window' : 'Extend Deadline'}
              </h3>
              <p className="text-sm text-dark-400 mt-1">
                Task: <span className="font-medium text-dark-700 dark:text-dark-200">{extendModal.title}</span>
              </p>
              <p className="text-xs text-dark-400 mt-2">
                Current effective deadline: <span className="font-semibold text-dark-700 dark:text-dark-200">{formatDateTimeIST(extendModal.effective)}</span>
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">New Deadline (must be in the future)</label>
                  <input
                    type="datetime-local"
                    value={extendForm.newDeadline}
                    onChange={(e) => setExtendForm((f) => ({ ...f, newDeadline: e.target.value }))}
                    min={toLocalInputValue(new Date(Date.now() + 60000).toISOString())}
                    className="input-field w-full"
                  />
                  <p className="text-xs text-dark-400 mt-1">The original deadline is preserved and every extension is recorded in the audit trail. Submissions close 48 hours after this new deadline.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-200 mb-1">Reason (optional)</label>
                  <textarea
                    value={extendForm.reason}
                    onChange={(e) => setExtendForm((f) => ({ ...f, reason: e.target.value }))}
                    rows={2}
                    maxLength={500}
                    placeholder="Why is the deadline being extended?"
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setExtendModal(null)} disabled={extending} className="btn-secondary">Cancel</button>
                <button type="button" onClick={handleExtendDeadline} disabled={extending || !extendForm.newDeadline} className="btn-primary">
                  {extending ? 'Saving...' : extendModal.closed ? 'Reopen & Extend' : 'Extend Deadline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTasks;
