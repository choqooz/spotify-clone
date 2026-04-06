import { User } from '../models/user.model.js';
import { asyncHandler } from '../middleware/error.middleware.js';

export const authCallback = asyncHandler(async (req, res) => {
  const { id, firstName, lastName, imageUrl, email } = req.body;

  const isAdmin = process.env.ADMIN_EMAIL === email;

  const user = await User.findOne({ clerkId: id });

  if (!user) {
    await User.create({
      clerkId: id,
      fullName: `${firstName || ''} ${lastName || ''}`.trim(),
      imageUrl,
      isAdmin,
    });
  } else if (isAdmin && !user.isAdmin) {
    // Promote existing user to admin if email matches
    await User.updateOne({ clerkId: id }, { isAdmin: true });
  }

  res.status(200).json({ success: true });
});
