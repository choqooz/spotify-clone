import { Server } from 'socket.io';
import { createClerkClient } from '@clerk/express';
import { Message } from '../models/message.model.js';
import { logger } from './logger.js';

const IDLE_ACTIVITY = 'Idle';

/**
 * Safely emit a Socket.IO event. The socket may be closed/invalid by the time
 * the handler runs — swallow the error so it never crashes the caller.
 * @param {import('socket.io').Server | import('socket.io').Socket} io
 * @param {string} event
 * @param {unknown} data
 */
export const safeEmit = (io, event, data) => {
  try {
    io.emit(event, data);
  } catch (err) {
    logger.warn({ err }, 'Failed to emit socket event');
  }
};

export const initializeSocket = (server) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const userSockets = new Map(); // { userId: socketId }
  const userActivities = new Map(); // { userId: activity }

  // ── Auth middleware: verify Clerk token before accepting any connection ──
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const payload = await clerkClient.verifyToken(token);
      socket.data.userId = payload.sub; // Clerk userId from verified token
      next();
    } catch (err) {
      logger.warn({ err: err.message }, 'Socket auth failed');
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId; // always from verified token

    userSockets.set(userId, socket.id);
    userActivities.set(userId, IDLE_ACTIVITY);

    io.emit('user_connected', userId);
    socket.emit('users_online', Array.from(userSockets.keys()));
    io.emit('activities', Array.from(userActivities.entries()));

    socket.on('update_activity', ({ activity }) => {
      userActivities.set(userId, activity);
      io.emit('activity_updated', { userId, activity });
    });

    socket.on('send_message', async ({ receiverId, content }) => {
      try {
        const message = await Message.create({
          senderId: userId,
          receiverId,
          content,
        });

        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', message);
        }
        socket.emit('message_sent', message);
      } catch (error) {
        logger.error({ error }, 'Socket send_message error');
        socket.emit('message_error', 'Failed to send message');
      }
    });

    socket.on('disconnect', () => {
      userSockets.delete(userId);
      userActivities.delete(userId);
      io.emit('user_disconnected', userId);
    });
  });

  return io;
};
