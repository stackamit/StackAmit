import { useState, useEffect } from 'react';
import {
  FiRefreshCw, FiSearch, FiMessageSquare, FiUsers, FiEye,
  FiLock, FiUnlock, FiVolumeX, FiVolume2, FiChevronDown,
} from 'react-icons/fi';
import api from '../../services/api';
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
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handleToggleMute = async (convId, userId) => {
    try {
      await api.patch(`/discussions/${convId}/mute`, { userId });
      fetchConversations();
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const getName = (user) => {
    if (!user) return 'Unknown';
    return user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  };

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const term = search.toLowerCase();
    const studentName = getName(c.student).toLowerCase();
    const trainerName = getName(c.trainer).toLowerCase();
    const internshipTitle = (c.internship?.title || '').toLowerCase();
    return studentName.includes(term) || trainerName.includes(term) || internshipTitle.includes(term);
  });

  const selectedStudent = selectedConversation?.student;
  const selectedTrainer = selectedConversation?.trainer;

  // For admin, show the "other person" in chat header
  const chatOtherUser = selectedConversation ? {
    name: `${getName(selectedStudent)} & ${getName(selectedTrainer)}`,
    _id: selectedConversation._id,
  } : null;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Discussion Monitoring</h1>
          <p className="page-subtitle">Monitor and manage all internship discussions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-dark-400">{connected ? 'Live' : 'Offline'}</span>
          <button onClick={fetchConversations} className="btn-outline flex items-center gap-2 text-sm ml-2">
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-dark-900 dark:text-white">{conversations.length}</p>
          <p className="text-xs text-dark-400 mt-1">Total Chats</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-green-400">
          <p className="text-2xl font-bold text-green-600">{conversations.filter(c => !c.isClosed).length}</p>
          <p className="text-xs text-dark-400 mt-1">Active</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-red-400">
          <p className="text-2xl font-bold text-red-600">{conversations.filter(c => c.isClosed).length}</p>
          <p className="text-xs text-dark-400 mt-1">Closed</p>
        </div>
        <div className="card p-4 text-center border-l-4 border-l-yellow-400">
          <p className="text-2xl font-bold text-yellow-600">{conversations.reduce((sum, c) => sum + (c.unreadTrainer || 0) + (c.unreadStudent || 0), 0)}</p>
          <p className="text-xs text-dark-400 mt-1">Unread</p>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-4 p-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10 py-2 w-full"
            placeholder="Search by student, trainer, or internship..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
        {/* Conversation List */}
        <div className="card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-dark-200 dark:border-dark-700">
            <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-200 flex items-center gap-2">
              <FiMessageSquare size={14} /> All Conversations
              <span className="text-xs text-dark-400 font-normal">({filtered.length})</span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8"><FiRefreshCw size={18} className="animate-spin text-primary-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-dark-400 text-sm">No conversations found</div>
            ) : (
              filtered.map(conv => {
                const isActive = selectedConversation?._id === conv._id;
                const studentName = getName(conv.student);
                const trainerName = getName(conv.trainer);
                return (
                  <div
                    key={conv._id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`px-4 py-3 border-b border-dark-100 dark:border-dark-700 cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500' : ''} ${conv.isClosed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2 flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 border-2 border-white dark:border-dark-800" title={studentName}>
                          {studentName[0] || 'S'}
                        </div>
                        <div className="w-9 h-9 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300 border-2 border-white dark:border-dark-800" title={trainerName}>
                          {trainerName[0] || 'T'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">{studentName}</span>
                          <span className="text-dark-400 text-xs">↔</span>
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400 truncate">{trainerName}</span>
                        </div>
                        <p className="text-xs text-dark-500 dark:text-dark-400 truncate mt-0.5">{conv.internship?.title || 'No internship'}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {conv.student?.collegeName && <span className="text-[10px] text-dark-400 truncate max-w-[100px]">{conv.student.collegeName}</span>}
                          {conv.isClosed && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded">Closed</span>}
                          {(conv.unreadTrainer > 0 || conv.unreadStudent > 0) && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded">{conv.unreadTrainer + conv.unreadStudent} new</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat / Details Area */}
        <div className="lg:col-span-2 flex flex-col gap-4">
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
              <div className="flex-1">
                <ChatPanel
                  conversation={selectedConversation}
                  otherUser={chatOtherUser}
                  otherUserOnline={false}
                />
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center card">
              <div className="text-center text-dark-400">
                <FiEye size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a conversation to monitor</p>
                <p className="text-sm mt-1">Click on any conversation to view messages and manage</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDiscussion;
