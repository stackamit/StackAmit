import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      setConnected(false);
    });

    // Online/Offline events
    newSocket.on('userOnline', ({ userId, role }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    newSocket.on('userOffline', ({ userId }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    // Typing events
    newSocket.on('userTyping', ({ conversationId, userId, userName }) => {
      setTypingUsers(prev => ({ ...prev, [conversationId]: { userId, userName } }));
    });

    newSocket.on('userStopTyping', ({ conversationId, userId }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        if (next[conversationId]?.userId === userId) {
          delete next[conversationId];
        }
        return next;
      });
    });

    // Notification events
    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 20));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, user?.email]);

  const joinConversation = useCallback((conversationId) => {
    if (socket?.connected) {
      socket.emit('joinConversation', conversationId);
    }
  }, [socket]);

  const leaveConversation = useCallback((conversationId) => {
    if (socket?.connected) {
      socket.emit('leaveConversation', conversationId);
    }
  }, [socket]);

  const sendMessage = useCallback((data) => {
    if (socket?.connected) {
      socket.emit('sendMessage', data);
    }
  }, [socket]);

  const sendTyping = useCallback((conversationId) => {
    if (socket?.connected) {
      socket.emit('typing', conversationId);
    }
  }, [socket]);

  const sendStopTyping = useCallback((conversationId) => {
    if (socket?.connected) {
      socket.emit('stopTyping', conversationId);
    }
  }, [socket]);

  const editMessage = useCallback((messageId, newMessage) => {
    if (socket?.connected) {
      socket.emit('messageEdited', { messageId, newMessage });
    }
  }, [socket]);

  const deleteMessage = useCallback((messageId) => {
    if (socket?.connected) {
      socket.emit('messageDeleted', { messageId });
    }
  }, [socket]);

  const togglePin = useCallback((messageId) => {
    if (socket?.connected) {
      socket.emit('togglePin', { messageId });
    }
  }, [socket]);

  const toggleImportant = useCallback((messageId) => {
    if (socket?.connected) {
      socket.emit('toggleImportant', { messageId });
    }
  }, [socket]);

  const isUserOnline = useCallback((userId) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const value = {
    socket,
    connected,
    onlineUsers,
    typingUsers,
    notifications,
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    sendStopTyping,
    editMessage,
    deleteMessage,
    togglePin,
    toggleImportant,
    isUserOnline,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

export default SocketContext;
