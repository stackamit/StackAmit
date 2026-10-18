import { useState, useEffect, useMemo } from 'react';
import {
  FiRefreshCw, FiSearch, FiMessageSquare, FiUsers, FiEye, FiActivity, FiInbox,
  FiLock, FiUnlock, FiVolumeX, FiArrowRight, FiTag,
} from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../../context/SocketContext';
import ChatPanel from '../../components/ChatPanel';

const AdminDiscussion = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { isUserOnline, connected } = useSocket();

  useEffect(() => { fetchConversations(); }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/discussions/admin/conversations');
      setConversations(data.data.conversations || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleToggleClose = async (convId) => {
    try {
      await api.patch(`/discussions/${convId}/close`);
      fetchConversations();
      if (selectedConversation?._id === convId) {
        setSelectedConversation(prev => ({ ...prev, isClosed: !prev.isClosed }));
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleToggleMute = async (convId, userId) => {
    try {
      await api.patch(`/discussions/${convId}/mute`, { userId });
      fetchConversations();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const getName = (user) => {
    if (!user) return 'Unknown';
    return user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  };

  const getPreview = (conv) => {
    const lm = conv.lastMessage;
    if (!lm) return 'No messages yet';
    if (lm.deleted) return 'Message deleted';
    if (lm.messageType === 'IMAGE') return '📷 Photo';
    if (lm.messageType === 'DOCUMENT' || lm.messageType === 'PDF') return `📎 ${lm.attachment?.originalName || 'File'}`;
    return (lm.message || '').substring(0, 60);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const term = search.toLowerCase();
    return conversations.filter(c => {
      const studentName = getName(c.student).toLowerCase();
      const trainerName = getName(c.trainer).toLowerCase();
      const internshipTitle = (c.internship?.title || '').toLowerCase();
      return studentName.includes(term) || trainerName.includes(term) || internshipTitle.includes(term);
    });
  }, [conversations, search]);

  const selectedStudent = selectedConversation?.student;
  const selectedTrainer = selectedConversation?.trainer;

  // For admin, show the "other person" in chat header
  const chatOtherUser = selectedConversation ? {
    name: `${getName(selectedStudent)} & ${getName(selectedTrainer)}`,
    _id: selectedConversation._id,
  } : null;

  const activeCount = conversations.filter(c => !c.isClosed).length;
  const closedCount = conversations.filter(c => c.isClosed).length;
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadTrainer || 0) + (c.unreadStudent || 0), 0);

  return (
    <div className="space-y-5">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-500 shadow-card-hover">
        <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-secondary-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/25 shadow-lg">
              <FiEye size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white font-display leading-tight">Discussion Monitoring</h1>
              <p className="text-sm text-white/75 mt-0.5">Oversee and manage every internship conversation</p>
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
            <button onClick={fetchConversations} className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm ring-1 ring-white/25 transition-all active:scale-95">
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* stat strip */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            { label: 'Total Chats', value: conversations.length, icon: FiMessageSquare },
            { label: 'Active', value: activeCount, icon: FiActivity },
            { label: 'Closed', value: closedCount, icon: FiLock },
            { label: 'Unread', value: unreadCount, icon: FiInbox },
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

      {/* ─── Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 320px)', minHeight: '520px' }}>
        {/* Conversation List */}
        <div className="card overflow-hidden flex-col">
          <div className="p-4 border-b border-dark-100 dark:border-dark-700 bg-gradient-to-b from-dark-50/60 to-transparent dark:from-dark-800/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-100 flex items-center gap-2">
                <FiMessageSquare size={15} className="text-primary-500" /> All Conversations
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{filtered.length}</span>
              </h3>
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={15} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-dark-50 dark:bg-dark-900/50 border border-dark-200 dark:border-dark-600 text-dark-800 dark:text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 transition-all"
                placeholder="Search student, trainer, internship..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-2 space-y-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl">
                    <div className="flex -space-x-2">
                      <div className="w-9 h-9 rounded-full bg-dark-100 dark:bg-dark-700 animate-pulse" />
                      <div className="w-9 h-9 rounded-full bg-dark-100 dark:bg-dark-700 animate-pulse" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-dark-100 dark:bg-dark-700 animate-pulse" />
                      <div className="h-2.5 w-1/2 rounded bg-dark-100 dark:bg-dark-700 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="w-14 h-14 rounded-2xl bg-dark-100 dark:bg-dark-700 flex items-center justify-center mb-3">
                  <FiSearch size={24} className="text-dark-400" />
                </div>
                <p className="text-sm font-semibold text-dark-600 dark:text-dark-300">No conversations found</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filtered.map(conv => {
                  const isActive = selectedConversation?._id === conv._id;
                  const studentName = getName(conv.student);
                  const trainerName = getName(conv.trainer);
                  const unread = (conv.unreadTrainer || 0) + (conv.unreadStudent || 0);

                  return (
                    <button
                      key={conv._id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`group relative w-full text-left rounded-xl p-2.5 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/30 dark:to-primary-900/10 ring-1 ring-primary-200 dark:ring-primary-800/60'
                          : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
                      } ${conv.isClosed ? 'opacity-70' : ''}`}
                    >
                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary-500 to-indigo-500 transition-all ${isActive ? 'h-8' : 'h-0'}`} />

                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2 flex-shrink-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold border-2 border-white dark:border-dark-800 shadow-sm" title={studentName}>
                            {studentName[0] || 'S'}
                          </div>
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center text-xs font-bold border-2 border-white dark:border-dark-800 shadow-sm" title={trainerName}>
                            {trainerName[0] || 'T'}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">{studentName}</span>
                              <span className="text-dark-400 text-xs flex-shrink-0">↔</span>
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400 truncate">{trainerName}</span>
                            </div>
                            {unread > 0 && (
                              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 grid place-items-center bg-gradient-to-br from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">{unread}</span>
                            )}
                          </div>
                          <p className="text-xs text-dark-500 dark:text-dark-400 truncate mt-0.5">{getPreview(conv)}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <FiTag size={10} className="text-dark-300 dark:text-dark-500 flex-shrink-0" />
                            <p className="text-[10px] text-dark-400 truncate">{conv.internship?.title || 'No internship'}</p>
                            {conv.isClosed && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 ml-auto flex-shrink-0">Closed</span>}
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

        {/* Chat / Details Area */}
        <div className="lg:col-span-2 min-h-0 flex flex-col gap-4">
          {selectedConversation ? (
            <>
              {/* Admin controls */}
              <div className="card p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Student details */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Student</p>
                        <p className="text-sm font-medium text-dark-900 dark:text-white">{getName(selectedConversation.student)}</p>
                        <p className="text-xs text-dark-500 mt-0.5">{selectedConversation.student?.email || ''}</p>
                        {selectedConversation.student?.collegeName && <p className="text-xs text-dark-400 mt-0.5">{selectedConversation.student.collegeName}</p>}
                        {selectedConversation.student?.course && <p className="text-xs text-dark-400">{selectedConversation.student.course}</p>}
                      </div>
                      {/* Trainer details */}
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Trainer</p>
                        <p className="text-sm font-medium text-dark-900 dark:text-white">{getName(selectedConversation.trainer)}</p>
                        <p className="text-xs text-dark-500 mt-0.5">{selectedConversation.trainer?.email || ''}</p>
                      </div>
                    </div>
                    <p className="text-xs text-dark-400 mt-2">Internship: <span className="font-medium text-dark-600 dark:text-dark-300">{selectedConversation.internship?.title || 'N/A'}</span></p>
                  </div>
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleClose(selectedConversation._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedConversation.isClosed
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200'
                      }`}
                    >
                      {selectedConversation.isClosed ? <FiUnlock size={12} /> : <FiLock size={12} />}
                      {selectedConversation.isClosed ? 'Reopen' : 'Close'}
                    </button>
                    <button
                      onClick={() => handleToggleMute(selectedConversation._id, selectedConversation.student?._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 transition-colors"
                    >
                      <FiVolumeX size={12} /> Mute Student
                    </button>
                    <button
                      onClick={() => handleToggleMute(selectedConversation._id, selectedConversation.trainer?._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 transition-colors"
                    >
                      <FiVolumeX size={12} /> Mute Trainer
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="flex-1 min-h-0">
                <ChatPanel
                  conversation={selectedConversation}
                  otherUser={chatOtherUser}
                  otherUserOnline={false}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 rounded-2xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-card overflow-hidden relative flex items-center justify-center">
              <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-100/60 dark:bg-primary-900/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-secondary-100/60 dark:bg-secondary-900/10 blur-3xl" />
              <div className="relative text-center px-8 py-10 max-w-sm">
                <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-5">
                  <FiEye size={34} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-dark-800 dark:text-white font-display">Select a conversation to monitor</h3>
                <p className="text-sm text-dark-500 dark:text-dark-400 mt-1.5 leading-relaxed">Click on any conversation to view messages and manage it.</p>
                <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-50 dark:bg-dark-700/60 text-dark-500 dark:text-dark-300 text-xs font-medium border border-dark-100 dark:border-dark-600">
                  <FiUsers size={14} className="text-primary-500" />
                  {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDiscussion;
