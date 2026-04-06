import { Router } from 'express';
import {
  getSearchSuggestions,
  searchYouTube,
  getSongDetails,
  getAlbumDetails,
  getLyrics,
  healthCheck,
} from '../controller/youtube.controller.js';

const router = Router();

// Get search suggestions
router.get('/search/suggestions', getSearchSuggestions);

// Search YouTube Music
router.get('/search', searchYouTube);

// Get song details by videoId
router.get('/song/:videoId', getSongDetails);

// Get album details by albumId
router.get('/album/:albumId', getAlbumDetails);

// Get lyrics by videoId
router.get('/lyrics/:videoId', getLyrics);

// Health check
router.get('/health', healthCheck);

export default router;
