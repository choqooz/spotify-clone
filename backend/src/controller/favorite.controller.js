import { Favorite } from '../models/favorite.model.js';
import { Song } from '../models/song.model.js';
import { asyncHandler, NotFoundError, ConflictError } from '../middleware/error.middleware.js';

export const getFavorites = asyncHandler(async (req, res) => {
  const clerkId = req.auth.userId;
  const favorites = await Favorite.find({ clerkId })
    .sort({ createdAt: -1 })
    .populate('songId');
  const songs = favorites.map((f) => f.songId).filter(Boolean);
  res.json({ songs });
});

export const addFavorite = asyncHandler(async (req, res) => {
  const clerkId = req.auth.userId;
  const { songId } = req.params;

  const song = await Song.findById(songId);
  if (!song) throw new NotFoundError('Song');

  try {
    await Favorite.create({ clerkId, songId });
  } catch (err) {
    if (err.code === 11000) throw new ConflictError('Song already in favorites');
    throw err;
  }

  res.status(201).json({ success: true });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const clerkId = req.auth.userId;
  const { songId } = req.params;
  await Favorite.deleteOne({ clerkId, songId });
  res.json({ success: true });
});

export const checkFavorite = asyncHandler(async (req, res) => {
  const clerkId = req.auth.userId;
  const { songId } = req.params;
  const exists = await Favorite.exists({ clerkId, songId });
  res.json({ isFavorite: !!exists });
});
