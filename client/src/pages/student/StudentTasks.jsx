import { useState, useEffect } from "react";
import {
  FiSearch,
  FiCheckSquare,
  FiRefreshCw,
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
  FiSend,
  FiXCircle,
  FiRotateCcw,
  FiMessageSquare,
  FiEye,
  FiPaperclip,
  FiX,
} from "react-icons/fi";
import api from "../../services/api";
import toast from 'react-hot-toast';
import { formatDateTimeIST } from "../../utils/dateTime";

const StudentTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showSubmit, setShowSubmit] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [submitForm, setSubmitForm] = useState({
    githubLink: "",
    liveUrl: "",
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get("/tasks", { params });
      setTasks(data.data.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post(`/tasks/${showSubmit}/submit`, submitForm);
      toast.success(data?.message || "Submission saved successfully");
      setShowSubmit(null);
      setSubmitForm({ githubLink: "", liveUrl: "", remarks: "" });
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (s) =>
    ({
      pending: <FiClock className="text-yellow-500" />,
      "in-progress": <FiAlertCircle className="text-blue-500" />,
      completed: <FiCheckCircle className="text-green-500" />,
      late: <FiAlertCircle className="text-red-500" />,
    })[s] || null;
  const statusColor = (s) =>
    ({
      pending:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      "in-progress":
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      completed:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      late: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    })[s] || "";
  const priorityColor = (p) =>
    ({
      low: "text-gray-500",
      medium: "text-blue-500",
      high: "text-orange-500",
      urgent: "text-red-500",
    })[p] || "";
  const submissionStatusInfo = (s, sub = {}) => {
    const info =
      {
        submitted: {
          label: "Submitted - Awaiting Review",
          color:
            "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          icon: <FiClock size={14} />,
        },
        approved: {
          label: "Approved",
          color:
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
          icon: <FiCheckCircle size={14} />,
        },
        rejected: {
          label: "Rejected - Resubmission Allowed",
          color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
          icon: <FiXCircle size={14} />,
        },
        resubmission_requested: {
          label: "Resubmission Requested",
          color:
            "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          icon: <FiRotateCcw size={14} />,
        },
      }[s] || { label: s, color: "", icon: null };
    // Latest-terminology refinement (server-provided submission metadata):
    // an edited pending-review submission shows as "Updated", late work as
    // "Late Submission".
    if (s === "submitted") {
      if (sub.versions > 1 || sub.lastUpdatedAt) info.label = "Updated - Awaiting Review";
      else if (sub.isLateSubmission) info.label = "Late Submission - Awaiting Review";
    }
    return info;
  };
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  // Submission-window state (mirrors the backend's authoritative check).
  // Once the automatic closure (deadline + 48h) or a job stamp closes the
  // window, no submit/update is offered; the backend rejects it anyway.
  const isWindowClosed = (t) => Boolean(t.isSubmissionClosed);

  const canSubmit = (t) => {
    if (isWindowClosed(t)) return false;
    if (t.submission) {
      // Edit while awaiting review, resubmit after rejection. Approved work
      // is locked (matches backend: editing would invalidate the grade).
      return t.submission.status !== "approved";
    }
    return ["pending", "in-progress", "late"].includes(t.status);
  };

  const getSubmitLabel = (t) => {
    if (
      t.submission &&
      (t.submission.status === "rejected" ||
        t.submission.status === "resubmission_requested")
    )
      return "Resubmit";
    if (t.submission && t.submission.status === "submitted") return "Edit Submission";
    return "Submit";
  };

  // Mode of the currently open submit modal.
  const submittingTask = tasks.find((x) => x._id === showSubmit) || null;
  const submitModalTitle = submittingTask?.submission
    ? submittingTask.submission.status === "rejected" ||
      submittingTask.submission.status === "resubmission_requested"
      ? "Resubmit Task"
      : "Edit Submission"
    : "Submit Task";

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="page-subtitle">View and submit your assigned tasks</p>
        </div>
        <button
          onClick={fetchTasks}
          className="btn-outline flex items-center gap-2 text-sm self-start"
        >
          <FiRefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      </div>

      <div className="table-container mb-6">
        <div className="table-header flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 py-2"
              placeholder="Search tasks..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field py-2 w-auto"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="late">Late</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FiRefreshCw size={24} className="animate-spin text-primary-500" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="table-container p-12 text-center text-dark-400">
          <FiCheckSquare size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No tasks assigned yet</p>
          <p className="text-sm mt-1">Your assigned tasks will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((t) => {
            const subInfo = t.submission
              ? submissionStatusInfo(t.submission.status, t.submission)
              : null;
            return (
              <div
                key={t._id}
                className="card p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedTask(t)}
                title="View task details"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{statusIcon(t.status)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-dark-900 dark:text-white">
                        {t.title}
                      </h3>
                      <p className="text-sm text-dark-500 mt-1 line-clamp-2">
                        {t.description}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-dark-400">
                        <span>Due: {formatDate(t.effectiveDueDate || t.dueDate)}</span>
                        {t.isDeadlineExtended && (
                          <span className="font-medium text-orange-500">
                            Reopened / Extended
                          </span>
                        )}
                        {isWindowClosed(t) ? (
                          <span className="font-medium text-red-500">
                            Submission Closed
                          </span>
                        ) : (
                          t.submissionClosesAt && (
                            <span>
                              Closes: {formatDateTimeIST(t.submissionClosesAt)}
                            </span>
                          )
                        )}
                        <span
                          className={`font-medium ${priorityColor(t.priority)}`}
                        >
                          Priority: {t.priority}
                        </span>
                        <span>Assigned by: {t.assignedBy?.name || "N/A"}</span>
                      </div>
                      {t.marks?.total > 0 && (
                        <p className="text-xs text-dark-400 mt-1">
                          Marks: {t.marks.obtained || "—"}/{t.marks.total}
                        </p>
                      )}

                      {/* Submission status badge */}
                      {subInfo && (
                        <div className="mt-3 space-y-2">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${subInfo.color}`}
                          >
                            {subInfo.icon} {subInfo.label}
                          </div>

                          {/* Show trainer review notes if rejected */}
                          {(t.submission.status === "rejected" ||
                            t.submission.status === "resubmission_requested") &&
                            t.submission.reviewNotes && (
                              <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/50">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <FiMessageSquare
                                    size={12}
                                    className="text-red-500"
                                  />
                                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    Trainer Feedback
                                  </span>
                                </div>
                                <p className="text-xs text-dark-600 dark:text-dark-300">
                                  {t.submission.reviewNotes}
                                </p>
                              </div>
                            )}

                          {t.submission.submittedDate && (
                            <p className="text-xs text-dark-400">
                              Last submitted:{" "}
                              {formatDate(t.submission.submittedDate)}
                            </p>
                          )}
                          {t.submission.lastUpdatedAt && (
                            <p className="text-xs text-dark-400">
                              Last updated:{" "}
                              {formatDateTimeIST(t.submission.lastUpdatedAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}
                    >
                      {t.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(t);
                      }}
                      className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                      title="View details"
                    >
                      <FiEye size={16} />
                    </button>
                    {canSubmit(t) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubmitForm({
                            githubLink: t.submission?.githubLink || "",
                            liveUrl: t.submission?.liveUrl || "",
                            remarks: t.submission?.remarks || "",
                          });
                          setShowSubmit(t._id);
                        }}
                        className="btn-primary text-xs flex items-center gap-1"
                        title={
                          t.submission ? "Edit your existing submission" : "Submit task"
                        }
                      >
                        <FiSend size={12} /> {getSubmitLabel(t)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
              <h2 className="text-xl font-bold text-dark-900 dark:text-white pr-8">
                {selectedTask.title}
              </h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 shrink-0"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(selectedTask.status)}`}
                >
                  {selectedTask.status}
                </span>
                <span
                  className={`text-xs font-medium capitalize ${priorityColor(selectedTask.priority)}`}
                >
                  Priority: {selectedTask.priority}
                </span>
                <span className="text-xs text-dark-400">
                  Due: {formatDate(selectedTask.effectiveDueDate || selectedTask.dueDate)}
                </span>
                {selectedTask.isDeadlineExtended && (
                  <span className="text-xs font-medium text-orange-500">
                    Reopened / Extended
                  </span>
                )}
                {isWindowClosed(selectedTask) ? (
                  <span className="text-xs font-medium text-red-500">
                    Submission Closed
                  </span>
                ) : (
                  selectedTask.submissionClosesAt && (
                    <span className="text-xs text-dark-400">
                      Closes: {formatDateTimeIST(selectedTask.submissionClosesAt)}
                    </span>
                  )
                )}
                <span className="text-xs text-dark-400">
                  Assigned by:{" "}
                  <strong className="text-dark-600 dark:text-dark-300">
                    {selectedTask.assignedBy?.name || "N/A"}
                  </strong>
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-200 mb-1">
                  Description
                </h3>
                <p className="text-sm text-dark-600 dark:text-dark-300 whitespace-pre-line">
                  {selectedTask.description}
                </p>
              </div>

              {selectedTask.instructions && (
                <div>
                  <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-200 mb-1">
                    Instructions to Complete
                  </h3>
                  <p className="text-sm text-dark-600 dark:text-dark-300 whitespace-pre-line">
                    {selectedTask.instructions}
                  </p>
                </div>
              )}

              {selectedTask.attachments?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-200 mb-2">
                    Attachments
                  </h3>
                  <div className="space-y-2">
                    {selectedTask.attachments.map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <FiPaperclip size={14} />
                        {a.filename || "Attachment"}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.marks?.total > 0 && (
                <p className="text-sm text-dark-500">
                  Marks:{" "}
                  <strong>
                    {selectedTask.marks.obtained || "—"}/
                    {selectedTask.marks.total}
                  </strong>
                </p>
              )}

              {canSubmit(selectedTask) && (
                <div className="flex justify-end pt-2 border-t border-dark-200 dark:border-dark-700">
                  <button
                    onClick={() => {
                      setSubmitForm({
                        githubLink: selectedTask.submission?.githubLink || "",
                        liveUrl: selectedTask.submission?.liveUrl || "",
                        remarks: selectedTask.submission?.remarks || "",
                      });
                      setShowSubmit(selectedTask._id);
                      setSelectedTask(null);
                    }}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    <FiSend size={14} /> {getSubmitLabel(selectedTask)}
                  </button>
                </div>
              )}
              {!canSubmit(selectedTask) &&
                !selectedTask.submission &&
                isWindowClosed(selectedTask) && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-400">
                    The submission window for this task is closed. Contact your
                    trainer or admin if an extension is needed.
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showSubmit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowSubmit(null)}
        >
          <div
            className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">
              {submitModalTitle}
            </h2>
            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div>
                <label className="label">GitHub Link</label>
                <input
                  className="input-field"
                  value={submitForm.githubLink}
                  onChange={(e) =>
                    setSubmitForm({ ...submitForm, githubLink: e.target.value })
                  }
                  placeholder="https://github.com/..."
                />
              </div>
              <div>
                <label className="label">Live URL</label>
                <input
                  className="input-field"
                  value={submitForm.liveUrl}
                  onChange={(e) =>
                    setSubmitForm({ ...submitForm, liveUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={submitForm.remarks}
                  onChange={(e) =>
                    setSubmitForm({ ...submitForm, remarks: e.target.value })
                  }
                  placeholder="Any notes..."
                />
              </div>
              {/* Google Form Link */}
              {/* <div className="pt-2"><p className="text-sm text-gray-600 mb-2">After submitting your task, please complete the task submission form:</p><a href="https://forms.gle/YOUR_GOOGLE_FORM_ID" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium underline">📋 Open Task Submission Google Form </a></div> */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSubmit(null)}
                  className="btn-outline text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-sm"
                >
                  {submitting
                    ? "Submitting..."
                    : submitModalTitle === "Edit Submission"
                      ? "Update Submission"
                      : submitModalTitle === "Resubmit Task"
                        ? "Resubmit Task"
                        : "Submit Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentTasks;
