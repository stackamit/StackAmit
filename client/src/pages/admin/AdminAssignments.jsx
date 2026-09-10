import { useState, useEffect, useCallback } from 'react';
import {
  FiUsers, FiUserCheck, FiRefreshCw, FiSearch, FiPlus, FiX,
  FiTrash2, FiChevronRight, FiBriefcase, FiMail, FiCheckCircle,
} from 'react-icons/fi';
import api from '../../services/api';

const AdminAssignments = () => {
  const [trainers, setTrainers] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState('');

  // Fetch all trainers
  const fetchTrainers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/trainers', { params: { limit: 100 } });
      setTrainers(data.data.trainers || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrainers(); }, [fetchTrainers]);

  // Fetch trainer detail with assigned students
  const selectTrainer = async (trainer) => {
    setSelectedTrainer(trainer);
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/trainers/${trainer._id}`);
      setAssignedStudents(data.data.trainer.assignedStudents || []);
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  // Fetch unassigned students for the assign modal
  const openAssignModal = async () => {
    setShowAssignModal(true);
    setSelectedStudents([]);
    setSelectedInternship('');
    setStudentSearch('');
    try {
      const [studentsRes, internshipsRes] = await Promise.all([
        api.get('/students', { params: { limit: 200 } }),
        api.get('/internships', { params: { limit: 100, status: 'published' } }),
      ]);
      // Filter to only students not already assigned to this trainer
      const assignedIds = new Set(assignedStudents.map(s => s._id));
      const available = (studentsRes.data.data.students || []).filter(s => !assignedIds.has(s._id));
      setAvailableStudents(available);
      setInternships(internshipsRes.data.data.internships || []);
    } catch (err) { console.error(err); }
  };

  // Assign selected students
  const handleAssign = async () => {
    if (selectedStudents.length === 0) return;
    setAssignLoading(true);
    try {
      const payload = { studentIds: selectedStudents };
      if (selectedInternship) payload.internshipId = selectedInternship;
      await api.post(`/trainers/${selectedTrainer._id}/assign-students`, payload);
      setShowAssignModal(false);
      selectTrainer(selectedTrainer); // Refresh
      fetchTrainers(); // Refresh trainer list counts
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to assign students');
    } finally { setAssignLoading(false); }
  };

  // Remove student from trainer
  const handleRemove = async (studentId) => {
    if (!window.confirm('Remove this student from the trainer?')) return;
    try {
      await api.delete(`/trainers/${selectedTrainer._id}/students/${studentId}`);
      setAssignedStudents(prev => prev.filter(s => s._id !== studentId));
      fetchTrainers();
    } catch (err) { console.error(err); }
  };

  const toggleStudentSelect = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredTrainers = trainers.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAvailable = availableStudents.filter(s =>
    !studentSearch || s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const getName = (s) => s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'N/A';

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Student Assignments</h1>
          <p className="page-subtitle">Assign students to trainers for internships</p>
        </div>
        <button onClick={fetchTrainers} className="btn-outline flex items-center gap-2 text-sm self-start">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trainer List */}
        <div className="lg:col-span-1">
          <div className="card p-0">
            <div className="p-4 border-b border-dark-100 dark:border-dark-700">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" placeholder="Search trainers..." />
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-dark-100 dark:divide-dark-700">
              {loading ? (
                <div className="p-6 text-center text-dark-400">
                  <FiRefreshCw size={20} className="animate-spin mx-auto mb-2" /> Loading...
                </div>
              ) : filteredTrainers.length === 0 ? (
                <div className="p-6 text-center text-dark-400">
                  <FiUserCheck size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No trainers found</p>
                </div>
              ) : (
                filteredTrainers.map(t => {
                  const isSelected = selectedTrainer?._id === t._id;
                  const count = t.assignedStudents?.length || 0;
                  return (
                    <button
                      key={t._id}
                      onClick={() => selectTrainer(t)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/10 border-l-2 border-primary-500' : ''
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      }`}>
                        {(t.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark-900 dark:text-white text-sm truncate">{t.name}</p>
                        <p className="text-xs text-dark-400 truncate">{t.email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          count > 0
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'bg-dark-100 dark:bg-dark-700 text-dark-500'
                        }`}>
                          {count} {count === 1 ? 'student' : 'students'}
                        </span>
                        <FiChevronRight size={14} className="text-dark-400" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Assigned Students */}
        <div className="lg:col-span-2">
          <div className="card p-0">
            {!selectedTrainer ? (
              <div className="p-12 text-center">
                <FiUserCheck size={48} className="mx-auto text-dark-300 dark:text-dark-600 mb-3" />
                <p className="text-lg font-medium text-dark-600 dark:text-dark-400">Select a trainer</p>
                <p className="text-sm text-dark-400 mt-1">Choose a trainer from the left to view and manage their assigned students.</p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-dark-100 dark:border-dark-700 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-dark-900 dark:text-white flex items-center gap-2">
                      <FiUserCheck size={18} className="text-primary-500" />
                      {selectedTrainer.name}
                    </h3>
                    <p className="text-sm text-dark-400 mt-0.5">
                      {assignedStudents.length} student{assignedStudents.length !== 1 ? 's' : ''} assigned
                      {selectedTrainer.maxStudents ? ` • ${selectedTrainer.maxStudents - assignedStudents.length} slot${selectedTrainer.maxStudents - assignedStudents.length !== 1 ? 's' : ''} available` : ''}
                    </p>
                  </div>
                  <button onClick={openAssignModal} className="btn-primary text-sm flex items-center gap-1.5">
                    <FiPlus size={14} /> Assign Students
                  </button>
                </div>

                <div className="max-h-[520px] overflow-y-auto">
                  {detailLoading ? (
                    <div className="p-8 text-center text-dark-400">
                      <FiRefreshCw size={20} className="animate-spin mx-auto mb-2" /> Loading students...
                    </div>
                  ) : assignedStudents.length === 0 ? (
                    <div className="p-8 text-center">
                      <FiUsers size={36} className="mx-auto text-dark-300 dark:text-dark-600 mb-2 opacity-30" />
                      <p className="text-dark-500 font-medium">No students assigned</p>
                      <p className="text-sm text-dark-400 mt-1">Click "Assign Students" to add students to this trainer.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-dark-100 dark:divide-dark-700">
                      {assignedStudents.map(s => (
                        <div key={s._id} className="flex items-center gap-4 px-4 py-3 hover:bg-dark-50 dark:hover:bg-dark-700/30 transition-colors">
                          {s.avatar?.url ? (
                            <img src={s.avatar.url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm flex-shrink-0">
                              {(getName(s)).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-dark-900 dark:text-white text-sm">{getName(s)}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-dark-400 flex items-center gap-1"><FiMail size={10} />{s.email}</span>
                              {s.collegeName && <span className="text-xs text-dark-400">• {s.collegeName}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {s.currentInternship ? (
                              <div className="hidden sm:flex items-center gap-1 text-xs text-dark-500">
                                <FiBriefcase size={12} className="text-primary-500" />
                                <span>{s.currentInternship.title}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  s.currentInternship.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                  s.currentInternship.status === 'closed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>{s.currentInternship.status}</span>
                              </div>
                            ) : (
                              <span className="hidden sm:block text-xs text-dark-400 italic">No internship</span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              s.profileCompletion >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              s.profileCompletion >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-dark-100 dark:bg-dark-700 text-dark-500'
                            }`}>{s.profileCompletion || 0}%</span>
                            <button
                              onClick={() => handleRemove(s._id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500 transition-colors"
                              title="Remove from trainer"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Assign Students Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !assignLoading && setShowAssignModal(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-dark-800 rounded-2xl shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-100 dark:border-dark-700">
              <div>
                <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Assign Students</h2>
                <p className="text-sm text-dark-400">Assign students to <strong>{selectedTrainer?.name}</strong> with optional internship</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                <FiX size={18} className="text-dark-400" />
              </button>
            </div>

            <div className="p-4">
              {/* Internship Selection */}
              <div className="mb-4">
                <label className="label flex items-center gap-2">
                  <FiBriefcase size={14} className="text-primary-500" />
                  Assign to Internship <span className="text-dark-400 font-normal">(optional)</span>
                </label>
                <select
                  value={selectedInternship}
                  onChange={e => setSelectedInternship(e.target.value)}
                  className="input-field py-2.5"
                >
                  <option value="">-- Select Internship --</option>
                  {internships.map(i => (
                    <option key={i._id} value={i._id}>
                      {i.title} — {i.category} ({i.seats.total - i.seats.filled} seats left)
                    </option>
                  ))}
                </select>
                {internships.length === 0 && (
                  <p className="text-xs text-dark-400 mt-1">No published internships available. Create and publish one first.</p>
                )}
              </div>

              {/* Student Selection */}
              <label className="label flex items-center gap-2 mb-2">
                <FiUsers size={14} className="text-primary-500" />
                Select Students
              </label>
              <div className="relative mb-3">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="input-field pl-9 py-2 text-sm" placeholder="Search students..." />
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-dark-100 dark:divide-dark-700 rounded-lg border border-dark-200 dark:border-dark-700">
                {filteredAvailable.length === 0 ? (
                  <div className="p-6 text-center text-dark-400 text-sm">
                    {availableStudents.length === 0 ? 'All students are already assigned to this trainer.' : 'No students match your search.'}
                  </div>
                ) : (
                  filteredAvailable.map(s => {
                    const isSelected = selectedStudents.includes(s._id);
                    return (
                      <button
                        key={s._id}
                        onClick={() => toggleStudentSelect(s._id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${
                          isSelected ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'border-dark-300 dark:border-dark-600'
                        }`}>
                          {isSelected && <FiCheckCircle size={12} />}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 text-xs font-semibold flex-shrink-0">
                          {(getName(s)).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-dark-900 dark:text-white truncate">{getName(s)}</p>
                          <p className="text-xs text-dark-400 truncate">{s.email} • {s.collegeName || 'N/A'}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedStudents.length > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-primary-600 font-medium">
                    {selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected
                  </p>
                  {selectedInternship && (
                    <p className="text-xs text-dark-400 flex items-center gap-1">
                      <FiBriefcase size={12} className="text-primary-500" />
                      {internships.find(i => i._id === selectedInternship)?.title || 'Internship'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-100 dark:border-dark-700">
              <button onClick={() => setShowAssignModal(false)} className="btn-secondary text-sm" disabled={assignLoading}>Cancel</button>
              <button
                onClick={handleAssign}
                disabled={selectedStudents.length === 0 || assignLoading}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {assignLoading ? (
                  <><FiRefreshCw size={14} className="animate-spin" /> Assigning...</>
                ) : (
                  <><FiPlus size={14} /> Assign {selectedStudents.length > 0 ? `${selectedStudents.length} Student${selectedStudents.length > 1 ? 's' : ''}` : ''}{selectedInternship ? ' + Internship' : ''}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssignments;
