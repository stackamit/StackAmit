import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

let io;

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const userName = socket.user.name;
    const userRole = socket.user.role;

    console.log(`[Socket] ${userName} (${userRole}) connected: ${socket.id}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast online status
    socket.broadcast.emit('userOnline', { userId, userName, role: userRole });

    // Join personal room for targeted messages
    socket.join(`user:${userId}`);

    // ─── Join Conversation ────────────────────────────────────────
    socket.on('joinConversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          console.log('[Socket joinConversation] Conversation not found:', conversationId);
          return;
        }

        // Verify access
        const uid = socket.user._id;
        const hasAccess = (
          conversation.trainer.toString() === uid.toString() ||
          conversation.student.toString() === uid.toString() ||
          socket.user.role === 'admin'
        );

        if (!hasAccess) {
          console.log(`[Socket joinConversation] Access denied for ${uid} on conv ${conversationId}. Trainer: ${conversation.trainer}, Student: ${conversation.student}`);
          socket.emit('error', { message: 'Not authorized for this conversation' });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        console.log(`[Socket joinConversation] ${socket.user.name} joined conversation:${conversationId}`);
        socket.emit('joinedConversation', { conversationId });

        // Mark messages as read
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: uid },
            'readBy.user': { $ne: uid },
            deleted: false,
          },
          {
            $push: { readBy: { user: uid, readAt: new Date() } },
          }
        );

        // Reset unread count for this user
        const update = {};
        if (conversation.trainer.toString() === uid.toString()) {
          update.unreadTrainer = 0;
        } else if (conversation.student.toString() === uid.toString()) {
          update.unreadStudent = 0;
        }
        if (Object.keys(update).length > 0) {
          await Conversation.findByIdAndUpdate(conversationId, update);
        }

        io.to(`conversation:${conversationId}`).emit('messagesRead', {
          conversationId,
          userId: uid,
        });
      } catch (err) {
        console.error('[Socket] joinConversation error:', err.message);
      }
    });

    // ─── Leave Conversation ───────────────────────────────────────
    socket.on('leaveConversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ─── Send Message ─────────────────────────────────────────────
    socket.on('sendMessage', async (data) => {
      try {
        const { conversationId, message, messageType, attachment, replyTo } = data;
        console.log(`[Socket sendMessage] from ${socket.user._id} to conv ${conversationId}`);

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          console.log('[Socket sendMessage] Conversation not found:', conversationId);
          return;
        }

        // Verify access
        const uid = socket.user._id;
        const hasAccess = (
          conversation.trainer.toString() === uid.toString() ||
          conversation.student.toString() === uid.toString() ||
          socket.user.role === 'admin'
        );
        if (!hasAccess) return;

        // Check if muted
        const isMuted = conversation.mutedBy.some(m => m.user.toString() === uid.toString());
        if (isMuted) {
          socket.emit('error', { message: 'You are muted in this conversation' });
          return;
        }

        // Create message
        const msg = await Message.create({
          conversation: conversationId,
          sender: uid,
          senderRole: socket.user.role,
          message,
          messageType: messageType || 'TEXT',
          attachment,
          replyTo,
        });

        // Populate sender info
        const populated = await Message.findById(msg._id)
          .populate('sender', 'name email avatar role firstName lastName')
          .populate('replyTo', 'message sender messageType');

        // Update conversation
        conversation.lastMessage = msg._id;
        conversation.lastMessageAt = new Date();

        // Increment unread for the other party
        if (socket.user.role === 'student') {
          conversation.unreadTrainer += 1;
        } else if (socket.user.role === 'trainer') {
          conversation.unreadStudent += 1;
        }
        await conversation.save();

        // Ensure sender is in the conversation room (for echo)
        socket.join(`conversation:${conversationId}`);

        // Emit to all in conversation
        io.to(`conversation:${conversationId}`).emit('newMessage', {
          message: populated,
          conversationId,
        });
        console.log(`[Socket sendMessage] Message ${msg._id} emitted to room conversation:${conversationId}`);

        // Notify the other party via their personal room
        if (socket.user.role === 'student') {
          io.to(`user:${conversation.trainer}`).emit('notification', {
            title: 'New Message',
            message: `${userName} sent you a message`,
            conversationId,
          });
        } else if (socket.user.role === 'trainer') {
          io.to(`user:${conversation.student}`).emit('notification', {
            title: 'Trainer Replied',
            message: `Trainer replied to your message`,
            conversationId,
          });
        }
      } catch (err) {
        console.error('[Socket] sendMessage error:', err.message);
      }
    });

    // ─── Typing Indicator ─────────────────────────────────────────
    socket.on('typing', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('userTyping', {
        conversationId,
        userId: socket.user._id,
        userName: socket.user.name,
      });
    });

    socket.on('stopTyping', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('userStopTyping', {
        conversationId,
        userId: socket.user._id,
      });
    });

    // ─── Message Edited ───────────────────────────────────────────
    socket.on('messageEdited', async (data) => {
      try {
        const { messageId, newMessage } = data;
        const msg = await Message.findById(messageId);
        if (!msg || msg.sender.toString() !== socket.user._id.toString()) return;

        // Only allow edit within 10 minutes
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (msg.createdAt < tenMinAgo) {
          socket.emit('error', { message: 'Can only edit messages within 10 minutes' });
          return;
        }

        msg.message = newMessage;
        msg.edited = true;
        msg.editedAt = new Date();
        await msg.save();

        io.to(`conversation:${msg.conversation}`).emit('messageEdited', {
          messageId,
          newMessage,
          editedAt: msg.editedAt,
        });
      } catch (err) {
        console.error('[Socket] messageEdited error:', err.message);
      }
    });

    // ─── Message Deleted ──────────────────────────────────────────
    socket.on('messageDeleted', async (data) => {
      try {
        const { messageId } = data;
        const msg = await Message.findById(messageId);
        if (!msg) return;

        // Only sender or admin can delete
        if (msg.sender.toString() !== socket.user._id.toString() && socket.user.role !== 'admin') {
          return;
        }

        msg.deleted = true;
        msg.deletedAt = new Date();
        msg.message = '[Message deleted]';
        await msg.save();

        io.to(`conversation:${msg.conversation}`).emit('messageDeleted', {
          messageId,
          conversationId: msg.conversation.toString(),
        });
      } catch (err) {
        console.error('[Socket] messageDeleted error:', err.message);
      }
    });

    // ─── Pin/Unpin Message ────────────────────────────────────────
    socket.on('togglePin', async (data) => {
      try {
        const { messageId } = data;
        const msg = await Message.findById(messageId);
        if (!msg) return;

        // Only trainer or admin can pin
        if (socket.user.role !== 'trainer' && socket.user.role !== 'admin') return;

        msg.isPinned = !msg.isPinned;
        await msg.save();

        io.to(`conversation:${msg.conversation}`).emit('messagePinned', {
          messageId,
          isPinned: msg.isPinned,
        });
      } catch (err) {
        console.error('[Socket] togglePin error:', err.message);
      }
    });

    // ─── Mark Important ───────────────────────────────────────────
    socket.on('toggleImportant', async (data) => {
      try {
        const { messageId } = data;
        const msg = await Message.findById(messageId);
        if (!msg) return;

        if (socket.user.role !== 'trainer' && socket.user.role !== 'admin') return;

        msg.isImportant = !msg.isImportant;
        await msg.save();

        io.to(`conversation:${msg.conversation}`).emit('messageImportant', {
          messageId,
          isImportant: msg.isImportant,
        });
      } catch (err) {
        console.error('[Socket] toggleImportant error:', err.message);
      }
    });

    // ─── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] ${userName} disconnected: ${socket.id}`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline status
          socket.broadcast.emit('userOffline', { userId });
        }
      }
    });
  });

  console.log('🔌 Socket.io initialized');
  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

export const getOnlineUsers = () => onlineUsers;
