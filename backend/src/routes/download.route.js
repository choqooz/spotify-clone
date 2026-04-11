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

// Routes para descargas
router.post('/song', downloadSong);
router.post('/album', downloadAlbum);

// Serve file to browser (triggers browser download + cleans up)
router.get('/file/:filename', serveFile);

// Routes para información
router.get('/info/:videoId', getVideoInfo);
router.get('/formats/:videoId', getAvailableFormats);
router.get('/streaming/:videoId', getStreamingUrl);
router.get('/status/:downloadKey', getDownloadStatus);
router.get('/active', getActiveDownloads);

// Routes para gestión
router.delete('/cancel/:downloadKey', cancelDownload);
router.post('/cleanup', cleanupFiles);

export default router;
