import { useState, useEffect } from 'react';
import {
  FiSearch, FiRefreshCw, FiUsers, FiMessageSquare,
  FiLayers, FiActivity, FiArrowRight, FiSmile,
} from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import ChatPanel from '../../components/ChatPanel';

// Compact relative time (WhatsApp style list timestamp)
const timeAgo = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
};

// Small colored dot used to hint at a program's category
const categoryDot = (category) => {
  const map = {
    'Web Development': 'bg-sky-400',
    'Mobile Development': 'bg-violet-400',
    'Data Science': 'bg-emerald-400',
    'Machine Learning': 'bg-fuchsia-400',
    'UI/UX Design': 'bg-pink-400',
    'Digital Marketing': 'bg-amber-400',
    'Cloud Computing': 'bg-cyan-400',
    'Cyber Security': 'bg-red-400',
    'DevOps': 'bg-orange-400',
    'Blockchain': 'bg-indigo-400',
    'Artificial Intelligence': 'bg-teal-400',
    'Business Analytics': 'bg-lime-400',
  };
  return map[category] || 'bg-primary-400';
};

const TrainerDiscussion = () => {
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState('');
  const [students, setStudents] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  const { isUserOnline, connected, socket } = useSocket();

  useEffect(() => { fetchInternships(); }, []);
  useEffect(() => {
    if (selectedInternship) {
      fetchStudents();
      fetchConversations();
    }
  }, [selectedInternship]);

  const fetchInternships = async () => {
    try {
      const { data } = await api.get('/discussions/trainer/internships');
      const list = data.data.internships || [];
      setInternships(list);
      if (list.length > 0) setSelectedInternship(list[0]._id);
    } catch (err) { console.error(err); }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/discussions/trainer/internship/${selectedInternship}/students`);
      setStudents(data.data.students || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/discussions/trainer/conversations', {
        params: { internshipId: selectedInternship },
      });
      setConversations(data.data.conversations || []);
    } catch (err) { console.error(err); }
  };

  const refreshAll = () => {
    if (selectedInternship) { fetchStudents(); fetchConversations(); }
  };

  // Live-update conversation previews when a message arrives
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = ({ message, conversationId }) => {
      setConversations(prev => prev.map(c => {
        if (c._id !== conversationId) return c;
        const updated = { ...c, lastMessage: message, lastMessageAt: message?.createdAt || new Date() };
        // Bump unread when the message is from the student and chat isn't open
        const senderRole = message?.sender?.role;
        if (conversationId !== selectedConversation?._id && senderRole !== 'trainer') {
          updated.unreadTrainer = (c.unreadTrainer || 0) + 1;
        }
        return updated;
      }));
    };
    socket.on('newMessage', handleNewMessage);
    return () => socket.off('newMessage', handleNewMessage);
  }, [socket, selectedConversation?._id]);

  const openChat = async (student) => {
    setSelectedStudent(student);
    setMobileView('chat');
    try {
      const { data } = await api.post('/discussions/conversation', {
        internshipId: student.currentInternship || selectedInternship,
        studentId: student._id,
      });
      setSelectedConversation(data.data.conversation);
      // Clear unread badge locally for the opened chat
      setConversations(prev => prev.map(c =>
        c._id === data.data.conversation?._id ? { ...c, unreadTrainer: 0 } : c
      ));
    } catch (err) { console.error(err); }
  };

  const getUnread = (studentId) => {
    const conv = conversations.find(c => c.student?._id === studentId);
    return conv?.unreadTrainer || 0;
  };

  const getLastMessage = (studentId) => {
    const conv = conversations.find(c => c.student?._id === studentId);
    return conv?.lastMessage;
  };

  const getLastMessageAt = (studentId) => {
    const conv = conversations.find(c => c.student?._id === studentId);
    return conv?.lastMessageAt || conv?.lastMessage?.createdAt;
  };

  const getPreview = (studentId) => {
    const lm = getLastMessage(studentId);
    if (!lm) return 'No messages yet';
    if (lm.deleted) return 'Message deleted';
    const prefix = lm.senderRole === 'trainer' ? 'You: ' : '';
    if (lm.messageType === 'IMAGE') return `${prefix}📷 Photo`;
    if (lm.messageType === 'DOCUMENT' || lm.messageType === 'PDF') return `${prefix}📎 ${lm.attachment?.originalName || 'File'}`;
    return `${prefix}${(lm.message || '').substring(0, 60)}`;
  };

  const getStudentName = (s) => {
    if (!s) return 'Unknown';
    return s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student';
  };

  const filteredStudents = students.filter(s => {
    if (!searchStudent) return true;
    const name = getStudentName(s).toLowerCase();
    const email = (s.email || '').toLowerCase();
    return name.includes(searchStudent.toLowerCase()) || email.includes(searchStudent.toLowerCase());
  });

  const selectedInternshipData = internships.find(i => i._id === selectedInternship);
  const onlineCount = students.filter(s => isUserOnline(s._id)).length;
  const totalUnread = students.reduce((sum, s) => sum + getUnread(s._id), 0);

  return (
    <div className="space-y-5">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-500 shadow-card-hover">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-secondary-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/25 shadow-lg">
              <FiMessageSquare size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white font-display leading-tight">Internship Discussion</h1>
              <p className="text-sm text-white/75 mt-0.5">Mentor and connect with your students in real time</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ring-1 ${connected ? 'bg-white/15 text-white ring-white/25' : 'bg-red-500/20 text-white ring-red-400/30'}`}>
              <span className="relative flex w-2 h-2">
                {connected && <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75 animate-ping" />}
                <span className={`relative inline-flex w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              </span>
              {connected ? 'Live' : 'Offline'}
            </div>
            <button onClick={refreshAll} className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm ring-1 ring-white/25 transition-all active:scale-95">
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* stat strip */}
        <div className="relative mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          {[
            { label: 'Programs', value: internships.length, icon: FiLayers },
            { label: 'Students', value: students.length, icon: FiUsers },
            { label: 'Online now', value: onlineCount, icon: FiActivity },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-3 sm:px-4 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <s.icon size={15} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white/70 text-[10px] sm:text-[11px] uppercase tracking-wide leading-none">{s.label}</p>
                <p className="text-white text-base sm:text-lg font-bold leading-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Program Selector ─── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiLayers size={16} className="text-primary-500" />
            <span className="text-sm font-semibold text-dark-700 dark:text-dark-200">Your Programs</span>
          </div>
          {selectedInternshipData && (
            <span className="text-xs text-dark-400 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${categoryDot(selectedInternshipData.category)}`} />
              {selectedInternshipData.category}
              <span className="text-dark-300 dark:text-dark-600">·</span>
              <span className="capitalize">{selectedInternshipData.status}</span>
            </span>
          )}
        </div>

        {internships.length === 0 ? (
          <p className="text-sm text-dark-400 py-2">No programs assigned yet. Students will appear here once they are assigned to you.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {internships.map((i) => {
              const active = selectedInternship === i._id;
              return (
                <button
                  key={i._id}
                  onClick={() => { setSelectedInternship(i._id); setSelectedConversation(null); setSelectedStudent(null); }}
                  className={`group flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                    active
                      ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white border-transparent shadow-md shadow-primary-500/30'
                      : 'bg-dark-50 dark:bg-dark-700/60 text-dark-600 dark:text-dark-300 border-dark-100 dark:border-dark-600 hover:border-primary-300 hover:text-primary-600 dark:hover:text-primary-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : categoryDot(i.category)}`} />
                  {i.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Workspace ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 360px)', minHeight: '520px' }}>
        {/* Student List */}
        <div className={`card overflow-hidden flex-col ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-dark-100 dark:border-dark-700 bg-gradient-to-b from-dark-50/60 to-transparent dark:from-dark-800/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-100 flex items-center gap-2">
                <FiUsers size={15} className="text-primary-500" /> Students
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{students.length}</span>
              </h3>
              {totalUnread > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">{totalUnread} new</span>
              )}
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={15} />
              <input
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-dark-50 dark:bg-dark-900/50 border border-dark-200 dark:border-dark-600 text-dark-800 dark:text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 transition-all"
                placeholder="Search student..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {[...Array(4)].map((_, k) => (
                  <div key={k} className="flex items-center gap-3 p-2 animate-pulse">
                    <div className="w-11 h-11 rounded-full bg-dark-200 dark:bg-dark-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 bg-dark-200 dark:bg-dark-700 rounded" />
                      <div className="h-2.5 w-1/2 bg-dark-100 dark:bg-dark-700/60 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="w-14 h-14 rounded-2xl bg-dark-100 dark:bg-dark-700 flex items-center justify-center mb-3">
                  <FiUsers size={24} className="text-dark-400" />
                </div>
                <p className="text-sm font-semibold text-dark-600 dark:text-dark-300">
                  {searchStudent ? 'No matching students' : 'No students yet'}
                </p>
                <p className="text-xs text-dark-400 mt-1 max-w-[220px]">
                  {searchStudent ? 'Try a different name or email.' : 'Students assigned to this program will show up here.'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredStudents.map(student => {
                  const online = isUserOnline(student._id);
                  const unread = getUnread(student._id);
                  const isActive = selectedStudent?._id === student._id;

                  return (
                    <button
                      key={student._id}
                      onClick={() => openChat(student)}
                      className={`group relative w-full text-left rounded-xl p-2.5 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/30 dark:to-primary-900/10 ring-1 ring-primary-200 dark:ring-primary-800/60'
                          : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
                      }`}
                    >
                      {/* active accent bar */}
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary-500 to-indigo-500 transition-all ${isActive ? 'h-8' : 'h-0'}`} />

                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all ${
                            isActive
                              ? 'bg-gradient-to-br from-primary-600 to-indigo-500 text-white ring-2 ring-white dark:ring-dark-700'
                              : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-200'
                          }`}>
                            {getStudentName(student)[0]}
                          </div>
                          {online && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex w-3.5 h-3.5">
                              <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75 animate-ping" />
                              <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-dark-800" />
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-dark-800 dark:text-dark-100'}`}>
                              {getStudentName(student)}
                            </p>
                            <span className="text-[10px] text-dark-400 flex-shrink-0">{timeAgo(getLastMessageAt(student._id))}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className={`text-xs truncate ${unread > 0 ? 'text-dark-700 dark:text-dark-200 font-medium' : 'text-dark-400'}`}>
                              {getPreview(student._id)}
                            </p>
                            {unread > 0 && (
                              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 grid place-items-center bg-gradient-to-br from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">{unread}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            {online ? (
                              <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Online</span>
                            ) : (
                              <span className="text-[10px] text-dark-400 truncate">{student.collegeName || student.email}</span>
                            )}
                          </div>
                        </div>

                        <FiArrowRight size={15} className={`flex-shrink-0 transition-all ${isActive ? 'text-primary-500 opacity-100' : 'text-dark-300 dark:text-dark-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`lg:col-span-2 min-h-0 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          {selectedConversation && selectedStudent ? (
            <ChatPanel
              conversation={selectedConversation}
              otherUser={selectedStudent}
              otherUserOnline={isUserOnline(selectedStudent._id)}
              onBack={() => setMobileView('list')}
            />
          ) : (
            <div className="h-full rounded-2xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-card overflow-hidden relative flex items-center justify-center">
              <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-100/60 dark:bg-primary-900/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-secondary-100/60 dark:bg-secondary-900/10 blur-3xl" />

              <div className="relative text-center px-8 py-10 max-w-sm">
                <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-5">
                  <FiMessageSquare size={34} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-dark-800 dark:text-white font-display">
                  {selectedInternshipData ? `Discuss ${selectedInternshipData.title}` : 'Start a conversation'}
                </h3>
                <p className="text-sm text-dark-500 dark:text-dark-400 mt-1.5 leading-relaxed">
                  Pick a student on the left to open your chat. Share files, pin important updates and guide your interns in real time.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-50 dark:bg-dark-700/60 text-dark-500 dark:text-dark-300 text-xs font-medium border border-dark-100 dark:border-dark-600">
                  <FiSmile size={14} className="text-primary-500" />
                  {students.length} student{students.length === 1 ? '' : 's'} in this program
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainerDiscussion;
