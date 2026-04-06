import { User } from '../models/user.model.js';
import {
  UnauthorizedError,
  ForbiddenError,
  asyncHandler,
} from './error.middleware.js';

export const protectRoute = asyncHandler(async (req, res, next) => {
  if (!req.auth?.userId) throw new UnauthorizedError('You must be logged in');
  next();
});

export const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ clerkId: req.auth.userId }).select('isAdmin');
  if (!user?.isAdmin) throw new ForbiddenError('You must be an admin');
  next();
});
