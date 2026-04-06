import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    imageUrl: { type: String, default: '' },
    clerkId: { type: String, required: true },
    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

playlistSchema.index({ clerkId: 1, createdAt: -1 });
playlistSchema.index({ isPublic: 1 });

export const Playlist = mongoose.model('Playlist', playlistSchema);
