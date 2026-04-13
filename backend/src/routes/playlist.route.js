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

/**
 * @swagger
 * /api/playlists:
 *   get:
 *     summary: Get all playlists for the current user
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User's playlists
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Playlist'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create a new playlist
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: My Rock Collection
 *               description:
 *                 type: string
 *                 maxLength: 300
 *                 example: Best rock songs ever
 *               imageUrl:
 *                 type: string
 *                 example: https://example.com/playlist.jpg
 *               isPublic:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Playlist created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Playlist'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getMyPlaylists);
router.post('/', createPlaylist);

/**
 * @swagger
 * /api/playlists/{id}:
 *   get:
 *     summary: Get a playlist by ID (with populated songs)
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the playlist
 *         example: 64f1a2b3c4d5e6f7a8b9c0d5
 *     responses:
 *       200:
 *         description: Playlist with populated songs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Playlist'
 *       404:
 *         description: Playlist not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update a playlist's metadata
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f1a2b3c4d5e6f7a8b9c0d5
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Playlist Name
 *               description:
 *                 type: string
 *                 example: Updated description
 *               imageUrl:
 *                 type: string
 *                 example: https://example.com/new-cover.jpg
 *               isPublic:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Playlist updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Playlist'
 *       404:
 *         description: Playlist not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete a playlist
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 64f1a2b3c4d5e6f7a8b9c0d5
 *     responses:
 *       200:
 *         description: Playlist deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Playlist deleted }
 *       404:
 *         description: Playlist not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getPlaylistById);
router.patch('/:id', updatePlaylist);
router.delete('/:id', deletePlaylist);

/**
 * @swagger
 * /api/playlists/{id}/songs/{songId}:
 *   post:
 *     summary: Add a song to a playlist
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the playlist
 *         example: 64f1a2b3c4d5e6f7a8b9c0d5
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song
 *         example: 64f1a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Song added to playlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Playlist'
 *       404:
 *         description: Playlist or song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Remove a song from a playlist
 *     tags: [Playlists]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the playlist
 *         example: 64f1a2b3c4d5e6f7a8b9c0d5
 *       - in: path
 *         name: songId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song
 *         example: 64f1a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Song removed from playlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Playlist'
 *       404:
 *         description: Playlist not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/songs/:songId', addSongToPlaylist);
router.delete('/:id/songs/:songId', removeSongFromPlaylist);

export default router;
