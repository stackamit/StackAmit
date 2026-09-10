import { useState, useEffect } from 'react';
import {
  FiRefreshCw, FiUser, FiMessageSquare, FiBriefcase,
} from 'react-icons/fi';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import ChatPanel from '../../components/ChatPanel';

const StudentDiscussion = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isUserOnline, connected } = useSocket();

  useEffect(() => { fetchConversations(); }, []);

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

  const selectedTrainer = selectedConversation?.trainer;
  const trainerOnline = selectedConversation ? isUserOnline(selectedTrainer?._id) : false;

  return (
    <div>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Discussion</h1>
          <p className="page-subtitle">Chat with your assigned trainer</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-dark-400">{connected ? 'Live' : 'Offline'}</span>
          <button onClick={fetchConversations} className="btn-outline flex items-center gap-2 text-sm ml-2">
            <FiRefreshCw size={14} /> Refresh
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
          <div className="card overflow-hidden flex flex-col">
            <div className="p-3 border-b border-dark-200 dark:border-dark-700">
              <h3 className="font-semibold text-sm text-dark-800 dark:text-dark-200 flex items-center gap-2">
                <FiUser size={14} /> Assigned Trainers
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversations.map(conv => {
                const isActive = selectedConversation?._id === conv._id;
                const online = isUserOnline(conv.trainer?._id);
                const unread = conv.unreadStudent || 0;

                return (
                  <button
                    key={conv._id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full text-left px-4 py-4 border-b border-dark-100 dark:border-dark-700 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isActive ? 'bg-primary-500 text-white' : 'bg-dark-200 dark:bg-dark-600 text-dark-600 dark:text-dark-300'}`}>
                          {getTrainerInitial(conv)}
                        </div>
                        {online && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-dark-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`font-medium truncate ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-dark-800 dark:text-dark-200'}`}>
                            {getTrainerName(conv)}
                          </p>
                          {unread > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 bg-primary-500 text-white text-xs rounded-full">{unread}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <FiBriefcase size={11} className="text-dark-400" />
                          <p className="text-xs text-dark-400 truncate">{conv.internship?.title || 'Internship'}</p>
                        </div>
                        <p className="text-xs mt-0.5">
                          {online ? <span className="text-green-500">Online</span> : <span className="text-dark-400">Offline</span>}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2">
            {selectedConversation ? (
              <ChatPanel
                conversation={selectedConversation}
                otherUser={selectedTrainer}
                otherUserOnline={trainerOnline}
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
