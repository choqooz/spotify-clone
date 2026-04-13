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

/**
 * @swagger
 * /api/youtube/search/suggestions:
 *   get:
 *     summary: Get search suggestions for a query
 *     tags: [YouTube]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Partial search query for autocomplete
 *         example: bohemian
 *     responses:
 *       200:
 *         description: Search suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["bohemian rhapsody", "bohemian like you"]
 *       400:
 *         description: Missing query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search/suggestions', getSearchSuggestions);

/**
 * @swagger
 * /api/youtube/search:
 *   get:
 *     summary: Search YouTube Music
 *     tags: [YouTube]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *         example: Queen Bohemian Rhapsody
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Max number of results
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   videoId: { type: string, example: dQw4w9WgXcQ }
 *                   title: { type: string, example: Bohemian Rhapsody }
 *                   artist: { type: string, example: Queen }
 *                   duration: { type: number, example: 354 }
 *                   thumbnail: { type: string, example: https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg }
 *       400:
 *         description: Missing query parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search', searchYouTube);

/**
 * @swagger
 * /api/youtube/song/{videoId}:
 *   get:
 *     summary: Get detailed info for a YouTube song
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: YouTube video ID
 *         example: dQw4w9WgXcQ
 *     responses:
 *       200:
 *         description: Song details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 videoId: { type: string }
 *                 title: { type: string }
 *                 artist: { type: string }
 *                 album: { type: string }
 *                 duration: { type: number }
 *                 thumbnail: { type: string }
 *                 year: { type: number }
 *       404:
 *         description: Song not found
 */
router.get('/song/:videoId', getSongDetails);

/**
 * @swagger
 * /api/youtube/album/{albumId}:
 *   get:
 *     summary: Get album details from YouTube Music
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *         description: YouTube Music album ID
 *         example: MPREb_xyz123
 *     responses:
 *       200:
 *         description: Album details with track list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title: { type: string }
 *                 artist: { type: string }
 *                 year: { type: number }
 *                 thumbnail: { type: string }
 *                 tracks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       videoId: { type: string }
 *                       title: { type: string }
 *                       duration: { type: number }
 *       404:
 *         description: Album not found
 */
router.get('/album/:albumId', getAlbumDetails);

/**
 * @swagger
 * /api/youtube/lyrics/{videoId}:
 *   get:
 *     summary: Get lyrics for a YouTube song
 *     tags: [YouTube]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: YouTube video ID
 *         example: dQw4w9WgXcQ
 *     responses:
 *       200:
 *         description: Song lyrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lyrics: { type: string, example: Is this the real life?... }
 *                 source: { type: string, example: YouTube Music }
 *       404:
 *         description: Lyrics not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/lyrics/:videoId', getLyrics);

/**
 * @swagger
 * /api/youtube/health:
 *   get:
 *     summary: Check the health of the YouTube Music integration
 *     tags: [YouTube]
 *     responses:
 *       200:
 *         description: YouTube client is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 ytmusic: { type: string, example: connected }
 *       503:
 *         description: YouTube client is unavailable
 */
router.get('/health', healthCheck);

export default router;
