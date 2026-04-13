import { Router } from 'express';
import {
  downloadSong,
  downloadAlbum,
  getVideoInfo,
  getAvailableFormats,
  getDownloadStatus,
  getActiveDownloads,
  cancelDownload,
  cleanupFiles,
  getStreamingUrl,
  serveFile,
} from '../controller/download.controller.js';

const router = Router();

/**
 * @swagger
 * /api/download/song:
 *   post:
 *     summary: Start downloading a song from YouTube
 *     description: Initiates a yt-dlp download for the given YouTube video ID. Returns a downloadKey to poll for status.
 *     tags: [Download]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DownloadRequest'
 *     responses:
 *       202:
 *         description: Download started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 downloadKey: { type: string, example: dl_abc123 }
 *                 message: { type: string, example: Download started }
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Download rate limit exceeded
 */
router.post('/song', downloadSong);

/**
 * @swagger
 * /api/download/album:
 *   post:
 *     summary: Start downloading all songs in an album
 *     description: Initiates batch yt-dlp downloads for all songs in the album. Returns a downloadKey per song.
 *     tags: [Download]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [albumId, format]
 *             properties:
 *               albumId:
 *                 type: string
 *                 example: 64f1a2b3c4d5e6f7a8b9c0d2
 *               format:
 *                 type: string
 *                 enum: [mp3, flac, opus, aac]
 *                 example: mp3
 *               quality:
 *                 type: string
 *                 enum: [low, medium, high, best]
 *                 example: high
 *     responses:
 *       202:
 *         description: Album downloads started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 downloads:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       songId: { type: string }
 *                       downloadKey: { type: string }
 *       400:
 *         description: Invalid request
 *       429:
 *         description: Download rate limit exceeded
 */
router.post('/album', downloadAlbum);

/**
 * @swagger
 * /api/download/file/{filename}:
 *   get:
 *     summary: Serve a downloaded file to the browser
 *     description: Streams the file to the browser, triggering a download. Cleans up the file after serving.
 *     tags: [Download]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Filename returned in the download status
 *         example: bohemian-rhapsody.mp3
 *     responses:
 *       200:
 *         description: File stream
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/file/:filename', serveFile);

/**
 * @swagger
 * /api/download/info/{videoId}:
 *   get:
 *     summary: Get metadata for a YouTube video
 *     tags: [Download]
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
 *         description: Video metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title: { type: string }
 *                 duration: { type: number }
 *                 thumbnail: { type: string }
 *                 channel: { type: string }
 *       404:
 *         description: Video not found
 */
router.get('/info/:videoId', getVideoInfo);

/**
 * @swagger
 * /api/download/formats/{videoId}:
 *   get:
 *     summary: Get available download formats for a YouTube video
 *     tags: [Download]
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
 *         description: Available formats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   format: { type: string }
 *                   quality: { type: string }
 *                   filesize: { type: number }
 */
router.get('/formats/:videoId', getAvailableFormats);

/**
 * @swagger
 * /api/download/streaming/{videoId}:
 *   get:
 *     summary: Get a direct streaming URL for a YouTube video
 *     tags: [Download]
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
 *         description: Streaming URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string, example: https://rr4---sn-xyz.googlevideo.com/videoplayback?... }
 *                 expires: { type: string, format: date-time }
 *       404:
 *         description: Video not found
 */
router.get('/streaming/:videoId', getStreamingUrl);

/**
 * @swagger
 * /api/download/status/{downloadKey}:
 *   get:
 *     summary: Get the current status of a download
 *     tags: [Download]
 *     parameters:
 *       - in: path
 *         name: downloadKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Download key returned when starting a download
 *         example: dl_abc123
 *     responses:
 *       200:
 *         description: Download status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DownloadStatus'
 *       404:
 *         description: Download not found
 */
router.get('/status/:downloadKey', getDownloadStatus);

/**
 * @swagger
 * /api/download/active:
 *   get:
 *     summary: Get all active downloads
 *     tags: [Download]
 *     responses:
 *       200:
 *         description: Active downloads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DownloadStatus'
 */
router.get('/active', getActiveDownloads);

/**
 * @swagger
 * /api/download/cancel/{downloadKey}:
 *   delete:
 *     summary: Cancel an active download
 *     tags: [Download]
 *     parameters:
 *       - in: path
 *         name: downloadKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Download key to cancel
 *         example: dl_abc123
 *     responses:
 *       200:
 *         description: Download cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Download cancelled }
 *       404:
 *         description: Download not found
 */
router.delete('/cancel/:downloadKey', cancelDownload);

/**
 * @swagger
 * /api/download/cleanup:
 *   post:
 *     summary: Manually trigger cleanup of old downloaded files
 *     tags: [Download]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanHours:
 *                 type: number
 *                 description: Delete files older than this many hours
 *                 example: 2
 *     responses:
 *       200:
 *         description: Cleanup complete
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted: { type: number, example: 5 }
 *                 message: { type: string, example: Cleanup complete }
 */
router.post('/cleanup', cleanupFiles);

export default router;
