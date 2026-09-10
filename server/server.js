// Load environment variables FIRST
import 'dotenv/config';
import dns from 'dns';
// Fix: Force Node.js to use public DNS servers.
// This resolves the MongoDB Atlas SRV lookup ECONNREFUSED issue.
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import { seedAdmin } from './config/seedAdmin.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocket } from './socket/index.js';
import Internship from './models/Internship.js';
// Import models to register all discriminators
import './models/Admin.js';
import './models/Student.js';
import './models/Trainer.js';
// Route imports
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import trainerRoutes from './routes/trainer.routes.js';
import internshipRoutes from './routes/internship.routes.js';
import applicationRoutes from './routes/application.routes.js';
import taskRoutes from './routes/task.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import certificateRoutes from './routes/certificate.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import reportRoutes from './routes/report.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import discussionRoutes from './routes/discussion.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ────

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Rate Limiting ────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);

// ─── Body Parsing ────
app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);
app.use(cookieParser(process.env.COOKIE_SECRET));

// ─── Logging ───
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Health Check ────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StackAmit API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});
// ─── API Routes ────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/internships', internshipRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/feedback', feedbackRoutes);
// ─── root route ────
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StackAmit Server is running 🚀',
    health: '/api/health',
  });
});
// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});
// ─── Global Error Handler ───
app.use(errorHandler);
// ─── Start Server ───
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Seed default admin
    await seedAdmin();

    // ─── Migration: Fix existing internships ──────────────────────────
    // Uses raw MongoDB driver to bypass Mongoose validation

    const collection = Internship.collection;

    const allDocs = await collection.find({}).toArray();

    if (allDocs.length > 0) {
      // Fix isDeleted on all internships
      await collection.updateMany(
        {},
        {
          $set: {
            isDeleted: false,
          },
        }
      );

      // Fix any non-standard status, including "draft"
      await collection.updateMany(
        {
          status: {
            $nin: ['published', 'closed', 'archived'],
          },
        },
        {
          $set: {
            status: 'published',
          },
        }
      );

      console.log(
        `🔧 Migration: fixed ${allDocs.length} internship(s)`
      );
    }

    // Database statistics
    const rawCount = await collection.countDocuments();

    const publishedCount = await collection.countDocuments({
      status: 'published',
      isDeleted: false,
    });

    console.log(
      `📊 Internship DB: ${rawCount} total, ${publishedCount} published & active`
    );

    // Initialize Socket.io
    initSocket(server);

    // Start server
    server.listen(PORT, () => {
      console.log(`\n🚀 StackAmit Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV}`);
      console.log(
        `🔗 API: http://localhost:${PORT}/api/health`
      );
      console.log(`🔌 Socket.io: Active\n`);
    });
  } catch (error) {
    console.error(
      '❌ Failed to start server:',
      error.message
    );

    process.exit(1);
  }
};

startServer();

export default app;