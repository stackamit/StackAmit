import { useState, useEffect, useRef } from 'react';
import {
  FiSend, FiPaperclip, FiSmile, FiSearch, FiBookmark, FiMoreVertical,
  FiEdit2, FiTrash2, FiStar, FiClipboard, FiArrowDownLeft, FiX,
  FiCheck, FiFile, FiRefreshCw, FiAlertCircle, FiArrowLeft, FiChevronDown,
} from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// Subtle doodle pattern for the chat background (WhatsApp style)
const CHAT_BG_STYLE = {
  backgroundImage: `radial-gradient(circle at 25% 15%, rgba(17,153,142,0.05) 0, transparent 45%),
    radial-gradient(circle at 75% 85%, rgba(56,239,125,0.05) 0, transparent 45%),
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2398a8b8' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
};

// Double checkmark (read receipt) built from two overlapping checks
const DoubleCheck = ({ className = '' }) => (
  <span className={`relative inline-flex items-center ${className}`} style={{ width: 16 }}>
    <FiCheck size={12} className="absolute left-0" />
    <FiCheck size={12} className="absolute" style={{ left: 5 }} />
  </span>
);

const ChatPanel = ({ conversation, otherUser, otherUserOnline, onBack }) => {
  const { user } = useAuth();
  const {
    sendMessage, sendTyping, sendStopTyping,
    editMessage, deleteMessage: socketDeleteMessage,
    togglePin, toggleImportant, joinConversation,
    leaveConversation, typingUsers, socket,
  } = useSocket();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showActions, setShowActions] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [sendError, setSendError] = useState('');
  const [showScrollFAB, setShowScrollFAB] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load messages
  useEffect(() => {
    if (!conversation?._id) return;
    fetchMessages();
    joinConversation(conversation._id);
    return () => leaveConversation(conversation._id);
  }, [conversation?._id]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ message, conversationId }) => {
      if (conversationId === conversation?._id) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    };

    const handleMessageEdited = ({ messageId, newMessage, editedAt }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, message: newMessage, edited: true, editedAt } : m
      ));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, deleted: true, message: '[Message deleted]' } : m
      ));
    };

    const handleMessagePinned = ({ messageId, isPinned }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isPinned } : m
      ));
    };

    const handleMessageImportant = ({ messageId, isImportant }) => {
      setMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, isImportant } : m
      ));
    };

    const handleMessagesRead = ({ conversationId }) => {
      if (conversationId === conversation?._id) {
        setMessages(prev => prev.map(m => ({
          ...m,
          readBy: String(m.sender?._id) === String(user._id) ? m.readBy : [...(m.readBy || []), { user: user._id }],
        })));
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('messagePinned', handleMessagePinned);
    socket.on('messageImportant', handleMessageImportant);
    socket.on('messagesRead', handleMessagesRead);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageEdited', handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('messagePinned', handleMessagePinned);
      socket.off('messageImportant', handleMessageImportant);
      socket.off('messagesRead', handleMessagesRead);
    };
  }, [socket, conversation?._id, user._id]);

  // Auto-scroll to bottom on conversation switch; keep position for new messages when near bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, conversation?._id]);

  // Auto-grow textarea (WhatsApp behaviour)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [newMessage]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollFAB(el.scrollHeight - el.scrollTop - el.clientHeight > 320);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get(`/discussions/${conversation._id}/messages`, { params });
      const msgs = data.data.messages || [];
      setMessages(msgs);
    } catch (err) {
      console.error('[ChatPanel] fetchMessages error:', err.response?.data || err.message);
    }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversation?._id) return;
    setSending(true);
    setSendError('');
    try {
      // Send via REST API for guaranteed delivery
      const { data } = await api.post(`/discussions/${conversation._id}/messages`, {
        message: newMessage.trim(),
        messageType: 'TEXT',
        replyTo: replyTo?._id || undefined,
      });

      // Add message to local state immediately (from REST response)
      if (data?.data?.message) {
        setMessages(prev => {
          if (prev.some(m => m._id === data.data.message._id)) return prev;
          return [...prev, data.data.message];
        });
      }

      setNewMessage('');
      setReplyTo(null);
      sendStopTyping(conversation._id);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to send message';
      setSendError(errMsg);
      toast.error(`Send failed: ${errMsg}`);

      // Fallback: try via socket
      try {
        sendMessage({
          conversationId: conversation._id,
          message: newMessage.trim(),
          messageType: 'TEXT',
          replyTo: replyTo?._id,
        });
        setNewMessage('');
        setReplyTo(null);
        setSendError('');
      } catch (socketErr) {
        console.error('[ChatPanel] Socket fallback also failed:', socketErr);
      }
    } finally {
      setSending(false);
      // Refetch to ensure sync
      setTimeout(() => fetchMessages(), 300);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Typing indicator
    if (newMessage.length > 0) {
      sendTyping(conversation._id);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendStopTyping(conversation._id);
      }, 2000);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error('File too large (max 100MB)'); return; }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileData = data.data?.file || data.data;

      // Send file message via REST API
      const { data: msgData } = await api.post(`/discussions/${conversation._id}/messages`, {
        message: fileData.originalName || file.name,
        messageType: file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT',
        attachment: { url: fileData.url, originalName: file.name, size: file.size, mimeType: file.type },
      });

      // Add to local state
      if (msgData?.data?.message) {
        setMessages(prev => {
          if (prev.some(m => m._id === msgData.data.message._id)) return prev;
          return [...prev, msgData.data.message];
        });
      }

      // Refetch to ensure sync
      setTimeout(() => fetchMessages(), 500);
    } catch (err) { console.error('File upload error:', err); }
    e.target.value = '';
  };

  const handleEdit = (msg) => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (new Date(msg.createdAt) < tenMinAgo) {
      toast('Can only edit messages within 10 minutes', { icon: '⏱️' });
      return;
    }
    setEditingMsg(msg._id);
    setEditText(msg.message);
    setShowActions(null);
  };

  const submitEdit = () => {
    if (editText.trim()) {
      editMessage(editingMsg, editText.trim());
    }
    setEditingMsg(null);
    setEditText('');
  };

  const handleDelete = (msgId) => {
    socketDeleteMessage(msgId);
    setShowActions(null);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Message copied');
    setShowActions(null);
  };

  const fetchPinned = async () => {
    try {
      const { data } = await api.get(`/discussions/${conversation._id}/pinned`);
      setPinnedMessages(data.data.messages || []);
      setShowPinned(!showPinned);
    } catch (err) { console.error(err); }
  };

  // ─── Formatting helpers ───
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formatDateLabel = (d) => {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };
  const isMyMessage = (msg) => {
    if (!msg.sender?._id || !user._id) return false;
    return String(msg.sender._id) === String(user._id);
  };
  const getSenderName = (msg) => {
    if (!msg.sender) return 'Unknown';
    return msg.sender.name || `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || 'User';
  };

  // Read receipt: is the other participant in readBy?
  const isReadByOther = (msg) => {
    const otherId = String(otherUser?._id || '');
    if (!otherId) return false;
    return (msg.readBy || []).some(r => String(r?.user || r) === otherId);
  };

  // Get role badge color for sender
  const getRoleBadge = (msg) => {
    const role = msg.sender?.role || msg.senderRole;
    if (role === 'trainer') return { label: 'Trainer', color: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' };
    if (role === 'student') return { label: 'Student', color: 'text-blue-600 dark:text-blue-400', chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-400' };
    if (role === 'admin') return { label: 'Admin', color: 'text-purple-600 dark:text-purple-400', chip: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' };
    return { label: '', color: '', chip: '' };
  };

  const typingUser = typingUsers[conversation?._id];

  // Group messages by date + collapse consecutive messages from the same sender
  const flatItems = [];
  let lastDate = '';
  messages.forEach((msg, i) => {
    const date = new Date(msg.createdAt).toDateString();
    if (date !== lastDate) {
      flatItems.push({ type: 'date', date: msg.createdAt, key: `date-${date}` });
      lastDate = date;
    }
    const prev = messages[i - 1];
    const sameSenderAsPrev = prev
      && !prev.deleted
      && String(prev.sender?._id || '') === String(msg.sender?._id || '')
      && (new Date(msg.createdAt) - new Date(prev.createdAt)) < 2 * 60 * 1000;
    flatItems.push({ type: 'message', ...msg, key: msg._id, grouped: sameSenderAsPrev });
  });

  const otherName = otherUser?.name || `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`.trim() || 'User';
  const otherInitial = otherName[0] || '?';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-800 rounded-2xl overflow-hidden border border-dark-200 dark:border-dark-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 text-white shadow-md z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button onClick={onBack} className="lg:hidden p-1.5 -ml-1 hover:bg-white/10 rounded-lg transition-colors" title="Back">
              <FiArrowLeft size={18} />
            </button>
          )}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-lg ring-2 ring-white/30">
              {otherInitial}
            </div>
            {otherUserOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-600 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{otherName}</h3>
            <p className="text-xs text-white/75 truncate">
              {typingUser ? (
                <span className="text-green-300 font-medium">typing…</span>
              ) : otherUserOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }} className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-white/20' : 'hover:bg-white/10'}`} title="Search messages">
            <FiSearch size={16} />
          </button>
          <button onClick={fetchPinned} className={`p-2 rounded-lg transition-colors ${showPinned ? 'bg-white/20' : 'hover:bg-white/10'}`} title="Pinned messages">
            <FiBookmark size={16} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700 flex items-center gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={14} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchMessages()}
              className="input-field pl-8 py-1.5 text-sm w-full rounded-full"
              placeholder="Search in this conversation..."
              autoFocus
            />
          </div>
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); fetchMessages(); }} className="p-1.5 text-dark-400 hover:text-dark-600 rounded-full hover:bg-dark-100 dark:hover:bg-dark-700">
            <FiX size={16} />
          </button>
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinned && (
        <div className="px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 max-h-36 overflow-y-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
              <FiBookmark size={12} /> Pinned Messages
            </span>
            <button onClick={() => setShowPinned(false)} className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30"><FiX size={14} className="text-yellow-600" /></button>
          </div>
          {pinnedMessages.length === 0 ? (
            <p className="text-xs text-yellow-600 dark:text-yellow-500 py-1">No pinned messages</p>
          ) : (
            pinnedMessages.map(m => (
              <div key={m._id} className="py-1 border-b border-yellow-100 dark:border-yellow-800/50 last:border-0">
                <span className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">{getSenderName(m)}</span>
                <p className="text-xs text-yellow-800 dark:text-yellow-300 truncate">{m.message}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="relative flex-1 overflow-y-auto px-3 sm:px-5 py-4 bg-[#e9e4dc] dark:bg-dark-900"
        style={CHAT_BG_STYLE}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10"><FiRefreshCw size={22} className="animate-spin text-primary-500" /></div>
        ) : flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-400 gap-3">
            <div className="w-16 h-16 rounded-full bg-white dark:bg-dark-700 flex items-center justify-center shadow-sm">
              <FiSmile size={30} className="text-primary-400" />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs">Say hello and start the conversation 👋</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {flatItems.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-white/80 dark:bg-dark-700/90 backdrop-blur-sm text-dark-500 dark:text-dark-300 rounded-full text-[11px] font-medium shadow-sm">
                      {formatDateLabel(item.date)}
                    </span>
                  </div>
                );
              }

              const msg = item;
              const mine = isMyMessage(msg);
              const grouped = item.grouped;

              if (msg.deleted) {
                return (
                  <div key={msg._id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-3'}`}>
                    <div className="px-3 py-1.5 rounded-2xl bg-white/70 dark:bg-dark-700/70 text-dark-400 text-xs italic">
                      🚫 Message deleted
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg._id} className={`flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'} group ${grouped ? 'mt-0.5' : 'mt-3'}`}>
                  {/* Avatar for others' messages (only on the first of a group) */}
                  {!mine && !grouped && msg.messageType !== 'SYSTEM' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-primary-100 text-primary-700 dark:bg-dark-600 dark:text-dark-200 flex-shrink-0 mb-4">
                      {getSenderName(msg)[0] || '?'}
                    </div>
                  )}
                  {!mine && grouped && <div className="w-7 flex-shrink-0" />}

                  <div className="relative max-w-[78%] sm:max-w-[70%]">
                    {/* Sender name + role (only on the first message of a group) */}
                    {!mine && !grouped && msg.messageType !== 'SYSTEM' && (
                      <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                        <span className={`text-xs font-semibold ${getRoleBadge(msg).color}`}>
                          {getSenderName(msg)}
                        </span>
                        {getRoleBadge(msg).label && (
                          <span className={`text-[9px] px-1 py-0 rounded font-medium ${getRoleBadge(msg).chip}`}>{getRoleBadge(msg).label}</span>
                        )}
                      </div>
                    )}

                    <div
                      className={`relative px-3 py-2 text-sm shadow-sm ${
                        msg.messageType === 'ANNOUNCEMENT'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 rounded-xl'
                          : msg.messageType === 'SYSTEM'
                          ? 'bg-dark-200/70 dark:bg-dark-700/70 text-dark-500 dark:text-dark-400 text-center text-xs italic rounded-xl'
                          : mine
                          ? 'bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-2xl rounded-br-md'
                          : 'bg-white dark:bg-dark-700 text-dark-800 dark:text-dark-200 rounded-2xl rounded-bl-md border border-dark-100 dark:border-dark-600'
                      }`}
                    >
                      {/* Reply quote inside bubble */}
                      {msg.replyTo?.message && (
                        <div className={`mb-1.5 px-2 py-1 rounded-lg text-xs border-l-[3px] truncate ${
                          mine ? 'bg-white/15 border-white/70 text-white/90' : 'bg-dark-50 dark:bg-dark-800/60 border-primary-400 text-dark-500 dark:text-dark-400'
                        }`}>
                          {msg.replyTo.message.substring(0, 80)}
                        </div>
                      )}

                      {/* Pin/Important indicators */}
                      {(msg.isPinned || msg.isImportant) && (
                        <div className="absolute -top-1.5 right-2 flex gap-1 px-1.5 py-0.5 bg-white dark:bg-dark-600 rounded-full shadow-sm border border-dark-100 dark:border-dark-600">
                          {msg.isPinned && <FiBookmark size={9} className="text-yellow-500" />}
                          {msg.isImportant && <FiStar size={9} className="text-yellow-500" />}
                        </div>
                      )}

                      {/* Image attachment */}
                      {msg.messageType === 'IMAGE' && msg.attachment?.url && (
                        <img
                          src={msg.attachment.url}
                          alt={msg.attachment.originalName || 'Shared image'}
                          className="max-w-full rounded-lg mb-1 cursor-zoom-in transition-transform hover:opacity-95"
                          onClick={() => window.open(msg.attachment.url, '_blank')}
                        />
                      )}

                      {/* Document attachment */}
                      {(msg.messageType === 'DOCUMENT' || msg.messageType === 'PDF') && msg.attachment?.url && (
                        <a
                          href={msg.attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 p-2 rounded-lg mb-1 ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-dark-50 dark:bg-dark-800/60 hover:bg-dark-100 dark:hover:bg-dark-800'} transition-colors`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${mine ? 'bg-white/20' : 'bg-primary-100 dark:bg-primary-900/40'}`}>
                            <FiFile size={14} className={mine ? 'text-white' : 'text-primary-600 dark:text-primary-400'} />
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-medium max-w-[180px]">{msg.attachment.originalName || 'File'}</span>
                            {msg.attachment.size && <span className="text-[10px] opacity-60">{(msg.attachment.size / 1024).toFixed(0)} KB</span>}
                          </div>
                        </a>
                      )}

                      {/* Message text */}
                      {msg.message && msg.messageType !== 'SYSTEM' && (
                        <p className="break-words whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      )}
                      {msg.messageType === 'SYSTEM' && <p>{msg.message}</p>}

                      {/* Time & read receipts (WhatsApp style, inline bottom-right) */}
                      <div className={`flex items-center justify-end gap-1 mt-0.5 text-[10px] leading-none ${mine ? 'text-white/70' : 'text-dark-400'}`}>
                        {msg.edited && <span className="italic">(edited)</span>}
                        <span>{formatTime(msg.createdAt)}</span>
                        {mine && (
                          isReadByOther(msg)
                            ? <DoubleCheck className="text-sky-300" />
                            : <FiCheck size={13} className="opacity-70" />
                        )}
                      </div>
                    </div>

                    {/* Hover action trigger */}
                    {!msg.deleted && msg.messageType !== 'SYSTEM' && (
                      <div className={`absolute top-1/2 -translate-y-1/2 ${mine ? '-left-9' : '-right-9'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <button
                          onClick={() => setShowActions(showActions === msg._id ? null : msg._id)}
                          className="p-1.5 bg-white dark:bg-dark-700 rounded-full shadow-sm border border-dark-200 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-600"
                        >
                          <FiMoreVertical size={13} className="text-dark-500 dark:text-dark-300" />
                        </button>
                      </div>
                    )}

                    {/* Action menu */}
                    {showActions === msg._id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowActions(null)} />
                        <div className={`absolute z-20 top-1/2 ${mine ? 'right-full mr-2' : 'left-full ml-2'} bg-white dark:bg-dark-700 rounded-xl shadow-lg border border-dark-200 dark:border-dark-600 py-1 min-w-[150px]`}>
                          <button onClick={() => handleCopy(msg.message)} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-50 dark:hover:bg-dark-600 w-full text-left">
                            <FiClipboard size={13} className="text-dark-400" /> Copy
                          </button>
                          <button onClick={() => { setReplyTo(msg); setShowActions(null); inputRef.current?.focus(); }} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-50 dark:hover:bg-dark-600 w-full text-left">
                            <FiArrowDownLeft size={13} className="text-dark-400" /> Reply
                          </button>
                          {mine && (
                            <button onClick={() => handleEdit(msg)} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-50 dark:hover:bg-dark-600 w-full text-left">
                              <FiEdit2 size={13} className="text-dark-400" /> Edit
                            </button>
                          )}
                          {(mine || user.role === 'admin') && (
                            <button onClick={() => handleDelete(msg._id)} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-50 dark:hover:bg-dark-600 w-full text-left text-red-500">
                              <FiTrash2 size={13} /> Delete
                            </button>
                          )}
                          {(user.role === 'trainer' || user.role === 'admin') && (
                            <>
                              <hr className="border-dark-100 dark:border-dark-600 my-1" />
                              <button onClick={() => { togglePin(msg._id); setShowActions(null); }} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-50 dark:hover:bg-dark-600 w-full text-left">
                                <FiBookmark size={13} className="text-dark-400" /> {msg.isPinned ? 'Unpin' : 'Pin'}
                              </button>
                              <button onClick={() => { toggleImportant(msg._id); setShowActions(null); }} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-dark-50 dark:hover:bg-dark-600 w-full text-left">
                                <FiStar size={13} className="text-dark-400" /> {msg.isImportant ? 'Unmark' : 'Important'}
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {typingUser && (
              <div className="flex items-end gap-1.5 justify-start mt-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-primary-100 text-primary-700 dark:bg-dark-600 dark:text-dark-200 flex-shrink-0">
                  {otherInitial}
                </div>
                <div className="px-4 py-3 bg-white dark:bg-dark-700 rounded-2xl rounded-bl-md shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll-to-bottom FAB */}
        {showScrollFAB && !loading && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-0 left-full translate-x-0 flex ml-auto items-center justify-center w-9 h-9 bg-white dark:bg-dark-700 text-primary-600 rounded-full shadow-md border border-dark-200 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-600 transition-colors"
            title="Scroll to latest"
          >
            <FiChevronDown size={18} />
          </button>
        )}
      </div>

      {/* Edit mode */}
      {editingMsg && (
        <div className="px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
          <FiEdit2 size={14} className="text-yellow-600 flex-shrink-0" />
          <input
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitEdit()}
            className="flex-1 bg-transparent text-sm outline-none text-dark-800 dark:text-dark-200"
            autoFocus
          />
          <button onClick={submitEdit} className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg"><FiCheck size={16} /></button>
          <button onClick={() => { setEditingMsg(null); setEditText(''); }} className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"><FiX size={16} /></button>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && !editingMsg && (
        <div className="px-4 py-2.5 bg-primary-50 dark:bg-primary-900/20 border-t border-primary-200 dark:border-primary-800 flex items-center gap-2">
          <FiArrowDownLeft size={14} className="text-primary-500 flex-shrink-0" />
          <div className="flex-1 min-w-0 border-l-2 border-primary-400 pl-2">
            <p className="text-[10px] font-semibold text-primary-600 dark:text-primary-400">{isMyMessage(replyTo) ? 'You' : getSenderName(replyTo)}</p>
            <p className="text-xs text-dark-500 dark:text-dark-400 truncate">{replyTo.message?.substring(0, 80)}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1.5 text-dark-400 hover:text-dark-600 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"><FiX size={14} /></button>
        </div>
      )}

      {/* Send error indicator */}
      {sendError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex items-center gap-2">
          <FiAlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-600 dark:text-red-400 flex-1">{sendError}</span>
          <button onClick={() => setSendError('')} className="p-0.5 text-red-400 hover:text-red-600"><FiX size={12} /></button>
        </div>
      )}

      {/* Input area (WhatsApp style pill) — responsive */}
      <div className="px-2.5 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-end gap-1.5 sm:gap-2">
          <div className="flex-1 min-w-0 flex items-end gap-0.5 sm:gap-1 bg-dark-50 dark:bg-dark-700 rounded-2xl px-1.5 sm:px-2 py-1 border border-dark-200 dark:border-dark-600 focus-within:ring-2 focus-within:ring-primary-500/40 transition-shadow">
            {/* Emoji picker */}
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowEmoji(!showEmoji)} className={`p-2 transition-colors rounded-full ${showEmoji ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-dark-400 hover:text-yellow-500'}`} title="Emoji">
                <FiSmile size={19} />
              </button>
              {showEmoji && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
                  <div className="absolute bottom-12 left-0 z-50 max-w-[calc(100vw-2rem)]">
                    <EmojiPicker
                      onEmojiClick={(e) => { setNewMessage(prev => prev + e.emoji); inputRef.current?.focus(); }}
                      dynamicWidth
                      dynamicWidthConfig={{ minimum: 240, maximum: 320 }}
                      height={320}
                      previewConfig={{ showPreview: false }}
                      theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 min-w-0 resize-none bg-transparent py-2 text-sm outline-none text-dark-800 dark:text-dark-200 placeholder-dark-400 max-h-28 min-h-[24px]"
              rows={1}
            />

            {/* File upload */}
            <label className="p-2 flex-shrink-0 text-dark-400 hover:text-primary-500 cursor-pointer transition-colors rounded-full" title="Attach file">
              <FiPaperclip size={19} />
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.zip,.rar,.ppt,.pptx" />
            </label>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-full hover:from-primary-700 hover:to-primary-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-95"
            title="Send message"
          >
            {sending ? <FiRefreshCw size={17} className="animate-spin" /> : <FiSend size={17} className="translate-x-[1px] -translate-y-[1px]" />}
          </button>
        </div>
        <p className="hidden sm:block text-[10px] text-dark-300 dark:text-dark-500 text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;
