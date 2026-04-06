import { Router } from 'express';
import {
  getAllSongs,
  getFeaturedSongs,
  getMadeForYouSongs,
  getTrendingSongs,
  searchSongs,
} from '../controller/song.controller.js';
import { protectRoute, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/search', protectRoute, searchSongs);
router.get('/', protectRoute, requireAdmin, getAllSongs);
router.get('/featured', getFeaturedSongs);
router.get('/made-for-you', getMadeForYouSongs);
router.get('/trending', getTrendingSongs);

export default router;
