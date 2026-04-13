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

/**
 * @swagger
 * /api/songs/search:
 *   get:
 *     summary: Search songs by title or artist
 *     tags: [Songs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (matches title or artist)
 *         example: Queen
 *     responses:
 *       200:
 *         description: Matching songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       400:
 *         description: Missing search query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 */
router.get('/search', protectRoute, searchSongs);

/**
 * @swagger
 * /api/songs:
 *   get:
 *     summary: Get all songs (admin only)
 *     tags: [Songs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All songs in the database
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not an admin
 */
router.get('/', protectRoute, requireAdmin, getAllSongs);

/**
 * @swagger
 * /api/songs/featured:
 *   get:
 *     summary: Get a random selection of 6 featured songs
 *     tags: [Songs]
 *     responses:
 *       200:
 *         description: Featured songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       500:
 *         description: Server error
 */
router.get('/featured', getFeaturedSongs);

/**
 * @swagger
 * /api/songs/made-for-you:
 *   get:
 *     summary: Get a random selection of 4 songs for the "Made for You" section
 *     tags: [Songs]
 *     responses:
 *       200:
 *         description: Made for you songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       500:
 *         description: Server error
 */
router.get('/made-for-you', getMadeForYouSongs);

/**
 * @swagger
 * /api/songs/trending:
 *   get:
 *     summary: Get a random selection of 4 trending songs
 *     tags: [Songs]
 *     responses:
 *       200:
 *         description: Trending songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       500:
 *         description: Server error
 */
router.get('/trending', getTrendingSongs);

export default router;
