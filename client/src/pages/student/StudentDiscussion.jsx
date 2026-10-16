import { useState, useEffect, useMemo } from 'react';
import {
  FiRefreshCw, FiMessageSquare, FiSearch, FiChevronDown,
} from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import ChatPanel from '../../components/ChatPanel';

// Compact relative time (WhatsApp style list timestamp)
const timeAgo = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
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

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Discussion</h1>
          <p className="page-subtitle">Chat with your assigned trainer</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-dark-400">{connected ? 'Live' : 'Offline'}</span>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">{totalUnread} new</span>
          )}
          <button onClick={fetchConversations} className="btn-outline flex items-center gap-2 text-sm ml-2">
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <FiRefreshCw size={24} className="animate-spin text-primary-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="card p-12 text-center text-dark-400">
          <FiMessageSquare size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No discussions yet</p>
          <p className="text-sm mt-1">Your trainer will start a discussion once you're assigned to an internship.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 250px)', minHeight: '500px' }}>
          {/* Conversation List */}
          <div className={`card overflow-hidden flex flex-col ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-3 border-b border-dark-200 dark:border-dark-700 space-y-2">
              <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-200 flex items-center gap-2">
                <FiMessageSquare size={14} /> Chats
                <span className="text-xs text-dark-400 font-normal">({conversations.length})</span>
              </h3>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={14} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-8 py-1.5 text-sm w-full rounded-full"
                  placeholder="Search chats..."
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <p className="p-6 text-center text-sm text-dark-400">No chats match your search</p>
              ) : filteredConversations.map(conv => {
                const isActive = selectedConversation?._id === conv._id;
                const online = isUserOnline(conv.trainer?._id);
                const unread = conv.unreadStudent || 0;

                return (
                  <button
                    key={conv._id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-left px-3 py-3 border-b border-dark-100 dark:border-dark-700/60 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isActive ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-md' : 'bg-dark-200 dark:bg-dark-600 text-dark-600 dark:text-dark-300'}`}>
                          {getTrainerInitial(conv)}
                        </div>
                        {online && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-dark-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-medium truncate ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-dark-800 dark:text-dark-200'}`}>
                            {getTrainerName(conv)}
                          </p>
                          <span className="text-[10px] text-dark-400 flex-shrink-0">{timeAgo(conv.lastMessageAt || conv.lastMessage?.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate ${unread > 0 ? 'text-dark-700 dark:text-dark-200 font-medium' : 'text-dark-400'}`}>
                            {getLastMessagePreview(conv)}
                          </p>
                          {unread > 0 && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 min-w-[20px] text-center bg-primary-500 text-white text-[10px] font-bold rounded-full">{unread}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <FiChevronDown size={10} className="text-dark-300 dark:text-dark-500 rotate-[-60deg]" />
                          <p className="text-[10px] text-dark-400 truncate">{conv.internship?.title || 'Internship'}</p>
                          {online && <span className="text-[10px] text-green-500 ml-auto">Online</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`lg:col-span-2 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
            {selectedConversation ? (
              <ChatPanel
                conversation={selectedConversation}
                otherUser={selectedTrainer}
                otherUserOnline={trainerOnline}
                onBack={() => setMobileView('list')}
              />
            ) : (
              <div className="h-full flex items-center justify-center card">
                <div className="text-center text-dark-400">
                  <FiMessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDiscussion;
