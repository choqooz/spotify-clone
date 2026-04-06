import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ clerkId: 1, songId: 1 }, { unique: true });
favoriteSchema.index({ clerkId: 1, createdAt: -1 });

export const Favorite = mongoose.model('Favorite', favoriteSchema);
