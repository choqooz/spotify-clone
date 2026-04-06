import express from 'express';
import dotenv from 'dotenv';
import { clerkMiddleware } from '@clerk/express';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { createServer } from 'http';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import compression from 'compression';

import { logger } from './lib/logger.js';
import { initializeSocket } from './lib/socket.js';
import { connectDB } from './lib/db.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware.js';

import userRoutes from './routes/user.route.js';
import adminRoutes from './routes/admin.route.js';
import authRoutes from './routes/auth.route.js';
import songRoutes from './routes/song.route.js';
import albumRoutes from './routes/album.route.js';
import statRoutes from './routes/stat.route.js';
import youtubeRoutes from './routes/youtube.route.js';
import downloadRoutes from './routes/download.route.js';
import downloadService from './services/downloadService.js';
import favoriteRoutes from './routes/favorite.route.js';
import playlistRoutes from './routes/playlist.route.js';

dotenv.config();

// ── Validate required env vars before doing anything ────────────────────────
const REQUIRED_ENV = ['PORT', 'MONGODB_URI', 'ADMIN_EMAIL', 'CLERK_SECRET_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  logger.error({ missing }, 'Missing required environment variables');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT;

const httpServer = createServer(app);
const io = initializeSocket(httpServer);

// ── HTTP request logging ─────────────────────────────────────────────────────
app.use(pinoHttp({ logger }));

app.use((req, res, next) => {
  // Skip timeout for download routes — yt-dlp + ffmpeg can take minutes
  if (req.path.startsWith('/api/download/')) return next();
  res.setTimeout(30000, () => {
    res.status(503).json({ success: false, error: { message: 'Request timeout' } });
  });
  next();
});

// ── Attach io to every request ───────────────────────────────────────────────
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, slow down.' } },
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Download rate limit exceeded.' } },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many auth requests, slow down.' } },
});

app.use(globalLimiter);

// ── Body parsing & file upload ────────────────────────────────────────────────
app.use(compression());
app.use(express.json());
app.use(clerkMiddleware());
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, '../tmp'),
    createParentPath: true,
    limits: { fileSize: 10 * 1024 * 1024 },
  })
);

// ── Cron: clean up downloaded files older than 2 hours ───────────────────────
cron.schedule('0 * * * *', async () => {
  try {
    await downloadService.cleanupOldFiles(2);
  } catch (err) {
    logger.error({ err }, 'Failed to clean up download files');
  }
});

// ── Cron: clean up tmp files every hour ──────────────────────────────────────
const tempDir = path.join(process.cwd(), 'tmp');
cron.schedule('0 * * * *', async () => {
  if (!existsSync(tempDir)) return;
  try {
    const files = await fs.readdir(tempDir);
    await Promise.all(files.map((f) => fs.unlink(path.join(tempDir, f))));
    logger.info({ count: files.length }, 'Cleaned up temp files');
  } catch (err) {
    logger.error({ err }, 'Failed to clean up temp files');
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/stats', statRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/download', downloadLimiter, downloadRoutes);
app.use('/api/playlists', playlistRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

// ── Error handlers ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'Server started');
  connectDB();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  httpServer.close(async () => {
    io.close();
    logger.info('Server closed');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
