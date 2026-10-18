import { useState, useEffect, useMemo } from 'react';
import {
  FiRefreshCw, FiMessageSquare, FiSearch, FiUsers, FiActivity, FiArrowRight, FiTag,
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

const StudentDiscussion = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  const { isUserOnline, connected, socket } = useSocket();

  useEffect(() => { fetchConversations(); }, []);

  // Live-update conversation previews when a message arrives
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = ({ message, conversationId }) => {
      setConversations(prev => prev.map(c => {
        if (c._id !== conversationId) return c;
        const updated = { ...c, lastMessage: message, lastMessageAt: message?.createdAt || new Date() };
        // Bump unread when the message is from the trainer and chat isn't open
        const senderRole = message?.sender?.role;
        if (conversationId !== selectedConversation?._id && senderRole !== 'student') {
          updated.unreadStudent = (c.unreadStudent || 0) + 1;
        }
        return updated;
      }).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)));
    };
    socket.on('newMessage', handleNewMessage);
    return () => socket.off('newMessage', handleNewMessage);
  }, [socket, selectedConversation?._id]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/discussions/student/conversations');
      const convs = data.data.conversations || [];
      setConversations(convs);
      // Auto-select first conversation
      if (convs.length > 0 && !selectedConversation) {
        setSelectedConversation(convs[0]);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getTrainerName = (conv) => {
    const t = conv.trainer;
    if (!t) return 'Trainer';
    return t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Trainer';
  };

  const getTrainerInitial = (conv) => {
    const name = getTrainerName(conv);
    return name[0] || 'T';
  };

  const getLastMessagePreview = (conv) => {
    const lm = conv.lastMessage;
    if (!lm) return 'No messages yet';
    if (lm.deleted) return 'Message deleted';
    const prefix = lm.senderRole === 'student' ? 'You: ' : '';
    if (lm.messageType === 'IMAGE') return `${prefix}📷 Photo`;
    if (lm.messageType === 'DOCUMENT' || lm.messageType === 'PDF') return `${prefix}📎 ${lm.attachment?.originalName || 'File'}`;
    return `${prefix}${(lm.message || '').substring(0, 60)}`;
  };

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      getTrainerName(c).toLowerCase().includes(q) ||
      (c.internship?.title || '').toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const selectConversation = (conv) => {
    setSelectedConversation(conv);
    setMobileView('chat');
    // Clear unread indicator locally
    setConversations(prev => prev.map(c => c._id === conv._id ? { ...c, unreadStudent: 0 } : c));
  };

  const selectedTrainer = selectedConversation?.trainer;
  const trainerOnline = selectedConversation ? isUserOnline(selectedTrainer?._id) : false;
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadStudent || 0), 0);
  const onlineCount = conversations.filter(c => isUserOnline(c.trainer?._id)).length;

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
              <FiMessageSquare size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white font-display leading-tight">Discussion</h1>
              <p className="text-sm text-white/75 mt-0.5">Chat with your assigned trainer in real time</p>
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
        <div className="relative mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
          {[
            { label: 'Chats', value: conversations.length, icon: FiMessageSquare },
            { label: 'Trainers online', value: onlineCount, icon: FiActivity },
            { label: 'Unread', value: totalUnread, icon: FiUsers },
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
      {loading ? (
        <div className="card p-6 flex items-center justify-center" style={{ minHeight: '300px' }}>
          <FiRefreshCw size={24} className="animate-spin text-primary-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="relative overflow-hidden card p-12 text-center">
          <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary-100/60 dark:bg-primary-900/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-5">
              <FiMessageSquare size={34} className="text-white" />
            </div>
            <p className="text-lg font-bold text-dark-800 dark:text-white font-display">No discussions yet</p>
            <p className="text-sm text-dark-500 dark:text-dark-400 mt-1.5 max-w-md mx-auto">Your trainer will start a discussion once you're assigned to an internship.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 320px)', minHeight: '520px' }}>
          {/* Conversation List */}
          <div className={`card overflow-hidden flex-col ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-4 border-b border-dark-100 dark:border-dark-700 bg-gradient-to-b from-dark-50/60 to-transparent dark:from-dark-800/40">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-100 flex items-center gap-2">
                  <FiMessageSquare size={15} className="text-primary-500" /> Chats
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{conversations.length}</span>
                </h3>
                {totalUnread > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">{totalUnread} new</span>
                )}
              </div>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={15} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-dark-50 dark:bg-dark-900/50 border border-dark-200 dark:border-dark-600 text-dark-800 dark:text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 transition-all"
                  placeholder="Search chats..."
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                  <div className="w-14 h-14 rounded-2xl bg-dark-100 dark:bg-dark-700 flex items-center justify-center mb-3">
                    <FiSearch size={24} className="text-dark-400" />
                  </div>
                  <p className="text-sm font-semibold text-dark-600 dark:text-dark-300">No chats match your search</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredConversations.map(conv => {
                    const isActive = selectedConversation?._id === conv._id;
                    const online = isUserOnline(conv.trainer?._id);
                    const unread = conv.unreadStudent || 0;

                    return (
                      <button
                        key={conv._id}
                        onClick={() => selectConversation(conv)}
                        className={`group relative w-full text-left rounded-xl p-2.5 transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/30 dark:to-primary-900/10 ring-1 ring-primary-200 dark:ring-primary-800/60'
                            : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
                        }`}
                      >
                        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary-500 to-indigo-500 transition-all ${isActive ? 'h-8' : 'h-0'}`} />

                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all ${
                              isActive
                                ? 'bg-gradient-to-br from-primary-600 to-indigo-500 text-white ring-2 ring-white dark:ring-dark-700'
                                : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-200'
                            }`}>
                              {getTrainerInitial(conv)}
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
                                {getTrainerName(conv)}
                              </p>
                              <span className="text-[10px] text-dark-400 flex-shrink-0">{timeAgo(conv.lastMessageAt || conv.lastMessage?.createdAt)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className={`text-xs truncate ${unread > 0 ? 'text-dark-700 dark:text-dark-200 font-medium' : 'text-dark-400'}`}>
                                {getLastMessagePreview(conv)}
                              </p>
                              {unread > 0 && (
                                <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 grid place-items-center bg-gradient-to-br from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full shadow-sm">{unread}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <FiTag size={10} className="text-dark-300 dark:text-dark-500 flex-shrink-0" />
                              <p className="text-[10px] text-dark-400 truncate">{conv.internship?.title || 'Internship'}</p>
                              {online && <span className="text-[10px] font-medium text-green-600 dark:text-green-400 ml-auto">Online</span>}
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
            {selectedConversation ? (
              <ChatPanel
                conversation={selectedConversation}
                otherUser={selectedTrainer}
                otherUserOnline={trainerOnline}
                onBack={() => setMobileView('list')}
              />
            ) : (
              <EmptyChatHero internshipTitle={conversations[0]?.internship?.title} count={conversations.length} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyChatHero = ({ internshipTitle, count }) => (
  <div className="h-full rounded-2xl border border-dark-100 dark:border-dark-700 bg-white dark:bg-dark-800 shadow-card overflow-hidden relative flex items-center justify-center">
    <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-100/60 dark:bg-primary-900/20 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-20 -left-16 w-64 h-64 rounded-full bg-secondary-100/60 dark:bg-secondary-900/10 blur-3xl" />
    <div className="relative text-center px-8 py-10 max-w-sm">
      <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-primary-500/30 mb-5">
        <FiMessageSquare size={34} className="text-white" />
      </div>
      <h3 className="text-lg font-bold text-dark-800 dark:text-white font-display">
        {internshipTitle ? `Discuss ${internshipTitle}` : 'Start a conversation'}
      </h3>
      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1.5 leading-relaxed">
        Pick a chat on the left to open your conversation. Share files and stay in touch with your trainer.
      </p>
      <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-50 dark:bg-dark-700/60 text-dark-500 dark:text-dark-300 text-xs font-medium border border-dark-100 dark:border-dark-600">
        <FiUsers size={14} className="text-primary-500" />
        {count} conversation{count === 1 ? '' : 's'}
      </div>
    </div>
  </div>
);

export default StudentDiscussion;
