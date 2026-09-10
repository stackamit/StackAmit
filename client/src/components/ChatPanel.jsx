import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiSend, FiPaperclip, FiSmile, FiSearch, FiBookmark, FiMoreVertical,
  FiEdit2, FiTrash2, FiStar, FiClipboard, FiArrowDownLeft, FiX,
  FiCheck, FiFile, FiRefreshCw, FiAlertCircle,
} from 'react-icons/fi';
import EmojiPicker from 'emoji-picker-react';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const ChatPanel = ({ conversation, otherUser, otherUserOnline }) => {
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
  const [filePreview, setFilePreview] = useState(null);
  const [sendError, setSendError] = useState('');

  const messagesEndRef = useRef(null);
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
      console.log('[ChatPanel] Socket newMessage received:', message._id, 'conv:', conversationId, 'sender:', message.sender?.name);
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      const { data } = await api.get(`/discussions/${conversation._id}/messages`, { params });
      const msgs = data.data.messages || [];
      console.log(`[ChatPanel] Fetched ${msgs.length} messages for conv ${conversation._id}`);
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
    console.log('[ChatPanel] Sending message to conv:', conversation._id, 'user:', user._id, 'role:', user.role);
    try {
      // Send via REST API for guaranteed delivery
      const { data } = await api.post(`/discussions/${conversation._id}/messages`, {
        message: newMessage.trim(),
        messageType: 'TEXT',
        replyTo: replyTo?._id || undefined,
      });
      console.log('[ChatPanel] REST send success:', data?.data?.message?._id);

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
      console.error('[ChatPanel] REST send error:', err.response?.data || err.message);
      console.error('[ChatPanel] Error status:', err.response?.status);
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
    if (file.size > 100 * 1024 * 1024) { alert('File too large (max 100MB)'); return; }

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
      alert('Can only edit messages within 10 minutes');
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
    setShowActions(null);
  };

  const fetchPinned = async () => {
    try {
      const { data } = await api.get(`/discussions/${conversation._id}/pinned`);
      setPinnedMessages(data.data.messages || []);
      setShowPinned(!showPinned);
    } catch (err) { console.error(err); }
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formatDateLabel = (d) => new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const isMyMessage = (msg) => {
    if (!msg.sender?._id || !user._id) return false;
    return String(msg.sender._id) === String(user._id);
  };
  const getSenderName = (msg) => {
    if (!msg.sender) return 'Unknown';
    return msg.sender.name || `${msg.sender.firstName || ''} ${msg.sender.lastName || ''}`.trim() || 'User';
  };

  // Get role badge color for sender
  const getRoleBadge = (msg) => {
    const role = msg.sender?.role || msg.senderRole;
    if (role === 'trainer') return { label: 'Trainer', color: 'text-emerald-600 dark:text-emerald-400' };
    if (role === 'student') return { label: 'Student', color: 'text-blue-600 dark:text-blue-400' };
    if (role === 'admin') return { label: 'Admin', color: 'text-purple-600 dark:text-purple-400' };
    return { label: '', color: '' };
  };

  const typingUser = typingUsers[conversation?._id];

  // Group messages by date
  const groupedMessages = [];
  let lastDate = '';
  messages.forEach(msg => {
    const date = new Date(msg.createdAt).toDateString();
    if (date !== lastDate) {
      groupedMessages.push({ type: 'date', date: msg.createdAt });
      lastDate = date;
    }
    groupedMessages.push({ type: 'message', ...msg });
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-800 rounded-2xl overflow-hidden border border-dark-200 dark:border-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {otherUser?.name?.[0] || otherUser?.firstName?.[0] || '?'}
            </div>
            {otherUserOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{otherUser?.name || `${otherUser?.firstName || ''} ${otherUser?.lastName || ''}`.trim() || 'User'}</h3>
            <p className="text-xs text-white/70">
              {typingUser ? 'Typing...' : otherUserOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Search">
            <FiSearch size={16} />
          </button>
          <button onClick={fetchPinned} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Pinned messages">
            <FiBookmark size={16} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={14} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchMessages()}
              className="input-field pl-8 py-1.5 text-sm w-full"
              placeholder="Search messages..."
            />
          </div>
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinned && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 max-h-32 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Pinned Messages</span>
            <button onClick={() => setShowPinned(false)}><FiX size={14} className="text-yellow-600" /></button>
          </div>
          {pinnedMessages.length === 0 ? (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">No pinned messages</p>
          ) : (
            pinnedMessages.map(m => (
              <p key={m._id} className="text-xs text-yellow-800 dark:text-yellow-300 truncate">
                <strong>{getSenderName(m)}:</strong> {m.message}
              </p>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-dark-50 dark:bg-dark-900">
        {loading ? (
          <div className="flex items-center justify-center py-8"><FiRefreshCw size={20} className="animate-spin text-primary-500" /></div>
        ) : groupedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-dark-400 text-sm">No messages yet. Start the conversation!</div>
        ) : (
          groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${idx}`} className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 bg-dark-200 dark:bg-dark-700 text-dark-500 dark:text-dark-400 rounded-full text-xs">
                    {formatDateLabel(item.date)}
                  </span>
                </div>
              );
            }

            const msg = item;
            const mine = isMyMessage(msg);

            if (msg.deleted) {
              return (
                <div key={msg._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="px-3 py-1.5 rounded-lg bg-dark-200 dark:bg-dark-700 text-dark-400 text-xs italic">
                    Message deleted
                  </div>
                </div>
              );
            }

            return (
              <div key={msg._id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                <div className={`relative max-w-[75%] ${mine ? 'order-1' : 'order-1'}`}>
                  {/* Sender name (WhatsApp style - only on others' messages) */}
                  {!mine && msg.messageType !== 'SYSTEM' && (
                    <div className="flex items-center gap-1.5 mb-0.5 ml-1">
                      <span className={`text-xs font-semibold ${getRoleBadge(msg).color}`}>
                        {getSenderName(msg)}
                      </span>
                      {getRoleBadge(msg).label && (
                        <span className={`text-[9px] px-1 py-0 rounded ${
                          msg.senderRole === 'trainer' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : msg.senderRole === 'student' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                        }`}>{getRoleBadge(msg).label}</span>
                      )}
                    </div>
                  )}

                  {/* Reply preview */}
                  {msg.replyTo && (
                    <div className="mb-1 px-2 py-1 bg-dark-200 dark:bg-dark-700 rounded-t-lg text-xs text-dark-500 dark:text-dark-400 border-l-2 border-primary-400">
                      {msg.replyTo.message?.substring(0, 60) || 'Original message'}
                    </div>
                  )}

                  <div
                    className={`px-3 py-2 rounded-2xl text-sm relative ${
                      msg.messageType === 'ANNOUNCEMENT'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700'
                        : msg.messageType === 'SYSTEM'
                        ? 'bg-dark-200 dark:bg-dark-700 text-dark-500 dark:text-dark-400 text-center text-xs italic'
                        : mine
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-white dark:bg-dark-700 text-dark-800 dark:text-dark-200 rounded-bl-md border border-dark-200 dark:border-dark-600'
                    }`}
                  >
                    {/* Pin/Important indicators */}
                    {msg.isPinned && <FiBookmark size={10} className="inline mr-1 text-yellow-500" />}
                    {msg.isImportant && <FiStar size={10} className="inline mr-1 text-yellow-500" />}

                    {/* Image attachment */}
                    {msg.messageType === 'IMAGE' && msg.attachment?.url && (
                      <img src={msg.attachment.url} alt={msg.attachment.originalName} className="max-w-full rounded-lg mb-1 cursor-pointer" onClick={() => window.open(msg.attachment.url, '_blank')} />
                    )}

                    {/* Document attachment */}
                    {(msg.messageType === 'DOCUMENT' || msg.messageType === 'PDF') && msg.attachment?.url && (
                      <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-white/10 rounded-lg mb-1 hover:bg-white/20">
                        <FiFile size={16} />
                        <span className="truncate text-xs">{msg.attachment.originalName || 'File'}</span>
                      </a>
                    )}

                    {/* Message text */}
                    {msg.message && msg.messageType !== 'SYSTEM' && (
                      <p className="break-words whitespace-pre-wrap">{msg.message}</p>
                    )}
                    {msg.messageType === 'SYSTEM' && <p>{msg.message}</p>}

                    {/* Time & read receipt */}
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${mine ? 'text-white/60 justify-end' : 'text-dark-400'}`}>
                      <span>{formatTime(msg.createdAt)}</span>
                      {msg.edited && <span>(edited)</span>}
                      {mine && msg.readBy?.length > 0 && <FiCheck size={12} className="text-blue-300" />}
                      {mine && (!msg.readBy || msg.readBy.length === 0) && <FiCheck size={12} />}
                    </div>
                  </div>

                  {/* Action buttons on hover */}
                  {!msg.deleted && msg.messageType !== 'SYSTEM' && (
                    <div className={`absolute top-0 ${mine ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <button onClick={() => setShowActions(showActions === msg._id ? null : msg._id)} className="p-1 hover:bg-dark-200 dark:hover:bg-dark-600 rounded">
                        <FiMoreVertical size={14} className="text-dark-400" />
                      </button>
                    </div>
                  )}

                  {/* Action menu */}
                  {showActions === msg._id && (
                    <div className={`absolute z-10 top-6 ${mine ? 'right-0' : 'left-0'} bg-white dark:bg-dark-700 rounded-lg shadow-lg border border-dark-200 dark:border-dark-600 py-1 min-w-[140px]`}>
                      <button onClick={() => { handleCopy(msg.message); }} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-dark-100 dark:hover:bg-dark-600 w-full text-left">
                        <FiClipboard size={12} /> Copy
                      </button>
                      <button onClick={() => { setReplyTo(msg); setShowActions(null); }} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-dark-100 dark:hover:bg-dark-600 w-full text-left">
                        <FiArrowDownLeft size={12} /> Reply
                      </button>
                      {mine && (
                        <button onClick={() => handleEdit(msg)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-dark-100 dark:hover:bg-dark-600 w-full text-left">
                          <FiEdit2 size={12} /> Edit
                        </button>
                      )}
                      {(mine || user.role === 'admin') && (
                        <button onClick={() => handleDelete(msg._id)} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-dark-100 dark:hover:bg-dark-600 w-full text-left text-red-500">
                          <FiTrash2 size={12} /> Delete
                        </button>
                      )}
                      {(user.role === 'trainer' || user.role === 'admin') && (
                        <>
                          <button onClick={() => { togglePin(msg._id); setShowActions(null); }} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-dark-100 dark:hover:bg-dark-600 w-full text-left">
                            <FiBookmark size={12} /> {msg.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button onClick={() => { toggleImportant(msg._id); setShowActions(null); }} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-dark-100 dark:hover:bg-dark-600 w-full text-left">
                            <FiStar size={12} /> {msg.isImportant ? 'Unmark' : 'Important'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUser && (
          <div className="flex justify-start">
            <div className="px-3 py-2 bg-white dark:bg-dark-700 rounded-2xl rounded-bl-md text-sm text-dark-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Edit mode */}
      {editingMsg && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
          <FiEdit2 size={14} className="text-yellow-600" />
          <input
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-dark-800 dark:text-dark-200"
            autoFocus
          />
          <button onClick={submitEdit} className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"><FiCheck size={16} /></button>
          <button onClick={() => { setEditingMsg(null); setEditText(''); }} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"><FiX size={16} /></button>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && !editingMsg && (
        <div className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-t border-primary-200 dark:border-primary-800 flex items-center gap-2">
          <FiArrowDownLeft size={14} className="text-primary-500" />
          <span className="text-xs text-dark-500 truncate flex-1">{replyTo.message?.substring(0, 80)}</span>
          <button onClick={() => setReplyTo(null)} className="p-1 text-dark-400 hover:text-dark-600"><FiX size={14} /></button>
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

      {/* Input area */}
      <div className="px-4 py-3 bg-white dark:bg-dark-800 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-end gap-2">
          {/* File upload */}
          <label className="p-2 text-dark-400 hover:text-primary-500 cursor-pointer transition-colors">
            <FiPaperclip size={18} />
            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.zip,.rar,.ppt,.pptx" />
          </label>

          {/* Emoji picker */}
          <div className="relative">
            <button onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-dark-400 hover:text-yellow-500 transition-colors">
              <FiSmile size={18} />
            </button>
            {showEmoji && (
              <div className="absolute bottom-12 left-0 z-50">
                <EmojiPicker
                  onEmojiClick={(e) => { setNewMessage(prev => prev + e.emoji); setShowEmoji(false); }}
                  width={300}
                  height={350}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                />
              </div>
            )}
          </div>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none bg-dark-50 dark:bg-dark-700 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500 text-dark-800 dark:text-dark-200 max-h-24"
            rows={1}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiSend size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
