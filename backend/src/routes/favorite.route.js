import { Router } from 'express';
import { getFavorites, addFavorite, removeFavorite, checkFavorite } from '../controller/favorite.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protectRoute);

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Get all favorite songs for the current user
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorite songs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Song'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getFavorites);

/**
 * @swagger
 * /api/favorites/{songId}/check:
 *   get:
 *     summary: Check if a song is in the current user's favorites
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song
 *         example: 64f1a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Favorite check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFavorite: { type: boolean, example: true }
 *       401:
 *         description: Unauthorized
 */
router.get('/:songId/check', checkFavorite);

/**
 * @swagger
 * /api/favorites/{songId}:
 *   post:
 *     summary: Add a song to favorites
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song to add
 *         example: 64f1a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       201:
 *         description: Song added to favorites
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Favorite'
 *       409:
 *         description: Song already in favorites
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Remove a song from favorites
 *     tags: [Favorites]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song to remove
 *         example: 64f1a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Song removed from favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Removed from favorites }
 *       404:
 *         description: Favorite not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 */
router.post('/:songId', addFavorite);
router.delete('/:songId', removeFavorite);

export default router;
