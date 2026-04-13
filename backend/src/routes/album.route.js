import { Router } from "express";
import { getAlbumById, getAllAlbums } from "../controller/album.controller.js";

const router = Router();

/**
 * @swagger
 * /api/albums:
 *   get:
 *     summary: Get all albums
 *     tags: [Albums]
 *     responses:
 *       200:
 *         description: List of all albums
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Album'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", getAllAlbums);

/**
 * @swagger
 * /api/albums/{albumId}:
 *   get:
 *     summary: Get an album by ID (with its songs)
 *     tags: [Albums]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the album
 *         example: 64f1a2b3c4d5e6f7a8b9c0d2
 *     responses:
 *       200:
 *         description: Album with populated songs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Album'
 *       404:
 *         description: Album not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:albumId", getAlbumById);

export default router;
