import path from 'path';
import fs from 'fs';
import downloadService from '../services/downloadService.js';
import { VALID_FORMATS } from '../lib/downloadFormats.js';
import {
  asyncHandler,
  ValidationError,
  ConflictError,
} from '../middleware/error.middleware.js';
import { logger } from '../lib/logger.js';

/**
 * Safely emit a Socket.IO event. The socket may be closed/invalid by the time
 * the download completes — swallow the error so it never crashes the handler.
 */
const safeEmit = (io, event, data) => {
  try {
    io.emit(event, data);
  } catch (err) {
    logger.warn({ err }, 'Failed to emit socket event');
  }
};

const createDownloadKey = (type, id, format, quality) => {
  return `${type}_${id}_${format}_${quality}`;
};

export const downloadSong = asyncHandler(async (req, res) => {
  const {
    videoId,
    format = 'audioonly',
    quality = 'highest',
    formatId,
  } = req.body;

  if (!videoId) {
    throw new ValidationError('videoId is required');
  }

  try {
    downloadService.validateFormat(format, 'song');
  } catch (err) {
    throw new ValidationError(err.message);
  }

  const downloadKey = createDownloadKey('song', videoId, format, quality);
  if (downloadService.getDownloadStatus(downloadKey)) {
    throw new ConflictError('Download already in progress');
  }

  downloadService.trackDownload(downloadKey, {
    type: 'song',
    videoId,
    format,
    quality,
    formatId,
  });

  try {
    const result = await downloadService.downloadSong(videoId, {
      format,
      quality,
      formatId,
      downloadKey,
      onProgress: (progress) => {
        if (req.io) {
          safeEmit(req.io, `download-progress-${videoId}`, {
            type: 'song',
            ...progress,
          });
        }
      },
    });

    downloadService.untrackDownload(downloadKey);

    if (req.io) {
      safeEmit(req.io, `download-complete-${videoId}`, {
        type: 'song',
        success: true,
        ...result,
      });
    }

    res.json({
      success: true,
      message: 'Song downloaded successfully',
      data: result,
    });
  } catch (downloadError) {
    downloadService.untrackDownload(downloadKey);
    throw downloadError;
  }
});

export const downloadAlbum = asyncHandler(async (req, res) => {
  const { albumId, format = 'mp3', quality = 'highest' } = req.body;

  if (!albumId) {
    throw new ValidationError('albumId is required');
  }

  try {
    downloadService.validateFormat(format, 'album');
  } catch (err) {
    throw new ValidationError(err.message);
  }

  const downloadKey = createDownloadKey('album', albumId, format, quality);
  if (downloadService.getDownloadStatus(downloadKey)) {
    throw new ConflictError('Album download already in progress');
  }

  downloadService.trackDownload(downloadKey, {
    type: 'album',
    albumId,
    format,
    quality,
  });

  try {
    const result = await downloadService.downloadAlbum(albumId, {
      format,
      quality,
      downloadKey,
      onProgress: (progress) => {
        if (req.io) {
          safeEmit(req.io, `album-progress-${albumId}`, {
            type: 'album',
            ...progress,
          });
        }
      },
    });

    downloadService.untrackDownload(downloadKey);

    if (req.io) {
      safeEmit(req.io, `album-complete-${albumId}`, {
        type: 'album',
        success: true,
        ...result,
      });
    }

    res.json({
      success: true,
      message: `Album downloaded: ${result.downloadedSongs}/${result.totalSongs} songs`,
      data: result,
    });
  } catch (downloadError) {
    downloadService.untrackDownload(downloadKey);
    throw downloadError;
  }
});

export const getVideoInfo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ValidationError('videoId is required');
  }

  const info = await downloadService.getVideoInfo(videoId);
  res.json({ success: true, data: info });
});

export const getAvailableFormats = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ValidationError('videoId is required');
  }

  const formats = await downloadService.getAvailableFormats(videoId);
  res.json({ success: true, data: formats });
});

export const getDownloadStatus = asyncHandler(async (req, res) => {
  const { downloadKey } = req.params;

  if (!downloadKey) {
    throw new ValidationError('downloadKey is required');
  }

  const status = downloadService.getDownloadStatus(downloadKey);
  if (!status) {
    return res.json({
      success: true,
      downloading: false,
      message: 'No active download found',
    });
  }

  res.json({
    success: true,
    downloading: true,
    ...status,
    duration: Date.now() - status.startTime.getTime(),
  });
});

export const getActiveDownloads = asyncHandler(async (req, res) => {
  const activeDownloads = downloadService.getActiveDownloads().map((entry) => ({
    ...entry,
    duration: Date.now() - entry.startTime.getTime(),
  }));

  res.json({ success: true, activeDownloads, count: activeDownloads.length });
});

export const cancelDownload = asyncHandler(async (req, res) => {
  const { downloadKey } = req.params;

  if (!downloadKey) {
    throw new ValidationError('downloadKey is required');
  }

  const wasActive = downloadService.cancelDownload(downloadKey);

  res.json({
    success: true,
    message: wasActive ? 'Download cancelled' : 'No active download found',
    cancelled: wasActive,
  });
});

export const cleanupFiles = asyncHandler(async (req, res) => {
  const { maxAgeHours = 24 } = req.query;
  await downloadService.cleanupOldFiles(parseInt(maxAgeHours));

  res.json({
    success: true,
    message: `Cleanup completed for files older than ${maxAgeHours} hours`,
  });
});

// Obtener URL de streaming directo (para evitar problemas de CORS con YouTube)
export const getStreamingUrl = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ValidationError('Video ID is required');
  }


  const streamingInfo = await downloadService.getStreamingUrl(videoId);

  res.json({
    success: true,
    videoId,
    ...streamingInfo,
  });
});

// Stream a downloaded file to the browser and clean it up afterwards
export const serveFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Prevent path traversal attacks
  if (!filename || filename.includes('..') || filename.includes('/')) {
    throw new ValidationError('Invalid filename');
  }

  const filePath = path.join(downloadService.downloadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { message: 'File not found or already downloaded' } });
  }

  // Set headers so the browser triggers a Save dialog
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  const stream = fs.createReadStream(filePath);

  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { message: 'Error reading file' } });
    }
  });

  // Delete file from server after successfully streaming it
  stream.on('close', () => {
    fs.unlink(filePath, () => {}); // best-effort cleanup
  });

  stream.pipe(res);
});


