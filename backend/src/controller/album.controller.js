import { Album } from '../models/album.model.js';
import { asyncHandler, NotFoundError } from '../middleware/error.middleware.js';

export const getAllAlbums = asyncHandler(async (req, res) => {
  const albums = await Album.find();
  res.status(200).json(albums);
});

export const getAlbumById = asyncHandler(async (req, res) => {
  const { albumId } = req.params;

  const album = await Album.findById(albumId).populate('songs');

  if (!album) {
    throw new NotFoundError('Album');
  }

  res.status(200).json(album);
});
