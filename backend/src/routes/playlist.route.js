import { Router } from 'express';
import {
  getMyPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
} from '../controller/playlist.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = Router();
router.use(protectRoute);

router.get('/', getMyPlaylists);
router.get('/:id', getPlaylistById);
router.post('/', createPlaylist);
router.patch('/:id', updatePlaylist);
router.delete('/:id', deletePlaylist);
router.post('/:id/songs/:songId', addSongToPlaylist);
router.delete('/:id/songs/:songId', removeSongFromPlaylist);

export default router;
