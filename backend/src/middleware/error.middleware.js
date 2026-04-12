import { logger } from '../lib/logger.js';
import { safeEmit } from '../lib/socket.js';

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

// Error handler middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  logger.error('Error details:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: req.auth?.userId || 'anonymous',
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new NotFoundError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate field value: ${field}. Please use another value.`;
    error = new ConflictError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new UnauthorizedError(message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new UnauthorizedError(message);
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = new ValidationError(message);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = new ValidationError(message);
  }

  // Cloudinary errors
  if (err.http_code && err.http_code >= 400) {
    const message = `Upload failed: ${err.message}`;
    error = new AppError(message, err.http_code);
  }

  // Default error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.status = 'error';
  }

  // Handle WebSocket emissions for download errors.
  if (req.io) {
    const videoId = req.body?.videoId || req.params?.videoId;
    const albumId = req.body?.albumId || req.params?.albumId;

    if (videoId) {
      safeEmit(req.io, `download-error-${videoId}`, {
        type: 'song',
        error: error.message,
        statusCode: error.statusCode,
      });
    }

    if (albumId) {
      safeEmit(req.io, `album-error-${albumId}`, {
        type: 'album',
        error: error.message,
        statusCode: error.statusCode,
      });
    }
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      message: error.message,
      status: error.status,
      statusCode: error.statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: {
          url: req.url,
          method: req.method,
          timestamp: new Date().toISOString(),
        },
      }),
    },
  };

  res.status(error.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for undefined routes
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};
