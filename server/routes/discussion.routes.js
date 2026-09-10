import express from 'express';
import {
  getTrainerConversations,
  getStudentConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  getTrainerInternships,
  getInternshipStudents,
  getAdminConversations,
  toggleCloseConversation,
  toggleMuteUser,
  deleteMessage,
  getPinnedMessages,
  getOnlineUsersList,
} from '../controllers/discussion.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Trainer routes
router.get('/trainer/internships', authorize('trainer'), getTrainerInternships);
router.get('/trainer/conversations', authorize('trainer'), getTrainerConversations);
router.get('/trainer/internship/:internshipId/students', authorize('trainer'), getInternshipStudents);
router.post('/conversation', authorize('trainer'), getOrCreateConversation);

// Student routes
router.get('/student/conversations', authorize('student'), getStudentConversations);

// Admin routes
router.get('/admin/conversations', authorize('admin'), getAdminConversations);
router.patch('/:conversationId/close', authorize('admin'), toggleCloseConversation);
router.patch('/:conversationId/mute', authorize('admin'), toggleMuteUser);

// Shared routes
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/messages', sendMessage);
router.get('/:conversationId/pinned', getPinnedMessages);
router.delete('/messages/:messageId', deleteMessage);
router.get('/online-users', getOnlineUsersList);

export default router;
