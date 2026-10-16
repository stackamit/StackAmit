import { useState, useEffect } from 'react';
import {
  FiSearch, FiRefreshCw, FiChevronDown, FiUsers, FiMessageSquare,
  FiCircle,
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
        internshipId: selectedInternship,
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

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Internship Discussion</h1>
          <p className="page-subtitle">Communicate with your students</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-dark-400">{connected ? 'Live' : 'Offline'}</span>
          <button onClick={() => { fetchStudents(); fetchConversations(); }} className="btn-outline flex items-center gap-2 text-sm ml-2">
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Internship Selector */}
      <div className="card p-4 mb-4">
        <label className="label text-sm font-medium mb-2">Select Internship</label>
        <div className="relative">
          <select
            value={selectedInternship}
            onChange={e => { setSelectedInternship(e.target.value); setSelectedConversation(null); setSelectedStudent(null); }}
            className="input-field py-2.5 w-full appearance-none pr-10"
          >
            {internships.map(i => (
              <option key={i._id} value={i._id}>{i.title}</option>
            ))}
          </select>
          <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
        </div>
        {selectedInternshipData && (
          <div className="flex items-center gap-3 mt-2 text-xs text-dark-400">
            <span className="px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">{selectedInternshipData.category}</span>
            <span>{selectedInternshipData.status}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}>
        {/* Student List */}
        <div className={`card overflow-hidden flex-col ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 border-b border-dark-200 dark:border-dark-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-200 flex items-center gap-2">
                <FiUsers size={14} /> Students
                <span className="text-xs text-dark-400 font-normal">({students.length})</span>
              </h3>
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={14} />
              <input
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
                className="input-field pl-8 py-1.5 text-sm w-full"
                placeholder="Search student..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8"><FiRefreshCw size={18} className="animate-spin text-primary-500" /></div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-6 text-center text-dark-400 text-sm">No students found</div>
            ) : (
              filteredStudents.map(student => {
                const online = isUserOnline(student._id);
                const unread = getUnread(student._id);
                const isActive = selectedStudent?._id === student._id;

                return (
                  <button
                    key={student._id}
                    onClick={() => openChat(student)}
                    className={`w-full text-left px-4 py-3 border-b border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? 'bg-primary-500 text-white' : 'bg-dark-200 dark:bg-dark-600 text-dark-600 dark:text-dark-300'}`}>
                          {getStudentName(student)[0]}
                        </div>
                        {online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-dark-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-dark-800 dark:text-dark-200'}`}>
                            {getStudentName(student)}
                          </p>
                          <span className="text-[10px] text-dark-400 flex-shrink-0 ml-2">{timeAgo(getLastMessageAt(student._id))}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate ${unread > 0 ? 'text-dark-700 dark:text-dark-200 font-medium' : 'text-dark-400'}`}>
                            {getPreview(student._id)}
                          </p>
                          {unread > 0 && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 min-w-[20px] text-center bg-primary-500 text-white text-[10px] font-bold rounded-full">{unread}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-dark-400 truncate">{student.collegeName || student.email}{online ? ' · Online' : ''}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`lg:col-span-2 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
          {selectedConversation && selectedStudent ? (
            <ChatPanel
              conversation={selectedConversation}
              otherUser={selectedStudent}
              otherUserOnline={isUserOnline(selectedStudent._id)}
              onBack={() => setMobileView('list')}
            />
          ) : (
            <div className="h-full flex items-center justify-center card">
              <div className="text-center text-dark-400">
                <FiMessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a student to start chatting</p>
                <p className="text-sm mt-1">Choose an internship and click on a student</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainerDiscussion;
