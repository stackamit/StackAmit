import { useState, useEffect } from 'react';
import {
  FiPlus, FiSearch, FiRefreshCw, FiTrash2, FiCheckCircle, FiClock,
  FiAlertCircle, FiX, FiEye, FiExternalLink, FiFile, FiGithub,
  FiGlobe, FiMessageSquare, FiAward, FiChevronRight, FiUser,
  FiCalendar, FiFlag,
} from 'react-icons/fi';
import api from '../../services/api';

const TrainerTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium', instructions: '' });
  const [saving, setSaving] = useState(false);

  // Task detail / submission review
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetail, setTaskDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({ status: '', marks: { obtained: 0, total: 100 }, reviewNotes: '' });
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/tasks', { params });
      setTasks(data.data.tasks);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = async () => {
    setShowCreate(true);
    try { const { data } = await api.get('/students', { params: { limit: 100 } }); setStudents(data.data.students); }
    catch (err) { console.error(err); }
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.post('/tasks', form); setShowCreate(false); setForm({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium', instructions: '' }); fetchTasks(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to create'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try { await api.delete(`/tasks/${id}`); fetchTasks(); }
    catch (err) { console.error(err); }
  };

  // Open task detail & fetch submission
  const openTaskDetail = async (task) => {
    setSelectedTask(task);
    setDetailLoading(true);
    setTaskDetail(null);
    setReviewForm({ status: '', marks: { obtained: 0, total: 100 }, reviewNotes: '' });
    try {
      const { data } = await api.get(`/tasks/${task._id}`);
      setTaskDetail(data.data);
      // Pre-fill review form if submission exists and has marks
      if (data.data.submission?.marks) {
        setReviewForm(prev => ({ ...prev, marks: data.data.submission.marks }));
      }
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.status || !taskDetail?.submission) return;
    setReviewing(true);
    try {
      await api.patch(`/tasks/submissions/${taskDetail.submission._id}/review`, reviewForm);
      // Refresh detail
      const { data } = await api.get(`/tasks/${selectedTask._id}`);
      setTaskDetail(data.data);
      fetchTasks();
    } catch (err) { alert(err.response?.data?.message || 'Failed to review'); }
    finally { setReviewing(false); }
  };

  const statusColor = (s) => ({ pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', 'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', late: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }[s] || '');
  const priorityColor = (p) => ({ low: 'text-gray-500', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500' }[p] || '');
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const submissionStatusColor = (s) => ({ submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', resubmission_requested: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }[s] || '');

  const submission = taskDetail?.submission;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="page-title">Task Management</h1><p className="page-subtitle">Create and manage tasks for students</p></div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchTasks(); }} className="btn-outline flex items-center gap-2 text-sm"><FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm"><FiPlus size={16} /> Create Task</button>
        </div>
      </div>

      <div className="table-container mb-6">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10 py-2" placeholder="Search tasks..." /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field py-2 w-auto"><option value="">All Status</option><option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="completed">Completed</option><option value="late">Late</option></select>
        </div>
      </div>

      {loading ? (<div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>)
      : tasks.length === 0 ? (<div className="table-container p-12 text-center text-dark-400"><p className="text-lg font-medium">No tasks created yet</p><p className="text-sm mt-1">Create your first task for students.</p></div>)
      : (
        <div className="grid gap-4">
          {tasks.map(t => (
            <div key={t._id} className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-dark-900 dark:text-white">{t.title}</h3>
                    <span className={`text-xs font-medium ${priorityColor(t.priority)}`}>• {t.priority}</span>
                  </div>
                  <p className="text-sm text-dark-500 mt-1 line-clamp-2">{t.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-dark-400">
                    <span>Assigned to: <strong className="text-dark-600 dark:text-dark-300">{t.assignedTo?.name || 'N/A'}</strong></span>
                    <span>Due: {formatDate(t.dueDate)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}>{t.status}</span>
                  <button onClick={() => openTaskDetail(t)} className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400" title="View details & submission">
                    <FiEye size={16} />
                  </button>
                  <button onClick={() => handleDelete(t._id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><FiTrash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail / Submission Review Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setSelectedTask(null)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <h2 className="text-xl font-bold text-dark-900 dark:text-white">Task Details</h2>
              <button onClick={() => setSelectedTask(null)}><FiX size={20} className="text-dark-400" /></button>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12"><FiRefreshCw size={24} className="animate-spin text-primary-500" /></div>
              ) : taskDetail ? (
                <div className="space-y-6">
                  {/* Task Info */}
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(taskDetail.task.status)}`}>{taskDetail.task.status}</span>
                      <span className={`text-xs font-medium ${priorityColor(taskDetail.task.priority)}`}>• {taskDetail.task.priority} priority</span>
                    </div>
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white">{taskDetail.task.title}</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mt-2 whitespace-pre-wrap">{taskDetail.task.description}</p>

                    {taskDetail.task.instructions && (
                      <div className="mt-3 p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                        <p className="text-xs font-medium text-dark-500 mb-1">Instructions</p>
                        <p className="text-sm text-dark-600 dark:text-dark-300 whitespace-pre-wrap">{taskDetail.task.instructions}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="flex items-center gap-2 text-sm text-dark-500">
                        <FiUser size={14} className="text-dark-400" />
                        <span>Student: <strong className="text-dark-700 dark:text-dark-300">{taskDetail.task.assignedTo?.name || taskDetail.task.assignedTo?.firstName ? `${taskDetail.task.assignedTo.firstName} ${taskDetail.task.assignedTo.lastName || ''}` : 'N/A'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-dark-500">
                        <FiCalendar size={14} className="text-dark-400" />
                        <span>Due: {formatDate(taskDetail.task.dueDate)}</span>
                      </div>
                      {taskDetail.task.completedAt && (
                        <div className="flex items-center gap-2 text-sm text-dark-500">
                          <FiCheckCircle size={14} className="text-green-500" />
                          <span>Completed: {formatDate(taskDetail.task.completedAt)}</span>
                        </div>
                      )}
                      {taskDetail.task.marks?.total > 0 && (
                        <div className="flex items-center gap-2 text-sm text-dark-500">
                          <FiAward size={14} className="text-primary-500" />
                          <span>Marks: {taskDetail.task.marks.obtained || 0} / {taskDetail.task.marks.total}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Response / Submission */}
                  <div className="border-t border-dark-200 dark:border-dark-700 pt-6">
                    <h4 className="font-semibold text-dark-900 dark:text-white flex items-center gap-2 mb-4">
                      <FiMessageSquare size={18} className="text-primary-500" />
                      Student Response
                    </h4>

                    {!submission ? (
                      <div className="text-center py-8 bg-dark-50 dark:bg-dark-700/30 rounded-xl">
                        <FiClock size={32} className="mx-auto text-dark-300 dark:text-dark-600 mb-3" />
                        <p className="text-dark-500 dark:text-dark-400 font-medium">No submission yet</p>
                        <p className="text-sm text-dark-400 mt-1">Student hasn't submitted this task.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Submission status */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-dark-500">Submitted: {formatDate(submission.submittedDate || submission.createdAt)}</span>
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${submissionStatusColor(submission.status)}`}>{submission.status.replace('_', ' ')}</span>
                        </div>

                        {/* GitHub Link */}
                        {submission.githubLink && (
                          <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <FiGithub size={16} className="text-dark-500" />
                              <span className="text-xs font-medium text-dark-500">GitHub Repository</span>
                            </div>
                            <a href={submission.githubLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 break-all">
                              {submission.githubLink} <FiExternalLink size={12} className="flex-shrink-0" />
                            </a>
                          </div>
                        )}

                        {/* Live URL */}
                        {submission.liveUrl && (
                          <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <FiGlobe size={16} className="text-dark-500" />
                              <span className="text-xs font-medium text-dark-500">Live Demo / Deployment</span>
                            </div>
                            <a href={submission.liveUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 break-all">
                              {submission.liveUrl} <FiExternalLink size={12} className="flex-shrink-0" />
                            </a>
                          </div>
                        )}

                        {/* Documentation */}
                        {submission.documentation && (
                          <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <FiFile size={16} className="text-dark-500" />
                              <span className="text-xs font-medium text-dark-500">Documentation</span>
                            </div>
                            <p className="text-sm text-dark-700 dark:text-dark-300 whitespace-pre-wrap">{submission.documentation}</p>
                          </div>
                        )}

                        {/* Video Demo */}
                        {submission.videoDemo && (
                          <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <FiGlobe size={16} className="text-dark-500" />
                              <span className="text-xs font-medium text-dark-500">Video Demo</span>
                            </div>
                            <a href={submission.videoDemo} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 break-all">
                              {submission.videoDemo} <FiExternalLink size={12} className="flex-shrink-0" />
                            </a>
                          </div>
                        )}

                        {/* Student Remarks */}
                        {submission.remarks && (
                          <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <FiMessageSquare size={16} className="text-dark-500" />
                              <span className="text-xs font-medium text-dark-500">Student Remarks</span>
                            </div>
                            <p className="text-sm text-dark-700 dark:text-dark-300 whitespace-pre-wrap">{submission.remarks}</p>
                          </div>
                        )}

                        {/* Attached Files */}
                        {submission.files?.length > 0 && (
                          <div className="p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <FiFile size={16} className="text-dark-500" />
                              <span className="text-xs font-medium text-dark-500">Attached Files ({submission.files.length})</span>
                            </div>
                            <div className="space-y-1">
                              {submission.files.map((f, i) => (
                                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                                  <FiChevronRight size={12} /> {f.filename || `File ${i + 1}`}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Previous Review */}
                        {submission.reviewNotes && (
                          <div className="p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800">
                            <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">Your Previous Review Notes</p>
                            <p className="text-sm text-dark-700 dark:text-dark-300">{submission.reviewNotes}</p>
                          </div>
                        )}

                        {/* Review Form */}
                        <form onSubmit={handleReview} className="border-t border-dark-200 dark:border-dark-700 pt-4 space-y-4">
                          <h5 className="font-medium text-dark-900 dark:text-white text-sm">Review Submission</h5>

                          <div>
                            <label className="label">Decision *</label>
                            <select required value={reviewForm.status} onChange={e => setReviewForm({ ...reviewForm, status: e.target.value })} className="input-field">
                              <option value="">Select decision</option>
                              <option value="approved">Approve</option>
                              <option value="rejected">Reject</option>
                              <option value="resubmission_requested">Request Resubmission</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="label">Marks Obtained</label>
                              <input type="number" min="0" value={reviewForm.marks.obtained} onChange={e => setReviewForm({ ...reviewForm, marks: { ...reviewForm.marks, obtained: Number(e.target.value) } })} className="input-field" />
                            </div>
                            <div>
                              <label className="label">Total Marks</label>
                              <input type="number" min="1" value={reviewForm.marks.total} onChange={e => setReviewForm({ ...reviewForm, marks: { ...reviewForm.marks, total: Number(e.target.value) } })} className="input-field" />
                            </div>
                          </div>

                          <div>
                            <label className="label">Review Notes</label>
                            <textarea value={reviewForm.reviewNotes} onChange={e => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })} className="input-field" rows={3} placeholder="Feedback for the student..." />
                          </div>

                          <div className="flex justify-end">
                            <button type="submit" disabled={reviewing || !reviewForm.status} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
                              {reviewing ? <FiRefreshCw size={14} className="animate-spin" /> : <FiCheckCircle size={14} />}
                              {reviewing ? 'Submitting...' : 'Submit Review'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-dark-400">
                  <FiAlertCircle size={32} className="mx-auto mb-3 opacity-50" />
                  <p>Failed to load task details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-dark-900 dark:text-white">Create Task</h2><button onClick={() => setShowCreate(false)}><FiX size={20} className="text-dark-400" /></button></div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="label">Title *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="Task title" /></div>
              <div><label className="label">Description *</label><textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} placeholder="Task description" /></div>
              <div><label className="label">Assign To *</label><select required value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className="input-field"><option value="">Select student</option>{students.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Due Date *</label><input type="date" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="input-field" /></div>
                <div><label className="label">Priority</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="input-field"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
              </div>
              <div><label className="label">Instructions</label><textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} className="input-field" rows={2} placeholder="Additional instructions..." /></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowCreate(false)} className="btn-outline text-sm">Cancel</button><button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Creating...' : 'Create Task'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerTasks;
