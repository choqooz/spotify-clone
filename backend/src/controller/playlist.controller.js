import { Playlist } from '../models/playlist.model.js';
import { Song } from '../models/song.model.js';
import { asyncHandler, NotFoundError, ForbiddenError, ValidationError } from '../middleware/error.middleware.js';

const ownerGuard = (playlist, userId) => {
  if (playlist.clerkId !== userId) throw new ForbiddenError('Not your playlist');
};

export const getMyPlaylists = asyncHandler(async (req, res) => {
  const playlists = await Playlist.find({ clerkId: req.auth.userId })
    .sort({ createdAt: -1 })
    .select('-songs');
  res.json({ playlists });
});

export const getPlaylistById = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findById(req.params.id).populate('songs');
  if (!playlist) throw new NotFoundError('Playlist');
  if (!playlist.isPublic && playlist.clerkId !== req.auth.userId)
    throw new ForbiddenError('This playlist is private');
  res.json({ playlist });
});

export const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description, isPublic } = req.body;
  if (!name?.trim()) throw new ValidationError('Name is required');
  const playlist = await Playlist.create({
    name: name.trim(),
    description: description?.trim() ?? '',
    clerkId: req.auth.userId,
    isPublic: !!isPublic,
  });
  res.status(201).json({ playlist });
});

export const updatePlaylist = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) throw new NotFoundError('Playlist');
  ownerGuard(playlist, req.auth.userId);
  const { name, description, isPublic } = req.body;
  if (name !== undefined) playlist.name = name.trim();
  if (description !== undefined) playlist.description = description.trim();
  if (isPublic !== undefined) playlist.isPublic = !!isPublic;
  await playlist.save();
  res.json({ playlist });
});

export const deletePlaylist = asyncHandler(async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) throw new NotFoundError('Playlist');
  ownerGuard(playlist, req.auth.userId);
  await playlist.deleteOne();
  res.json({ success: true });
});

export const addSongToPlaylist = asyncHandler(async (req, res) => {
  const { id, songId } = req.params;
  const playlist = await Playlist.findById(id);
  if (!playlist) throw new NotFoundError('Playlist');
  ownerGuard(playlist, req.auth.userId);
  const song = await Song.findById(songId);
  if (!song) throw new NotFoundError('Song');
  if (playlist.songs.some((s) => s.toString() === songId))
    throw new ValidationError('Song already in playlist');
  playlist.songs.push(songId);
  await playlist.save();
  res.json({ success: true });
});

export const removeSongFromPlaylist = asyncHandler(async (req, res) => {
  const { id, songId } = req.params;
  const playlist = await Playlist.findById(id);
  if (!playlist) throw new NotFoundError('Playlist');
  ownerGuard(playlist, req.auth.userId);
  playlist.songs = playlist.songs.filter((s) => s.toString() !== songId);
  await playlist.save();
  res.json({ success: true });
});
