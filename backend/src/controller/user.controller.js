import { User } from '../models/user.model.js';
import { Message } from '../models/message.model.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const getAllUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.auth.userId;
  const users = await User.find({ clerkId: { $ne: currentUserId } });
  res.status(200).json(users);
});

export const getMessages = asyncHandler(async (req, res) => {
  const myId = req.auth.userId;
  const { userId } = req.params;

  const messages = await Message.find({
    $or: [
      { senderId: userId, receiverId: myId },
      { senderId: myId, receiverId: userId },
    ],
  }).sort({ createdAt: 1 });

  res.status(200).json(messages);
});
