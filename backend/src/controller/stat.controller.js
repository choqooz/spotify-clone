import { Album } from '../models/album.model.js';
import { Song } from '../models/song.model.js';
import { User } from '../models/user.model.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { cache } from '../lib/cache.js';

export const getStats = asyncHandler(async (req, res) => {
  const cached = cache.get('stats');
  if (cached) return res.status(200).json(cached);

  const [totalSongs, totalAlbums, totalUsers, uniqueArtists] =
    await Promise.all([
      Song.countDocuments(),
      Album.countDocuments(),
      User.countDocuments(),

      Song.aggregate([
        {
          $unionWith: {
            coll: 'albums',
            pipeline: [],
          },
        },
        {
          $group: {
            _id: '$artist',
          },
        },
        {
          $count: 'count',
        },
      ]),
    ]);

  const result = {
    totalAlbums,
    totalSongs,
    totalUsers,
    totalArtists: uniqueArtists[0]?.count || 0,
  };
  cache.set('stats', result, 60 * 60 * 1000);
  res.status(200).json(result);
});
