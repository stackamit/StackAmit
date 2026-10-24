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
import { evaluateCookieSecret } from './utils/secrets.js';

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
import articleRoutes from './routes/article.routes.js';
import noticeRoutes from './routes/notice.routes.js';

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────
// Trust Proxy
// ─────────────────────────────────────────────
//
// The API runs behind Render's load balancer, which forwards the
// real client address in the X-Forwarded-For header. Without this,
// express-rate-limit sees every request as coming from the single
// proxy IP, so ALL users share one rate-limit bucket. That bucket
// is exhausted quickly (dashboard polling + notification checks),
// returning 429s and making the app feel slow / broken.
//
// Trusting one proxy hop makes each real visitor get their own
// independent limit instead of a shared global one.
app.set('trust proxy', 1);

// ─────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────

// SA-031: hardened helmet configuration. This service is a JSON API (plus
// file downloads), so a restrictive default-src 'none' CSP blocks any HTML/XSS
// execution surface, HSTS is pinned with preload + includeSubDomains, and
// frame-ancestors DENY prevents the responses being framed for clickjacking.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        // Allow browsers to render PDFs / images served inline from downloads.
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',')
      : 'https://stackamit.netlify.app',

    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────

// General API Rate Limiter
//
// Applies to all /api routes EXCEPT /api/auth/*.
//
// SPA dashboards fire many parallel GETs on every page load,
// so the limit must be generous enough to never break normal
// browsing (a tight limit here caused 429s + token refresh failures).
//
// Limit: 1000 requests per IP per 15 minutes.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 1000,

  // Do NOT apply the general limiter to authentication routes.
  // Authentication routes have their own limiter below.
  skip: (req) => {
    const path = req.originalUrl || req.url || '';
    return path.startsWith('/api/auth') || path.startsWith('/api/health');
  },

  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication Rate Limiter
//
// Applies only to /api/auth/*.
//
// Limit:
// 100 failed attempts per IP per 15 minutes.
//
// Notes:
// - Successful auth attempts are skipped (skipSuccessfulRequests),
//   so genuine users are never locked out.
// - The token-refresh endpoint is fully excluded: rate-limiting
//   refresh calls caused 429s during automatic token renewal, which
//   forced users to the login page.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 100,

  skip: (req) => {
    const path = req.originalUrl || req.url || '';
    // Never throttle automatic access-token refreshes
    return path.includes('/auth/refresh-token');
  },

  skipSuccessfulRequests: true,

  message: {
    success: false,
    message:
      'Too many authentication attempts, please try again later.',
  },

  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
app.use('/api', limiter);

// Authentication-specific limiter
app.use('/api/auth', authLimiter);

// ─────────────────────────────────────────────
// Body Parsing
// ─────────────────────────────────────────────

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

app.use(cookieParser(process.env.COOKIE_SECRET));

// ─────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StackAmit API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

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

app.use('/api/articles', articleRoutes);

app.use('/api/notices', noticeRoutes);

// ─────────────────────────────────────────────
// Root Route
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StackAmit Server is running 🚀',
    health: '/api/health',
  });
});

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────

app.use(errorHandler);

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Seed default admin
    await seedAdmin();

    // SA-037: surface (non-fatally) a cookie-signing secret misconfiguration.
    const cookieSecretCheck = evaluateCookieSecret({
      cookieSecret: process.env.COOKIE_SECRET,
      jwtSecret: process.env.JWT_SECRET,
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    });
    if (cookieSecretCheck.reused) {
      console.warn(`[Config] ${cookieSecretCheck.advice}`);
    } else if (cookieSecretCheck.missing && process.env.NODE_ENV === 'production') {
      console.warn(`[Config] ${cookieSecretCheck.advice}`);
    }

    // ─────────────────────────────────────────
    // Migration: Fix existing internships
    // ─────────────────────────────────────────

    // SA-036: data repair must NOT happen implicitly on every boot. A startup
    // path that issues updateMany({}) writes to the database on each cold start
    // (and would fight a rollback if the shape regressed). It is now opt-in via
    // RUN_BOOT_MIGRATIONS=true for legacy one-off repairs; the preferred, safe
    // route is the explicit `scripts/repairInternshipFlags.mjs` (dry-run by
    // default). Without the flag the app boots read-only and touches no data.
    const collection = Internship.collection;

    if (process.env.RUN_BOOT_MIGRATIONS === 'true') {
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
    } else {
      console.log(
        '🔧 Boot-time migration skipped (RUN_BOOT_MIGRATIONS not set). Use scripts/repairInternshipFlags.mjs for a reviewed, explicit repair.'
      );
    }

    // ─────────────────────────────────────────
    // Database Statistics
    // ─────────────────────────────────────────

    const rawCount = await collection.countDocuments();

    const publishedCount = await collection.countDocuments({
      status: 'published',
      isDeleted: false,
    });

    console.log(
      `📊 Internship DB: ${rawCount} total, ${publishedCount} published & active`
    );

    // ─────────────────────────────────────────
    // Initialize Socket.io
    // ─────────────────────────────────────────

    initSocket(server);

    // ─────────────────────────────────────────
    // Start HTTP Server
    // ─────────────────────────────────────────

    server.listen(PORT, () => {
      console.log(
        `\n🚀 StackAmit Server running on port ${PORT}`
      );

      console.log(
        `📡 Environment: ${process.env.NODE_ENV}`
      );

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










// // Load environment variables FIRST
// import 'dotenv/config';
// import dns from 'dns';
// // Fix: Force Node.js to use public DNS servers.
// // This resolves the MongoDB Atlas SRV lookup ECONNREFUSED issue.
// dns.setServers(['8.8.8.8', '8.8.4.4']);

// import express from 'express';
// import { createServer } from 'http';
// import helmet from 'helmet';
// import cors from 'cors';
// import morgan from 'morgan';
// import cookieParser from 'cookie-parser';
// import rateLimit from 'express-rate-limit';
// import { connectDB } from './config/db.js';
// import { seedAdmin } from './config/seedAdmin.js';
// import { errorHandler } from './middleware/errorHandler.js';
// import { initSocket } from './socket/index.js';
// import Internship from './models/Internship.js';
// // Import models to register all discriminators
// import './models/Admin.js';
// import './models/Student.js';
// import './models/Trainer.js';
// // Route imports
// import authRoutes from './routes/auth.routes.js';
// import studentRoutes from './routes/student.routes.js';
// import trainerRoutes from './routes/trainer.routes.js';
// import internshipRoutes from './routes/internship.routes.js';
// import applicationRoutes from './routes/application.routes.js';
// import taskRoutes from './routes/task.routes.js';
// import notificationRoutes from './routes/notification.routes.js';
// import certificateRoutes from './routes/certificate.routes.js';
// import settingsRoutes from './routes/settings.routes.js';
// import reportRoutes from './routes/report.routes.js';
// import uploadRoutes from './routes/upload.routes.js';
// import discussionRoutes from './routes/discussion.routes.js';
// import feedbackRoutes from './routes/feedback.routes.js';
// import articleRoutes from './routes/article.routes.js';

// const app = express();
// const server = createServer(app);
// const PORT = process.env.PORT || 5000;

// // ─── Security Middleware ────

// app.use(helmet());
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : 'https://stackamit.netlify.app', 
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//   })
// );

// // ─── Rate Limiting ────
// const limiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hours
//   max: 100,
//   message: {
//     success: false,
//     message: 'Too many requests, please try again later.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use('/api', limiter);

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50,
//   message: {
//     success: false,
//     message: 'Too many authentication attempts, please try again later.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// app.use('/api/auth', authLimiter);

// // ─── Body Parsing ────
// app.use(express.json({ limit: '10mb' }));
// app.use(
//   express.urlencoded({
//     extended: true,
//     limit: '10mb',
//   })
// );
// app.use(cookieParser(process.env.COOKIE_SECRET));

// // ─── Logging ───
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// } else {
//   app.use(morgan('combined'));
// }

// // ─── Health Check ────
// app.get('/api/health', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: 'StackAmit API is running',
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV,
//   });
// });
// // ─── API Routes ────
// app.use('/api/auth', authRoutes);
// app.use('/api/students', studentRoutes);
// app.use('/api/trainers', trainerRoutes);
// app.use('/api/internships', internshipRoutes);
// app.use('/api/applications', applicationRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/certificates', certificateRoutes);
// app.use('/api/settings', settingsRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/upload', uploadRoutes);
// app.use('/api/discussions', discussionRoutes);
// app.use('/api/feedback', feedbackRoutes);
// app.use('/api/articles', articleRoutes);
// // ─── root route ────
// app.get('/', (req, res) => {
//   res.status(200).json({
//     success: true,
//     message: 'StackAmit Server is running 🚀',
//     health: '/api/health',
//   });
// });
// // ─── 404 Handler ───
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `Route not found: ${req.originalUrl}`,
//   });
// });
// // ─── Global Error Handler ───
// app.use(errorHandler);
// // ─── Start Server ───
// const startServer = async () => {
//   try {
//     // Connect to MongoDB
//     await connectDB();

//     // Seed default admin
//     await seedAdmin();

//     // ─── Migration: Fix existing internships ──────────────────────────
//     // Uses raw MongoDB driver to bypass Mongoose validation

//     const collection = Internship.collection;

//     const allDocs = await collection.find({}).toArray();

//     if (allDocs.length > 0) {
//       // Fix isDeleted on all internships
//       await collection.updateMany(
//         {},
//         {
//           $set: {
//             isDeleted: false,
//           },
//         }
//       );

//       // Fix any non-standard status, including "draft"
//       await collection.updateMany(
//         {
//           status: {
//             $nin: ['published', 'closed', 'archived'],
//           },
//         },
//         {
//           $set: {
//             status: 'published',
//           },
//         }
//       );

//       console.log(
//         `🔧 Migration: fixed ${allDocs.length} internship(s)`
//       );
//     }

//     // Database statistics
//     const rawCount = await collection.countDocuments();

//     const publishedCount = await collection.countDocuments({
//       status: 'published',
//       isDeleted: false,
//     });

//     console.log(
//       `📊 Internship DB: ${rawCount} total, ${publishedCount} published & active`
//     );

//     // Initialize Socket.io
//     initSocket(server);

//     // Start server
//     server.listen(PORT, () => {
//       console.log(`\n🚀 StackAmit Server running on port ${PORT}`);
//       console.log(`📡 Environment: ${process.env.NODE_ENV}`);
//       console.log(
//         `🔗 API: http://localhost:${PORT}/api/health`
//       );
//       console.log(`🔌 Socket.io: Active\n`);
//     });
//   } catch (error) {
//     console.error(
//       '❌ Failed to start server:',
//       error.message
//     );

//     process.exit(1);
//   }
// };

// startServer();

// export default app;