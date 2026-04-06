import { Song } from '../models/song.model.js';
import { Album } from '../models/album.model.js';
import { User } from '../models/user.model.js';
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
  AppError,
  UnauthorizedError,
  ForbiddenError,
} from '../middleware/error.middleware.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import { cache } from '../lib/cache.js';

export const createSong = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.audioFile || !req.files.imageFile) {
    throw new ValidationError('Please upload all files');
  }

  const { title, artist, albumId, duration } = req.body;
  const audioFile = req.files.audioFile;
  const imageFile = req.files.imageFile;

  const audioUrl = await uploadToCloudinary(audioFile);
  const imageUrl = await uploadToCloudinary(imageFile);

  const song = new Song({
    title,
    artist,
    audioUrl,
    imageUrl,
    duration,
    albumId: albumId || null,
  });

  await song.save();

  // if song belongs to an album, update the album's songs array
  if (albumId) {
    await Album.findByIdAndUpdate(albumId, {
      $push: { songs: song._id },
    });
  }

  cache.del('stats');
  res.status(201).json(song);
});

export const deleteSong = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const song = await Song.findById(id);

  if (!song) {
    throw new NotFoundError('Song');
  }

  // if song belongs to an album, update the album's songs array
  if (song.albumId) {
    await Album.findByIdAndUpdate(song.albumId, {
      $pull: { songs: song._id },
    });
  }

  await Song.findByIdAndDelete(id);

  cache.del('stats');
  res.status(200).json({ message: 'Song deleted successfully' });
});

export const createAlbum = asyncHandler(async (req, res) => {
  const { title, artist, releaseYear } = req.body;
  const { imageFile } = req.files;

  if (!imageFile) {
    throw new ValidationError('Album image is required');
  }

  const imageUrl = await uploadToCloudinary(imageFile);

  const album = new Album({
    title,
    artist,
    imageUrl,
    releaseYear,
  });

  await album.save();

  cache.del('stats');
  res.status(201).json(album);
});

export const deleteAlbum = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const album = await Album.findById(id);

  if (!album) {
    throw new NotFoundError('Album');
  }

  await Song.deleteMany({ albumId: id });
  await Album.findByIdAndDelete(id);

  res.status(200).json({ message: 'Album deleted successfully' });
});

export const checkAdmin = asyncHandler(async (req, res) => {
  res.status(200).json({ admin: true });
});

export const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-__v'),
    User.countDocuments(),
  ]);
  res.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const toggleAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params; // MongoDB _id
  const user = await User.findById(id);
  if (!user) throw new NotFoundError('User');
  // Prevent removing your own admin
  if (user.clerkId === req.auth.userId) {
    throw new ForbiddenError('Cannot modify your own admin status');
  }
  user.isAdmin = !user.isAdmin;
  await user.save();
  res.json({ user });
});
