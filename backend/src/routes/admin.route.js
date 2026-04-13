import { Router } from 'express';
import { checkAdmin, createAlbum, createSong, deleteAlbum, deleteSong, getUsers, toggleAdmin } from '../controller/admin.controller.js';
import { protectRoute, requireAdmin } from '../middleware/auth.middleware.js';
import { validateCreateSong, validateCreateAlbum } from '../middleware/validate.middleware.js';

const router = Router();

router.use(protectRoute, requireAdmin);

/**
 * @swagger
 * /api/admin/check:
 *   get:
 *     summary: Check if the current user is an admin
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Admin status confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 admin: { type: boolean, example: true }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden — not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/check', checkAdmin);

/**
 * @swagger
 * /api/admin/songs:
 *   post:
 *     summary: Create a new song (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, artist, duration]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Bohemian Rhapsody
 *               artist:
 *                 type: string
 *                 example: Queen
 *               duration:
 *                 type: number
 *                 example: 354
 *               albumId:
 *                 type: string
 *                 example: 64f1a2b3c4d5e6f7a8b9c0d2
 *               audioFile:
 *                 type: string
 *                 format: binary
 *               imageFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Song created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Song'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/songs', validateCreateSong, createSong);

/**
 * @swagger
 * /api/admin/songs/{id}:
 *   delete:
 *     summary: Delete a song by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the song
 *         example: 64f1a2b3c4d5e6f7a8b9c0d1
 *     responses:
 *       200:
 *         description: Song deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Song deleted successfully }
 *       404:
 *         description: Song not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete('/songs/:id', deleteSong);

/**
 * @swagger
 * /api/admin/albums:
 *   post:
 *     summary: Create a new album (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, artist, releaseYear]
 *             properties:
 *               title:
 *                 type: string
 *                 example: A Night at the Opera
 *               artist:
 *                 type: string
 *                 example: Queen
 *               releaseYear:
 *                 type: number
 *                 example: 1975
 *               imageFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Album created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Album'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/albums', validateCreateAlbum, createAlbum);

/**
 * @swagger
 * /api/admin/albums/{id}:
 *   delete:
 *     summary: Delete an album by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the album
 *         example: 64f1a2b3c4d5e6f7a8b9c0d2
 *     responses:
 *       200:
 *         description: Album deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Album deleted successfully }
 *       404:
 *         description: Album not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete('/albums/:id', deleteAlbum);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users', getUsers);

/**
 * @swagger
 * /api/admin/users/{id}/toggle-admin:
 *   patch:
 *     summary: Toggle admin status for a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the user
 *         example: 64f1a2b3c4d5e6f7a8b9c0d3
 *     responses:
 *       200:
 *         description: Admin status toggled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/users/:id/toggle-admin', toggleAdmin);

export default router;
