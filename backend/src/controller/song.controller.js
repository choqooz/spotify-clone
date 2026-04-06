import { Song } from '../models/song.model.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { cache } from '../lib/cache.js';

const randomSongsAggregate = (size) =>
  Song.aggregate([
    { $sample: { size } },
    { $project: { _id: 1, title: 1, artist: 1, imageUrl: 1, audioUrl: 1 } },
  ]);

export const getAllSongs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [songs, total] = await Promise.all([
    Song.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Song.countDocuments(),
  ]);

  res.json({
    songs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const searchSongs = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.json({ songs: [] });
  }

  const songs = await Song.find(
    { $text: { $search: q.trim() } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(20);

  res.json({ songs });
});

export const getFeaturedSongs = asyncHandler(async (req, res) => {
  const cached = cache.get('featured');
  if (cached) return res.json(cached);
  const songs = await randomSongsAggregate(6);
  cache.set('featured', songs, 60 * 60 * 1000);
  res.json(songs);
});

export const getMadeForYouSongs = asyncHandler(async (req, res) => {
  const cached = cache.get('madeForYou');
  if (cached) return res.json(cached);
  const songs = await randomSongsAggregate(4);
  cache.set('madeForYou', songs, 60 * 60 * 1000);
  res.json(songs);
});

export const getTrendingSongs = asyncHandler(async (req, res) => {
  const cached = cache.get('trending');
  if (cached) return res.json(cached);
  const songs = await randomSongsAggregate(4);
  cache.set('trending', songs, 60 * 60 * 1000);
  res.json(songs);
});
