import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getInnertube } from '../lib/ytmusic.js';
import { logger } from '../lib/logger.js';

class DownloadService {
  constructor() {
    this.downloadsDir = path.join(process.cwd(), 'downloads');
    // Check Render Secret Files path first, fall back to local
    this.cookiesFile = process.env.YOUTUBE_COOKIES_PATH
      ?? '/etc/secrets/yt-cookies.txt';
    this.ffmpegAvailable = false;
    this.initPromise = this.init();
    /** @type {Map<string, import('child_process').ChildProcess>} */
    this._activeProcs = new Map(); // downloadKey → yt-dlp process
  }

  async init() {
    try {
      await fs.mkdir(this.downloadsDir, { recursive: true });

      // Render Secret Files are mounted read-only at /etc/secrets/.
      // yt-dlp tries to write updated cookies back after use → OSError on read-only fs.
      // Fix: copy the file to a writable path and use that instead.
      const writableCookiesPath = path.join(process.cwd(), 'yt-cookies.txt');
      try {
        await fs.access(this.cookiesFile);
        await fs.copyFile(this.cookiesFile, writableCookiesPath);
        this.cookiesFile = writableCookiesPath;
        logger.info({ path: writableCookiesPath }, 'YouTube cookies copied to writable location');
      } catch {
        // Secret file not present — check if a writable copy already exists
        try {
          await fs.access(writableCookiesPath);
          this.cookiesFile = writableCookiesPath;
          logger.info({ path: writableCookiesPath }, 'YouTube cookies found at writable location');
        } catch {
          logger.warn('No YouTube cookies file found — downloads may be blocked on cloud');
        }
      }

      // Auto-update yt-dlp — YouTube changes bot detection frequently
      // and the Docker-cached binary may be months old
      try {
        await this._runCmd('yt-dlp', ['-U']);
        logger.info('yt-dlp updated to latest version');
      } catch (err) {
        logger.warn({ err: err.message }, 'yt-dlp self-update failed, continuing with installed version');
      }

      await this._runYtDlp(['--version']);
      logger.info('yt-dlp is ready');

      // Check ffmpeg availability (always true in Docker, but let's verify)
      try {
        await this._runCmd('ffmpeg', ['-version']);
        this.ffmpegAvailable = true;
        logger.info('ffmpeg is available');
      } catch {
        logger.warn('ffmpeg not found — audio conversion disabled');
      }
    } catch (error) {
      logger.error({ err: error }, 'Download service initialization failed');
      throw error;
    }
  }

  async ensureInitialized() {
    await this.initPromise;
  }

  // ── Low-level helpers ─────────────────────────────────────────────────────────

  _runCmd(cmd, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
      });
      proc.on('error', reject);
    });
  }

  async _cookiesArgs() {
    try {
      await fs.access(this.cookiesFile);
      return ['--cookies', this.cookiesFile];
    } catch {
      return [];
    }
  }

  // mweb+web for downloads: mweb bypasses bot checks on datacenter IPs using cookies.
  // No client override for info/format listing: yt-dlp auto-selects (ios/tv_embedded)
  // which give proper DASH format IDs without PO token. Forcing 'web' requires a PO
  // token on datacenter IPs and returns "Requested format is not available". Forcing
  // 'mweb' returns HLS-only (no individual DASH format IDs).
  _ytDownloadArgs() {
    return ['--extractor-args', 'youtube:player_client=mweb,web'];
  }

  async _runYtDlp(args) {
    const cookiesArgs = await this._cookiesArgs();
    return this._runCmd('yt-dlp', [...cookiesArgs, ...this._ytDownloadArgs(), ...args]);
  }

  // Fetch video info as parsed JSON using --dump-json.
  // Uses mweb,web to bypass bot detection (same as downloads).
  // --no-check-formats skips the HTTP HEAD check yt-dlp does per-format which
  // triggers "Requested format is not available" on datacenter IPs even when the
  // format data itself is valid.
  async _getInfo(url) {
    const cookiesArgs = await this._cookiesArgs();
    const { stdout } = await this._runCmd('yt-dlp', [
      ...cookiesArgs,
      ...this._ytDownloadArgs(),
      '--no-check-formats',
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      url,
    ]);
    return JSON.parse(stdout.trim());
  }

  // Run a download with live progress parsing from yt-dlp stderr
  async _download(url, args, onProgress, downloadKey) {
    const cookiesArgs = await this._cookiesArgs();
    return new Promise((resolve, reject) => {
      const allArgs = [...cookiesArgs, ...this._ytDownloadArgs(), ...args, '--progress', '--newline', '--no-warnings', url];
      const proc = spawn('yt-dlp', allArgs);
      if (downloadKey) this._activeProcs.set(downloadKey, proc);
      let stderr = '';

      proc.stdout.on('data', () => {}); // stdout not needed during download

      proc.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;

        // Parse yt-dlp progress lines, e.g.:
        // [download]  25.2% of ~  4.30MiB at    3.52MiB/s ETA 00:00
        for (const line of text.split('\n')) {
          const match = line.match(
            /\[download\]\s+([\d.]+)%\s+of\s+([\d.~]+\s*\S+)\s+at\s+([\d.]+\s*\S+\/s)(?:\s+ETA\s+(\S+))?/
          );
          if (match) {
            onProgress?.({
              percent: parseFloat(match[1]),
              size: match[2].trim(),
              speed: match[3].trim(),
              eta: match[4]?.trim() ?? 'unknown',
            });
          }
        }
      });

      proc.on('close', (code) => {
        if (downloadKey) this._activeProcs.delete(downloadKey);
        if (code === 0 || code === null) resolve(); // null = killed intentionally
        else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      });
      proc.on('error', (err) => {
        if (downloadKey) this._activeProcs.delete(downloadKey);
        reject(err);
      });
    });
  }

  /** Kill the yt-dlp process for the given download key, if running. */
  killDownload(downloadKey) {
    const proc = this._activeProcs.get(downloadKey);
    if (proc) {
      proc.kill('SIGTERM');
      this._activeProcs.delete(downloadKey);
      return true;
    }
    return false;
  }

  // Translate our format/quality options to yt-dlp CLI format strings + extra args
  _buildCliFormat(format, quality, formatId) {
    // Specific format ID chosen by the user (from getAvailableFormats)
    if (formatId && formatId !== 'best' && formatId !== 'converted') {
      return { formatStr: formatId, extraArgs: [] };
    }

    switch (format) {
      case 'audioonly':
        return { formatStr: 'bestaudio[ext=m4a]/bestaudio', extraArgs: [] };

      case 'audioonly_mp3':
        return {
          formatStr: 'bestaudio',
          extraArgs: ['-x', '--audio-format', 'mp3', '--audio-quality', '0'],
        };

      case 'audioonly_flac':
        return {
          formatStr: 'bestaudio',
          extraArgs: ['-x', '--audio-format', 'flac'],
        };

      case 'audioonly_aac':
        return {
          formatStr: 'bestaudio[ext=m4a]/bestaudio',
          extraArgs: ['-x', '--audio-format', 'aac'],
        };

      case 'audioandvideo':
        return {
          formatStr:
            'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
          extraArgs: ['--merge-output-format', 'mp4'],
        };

      case 'videoonly':
        return {
          formatStr: 'bestvideo[ext=mp4]/bestvideo',
          extraArgs: ['--merge-output-format', 'mp4'],
        };

      default:
        return { formatStr: 'bestaudio[ext=m4a]/bestaudio', extraArgs: [] };
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  async downloadSong(videoId, options = {}) {
    await this.ensureInitialized();

    const {
      format = 'audioonly',
      quality = 'highest',
      formatId,
      onProgress,
      downloadKey,
    } = options;

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const info = await this._getInfo(videoUrl);
      const title = this.sanitizeFilename(info.title);
      const uploader = info.uploader || 'Unknown';
      const timestamp = Date.now();
      const outputTemplate = path.join(
        this.downloadsDir,
        `${title}_${timestamp}.%(ext)s`
      );

      const { formatStr, extraArgs } = this._buildCliFormat(format, quality, formatId);
      const args = ['-f', formatStr, '-o', outputTemplate, ...extraArgs];

      onProgress?.({ percent: 0, speed: 'unknown', size: 'unknown', eta: 'unknown' });
      await this._download(videoUrl, args, onProgress, downloadKey);
      onProgress?.({ percent: 100, speed: 'unknown', size: 'unknown', eta: '0' });

      // Find the downloaded file by title + timestamp
      const files = await fs.readdir(this.downloadsDir);
      const downloadedFile = files.find(
        (f) => f.includes(title) && f.includes(timestamp.toString())
      );

      if (!downloadedFile) {
        const cutoff = Date.now() - 5 * 60 * 1000;
        const recentFiles = (
          await Promise.all(
            files.map(async (f) => {
              try {
                const stats = await fs.stat(path.join(this.downloadsDir, f));
                return stats.mtimeMs > cutoff ? f : null;
              } catch {
                return null;
              }
            })
          )
        ).filter(Boolean);

        throw new Error(
          recentFiles.length > 0
            ? `Downloaded file not found. Recent files: ${recentFiles.join(', ')}`
            : 'Downloaded file not found and no recent files in directory'
        );
      }

      const filePath = path.join(this.downloadsDir, downloadedFile);
      const fileStats = await fs.stat(filePath);
      const qualityInfo = this._getQualityInfoFromFormats(format, info.formats || []);

      return {
        success: true,
        videoId,
        title: info.title,
        uploader,
        filename: downloadedFile,
        filePath,
        duration: info.duration || 0,
        format,
        quality: quality.toString(),
        size: fileStats.size,
        qualityInfo,
        downloadedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ err: error, videoId }, 'Download failed');
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async getAvailableFormats(videoId) {
    await this.ensureInitialized();

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const info = await this._getInfo(videoUrl);

      if (!info.formats || !Array.isArray(info.formats)) {
        return { audioFormats: [], videoFormats: [] };
      }

      const audioFormats = [];
      const videoFormats = [];

      // AUDIO FORMATS — prefer native .m4a (AAC) audio-only
      const audioOnlyFormats = info.formats.filter(
        (f) =>
          f.acodec &&
          f.acodec !== 'none' &&
          (!f.vcodec || f.vcodec === 'none') &&
          f.abr &&
          f.ext === 'm4a'
      );

      let audioSourceFormats = audioOnlyFormats;
      if (audioOnlyFormats.length === 0) {
        const m4aVideoFormats = info.formats.filter(
          (f) =>
            f.acodec &&
            f.acodec !== 'none' &&
            f.vcodec &&
            f.vcodec !== 'none' &&
            f.ext === 'mp4'
        );

        audioSourceFormats =
          m4aVideoFormats.length > 0
            ? m4aVideoFormats
            : info.formats.filter(
                (f) =>
                  f.acodec &&
                  f.acodec !== 'none' &&
                  f.vcodec &&
                  f.vcodec !== 'none'
              );
      }

      audioSourceFormats
        .sort((a, b) => (a.abr || 0) - (b.abr || 0))
        .forEach((f, index) => {
          const bitrate = f.abr ? Math.round(f.abr) : null;
          const codec = f.acodec || 'unknown';
          const filesize = f.filesize || f.filesize_approx || 0;
          const formatName = f.format_note || f.format || 'unknown';
          const isAudioOnly = audioOnlyFormats.length > 0;
          const bitrateDisplay = bitrate ? `${bitrate} kbps` : 'Variable';
          const qualityNote = f.height ? ` (from ${f.height}p video)` : '';

          audioFormats.push({
            id: `audio_${f.format_id}`,
            format: 'audioonly',
            quality: 'highest',
            formatId: f.format_id,
            label: `${codec.toUpperCase()} ${bitrateDisplay}${
              !isAudioOnly ? ' (extracted)' : ''
            }`,
            description: isAudioOnly
              ? formatName
              : `${formatName}${qualityNote} • Audio extracted from video`,
            codec,
            bitrate: bitrate || 'variable',
            sampleRate: f.asr || 'unknown',
            filesize,
            filesizeMB: this.bytesToMB(filesize),
            type: 'audio',
            native: isAudioOnly,
            qualityRank: index + 1,
            container: f.ext || 'unknown',
            extracted: !isAudioOnly,
          });
        });

      // Converted formats (only if ffmpeg is available)
      if (this.ffmpegAvailable && audioSourceFormats.length > 0) {
        const bestAudio = audioSourceFormats[audioSourceFormats.length - 1];
        const maxBitrate = bestAudio.abr ? Math.round(bestAudio.abr) : 128;

        audioFormats.push({
          id: 'converted_mp3',
          format: 'audioonly_mp3',
          quality: '0',
          formatId: 'converted',
          label: `MP3 ~${Math.round(maxBitrate * 0.8)} kbps`,
          description: 'Converted from best quality',
          codec: 'mp3',
          bitrate: Math.round(maxBitrate * 0.8),
          sampleRate: 'variable',
          filesize: 0,
          filesizeMB: '~' + this.estimateConvertedSize(maxBitrate, 'mp3'),
          type: 'audio',
          native: false,
          qualityRank: audioFormats.length + 1,
          container: 'mp3',
          note: 'Converted - no quality gain',
        });

        if (maxBitrate >= 128) {
          audioFormats.push({
            id: 'converted_flac',
            format: 'audioonly_flac',
            quality: '0',
            formatId: 'converted',
            label: 'FLAC Lossless',
            description: 'Converted from best quality',
            codec: 'flac',
            bitrate: 'Lossless',
            sampleRate: 'variable',
            filesize: 0,
            filesizeMB: '~' + this.estimateConvertedSize(maxBitrate, 'flac'),
            type: 'audio',
            native: false,
            qualityRank: audioFormats.length + 1,
            container: 'flac',
            note: 'Converted - larger file size',
          });
        }
      }

      // VIDEO FORMATS
      const videoWithAudioFormats = info.formats.filter(
        (f) =>
          f.vcodec &&
          f.vcodec !== 'none' &&
          f.height &&
          f.acodec &&
          f.acodec !== 'none'
      );

      const videoOnlyFormats = info.formats.filter(
        (f) =>
          f.vcodec &&
          f.vcodec !== 'none' &&
          f.height &&
          (!f.acodec || f.acodec === 'none')
      );

      if (videoWithAudioFormats.length > 0 || videoOnlyFormats.length > 0) {
        videoFormats.push({
          id: 'video_best',
          format: 'audioandvideo',
          quality: 'highest',
          formatId: 'best',
          label: 'Best Quality Available',
          description: 'Automatically select highest quality (video + audio)',
          resolution: 'Auto',
          fps: 'Auto',
          videoCodec: 'Auto',
          audioCodec: 'Auto',
          videoBitrate: 'Auto',
          audioBitrate: 'Auto',
          filesize: 0,
          filesizeMB: 'Variable',
          type: 'video',
          qualityRank: 0,
          container: 'mp4',
          native: true,
        });
      }

      videoWithAudioFormats
        .sort((a, b) => (a.height || 0) - (b.height || 0))
        .forEach((f, index) => {
          const height = f.height || 0;
          const width = f.width || 0;
          const fps = f.fps || 'unknown';
          const vcodec = f.vcodec || 'unknown';
          const acodec = f.acodec || 'unknown';
          const vbr = Math.round(f.vbr || 0);
          const abr = Math.round(f.abr || 0);
          const filesize = f.filesize || f.filesize_approx || 0;
          const formatName = f.format_note || f.format || 'unknown';

          videoFormats.push({
            id: `video_${f.format_id}`,
            format: 'audioandvideo',
            quality: 'highest',
            formatId: f.format_id,
            label: `${height}p (Combined)`,
            description: `${formatName} • ${fps} fps • ${vcodec.toUpperCase()}+${acodec.toUpperCase()}`,
            resolution: `${width}x${height}`,
            fps,
            videoCodec: vcodec,
            audioCodec: acodec,
            videoBitrate: vbr,
            audioBitrate: abr,
            filesize,
            filesizeMB: this.bytesToMB(filesize),
            type: 'video',
            qualityRank: index + 1,
            container: f.ext || 'mp4',
            native: true,
            combined: true,
          });
        });

      if (videoOnlyFormats.length > 0 && audioSourceFormats.length > 0) {
        const bestAudio = audioSourceFormats.reduce((best, current) =>
          (current.abr || 0) > (best.abr || 0) ? current : best
        );

        videoOnlyFormats
          .filter((f) => f.height >= 720)
          .sort((a, b) => (a.height || 0) - (b.height || 0))
          .forEach((f, index) => {
            const height = f.height || 0;
            const width = f.width || 0;
            const fps = f.fps || 'unknown';
            const vcodec = f.vcodec || 'unknown';
            const vbr = Math.round(f.vbr || 0);
            const filesize = f.filesize || f.filesize_approx || 0;
            const formatName = f.format_note || f.format || 'unknown';
            const bestAudioBitrate = Math.round(bestAudio.abr || 0);

            videoFormats.push({
              id: `video_dash_${f.format_id}`,
              format: 'audioandvideo',
              quality: 'highest',
              formatId: `${f.format_id}+${bestAudio.format_id}`,
              label: `${height}p (DASH)`,
              description: `${formatName} • ${fps} fps • ${vcodec.toUpperCase()}+${bestAudio.acodec.toUpperCase()} ${bestAudioBitrate}kbps`,
              resolution: `${width}x${height}`,
              fps,
              videoCodec: vcodec,
              audioCodec: bestAudio.acodec,
              videoBitrate: vbr,
              audioBitrate: bestAudioBitrate,
              filesize,
              filesizeMB: this.bytesToMB(filesize),
              type: 'video',
              qualityRank: videoFormats.length + index + 1,
              container: 'mp4',
              native: false,
              dash: true,
              note: 'High quality video + best audio combined',
            });
          });
      }

      // Simple formats: AV1 by resolution (or best per resolution as fallback)
      const simpleVideoFormats = [];
      const av1Formats = videoFormats.filter(
        (f) => f.videoCodec && f.videoCodec.toLowerCase().includes('av01')
      );

      const resolutionMap = new Map();
      av1Formats.forEach((format) => {
        const height = format.resolution
          ? parseInt(format.resolution.split('x')[1])
          : 0;
        if (height >= 360) {
          const key = `${height}p`;
          if (
            !resolutionMap.has(key) ||
            format.videoBitrate > (resolutionMap.get(key).videoBitrate || 0)
          ) {
            resolutionMap.set(key, {
              ...format,
              id: `simple_${format.id}`,
              label: `${height}p (AV1)`,
              description: `${height}p • AV1 codec • Best quality`,
              simple: true,
            });
          }
        }
      });

      Array.from(resolutionMap.values())
        .sort((a, b) => parseInt(a.label) - parseInt(b.label))
        .forEach((format) => simpleVideoFormats.push(format));

      if (simpleVideoFormats.length === 0) {
        const resolutionFallback = new Map();
        videoFormats.forEach((format) => {
          if (format.qualityRank > 0) {
            const height = format.resolution
              ? parseInt(format.resolution.split('x')[1])
              : 0;
            if (height >= 360) {
              const key = `${height}p`;
              if (
                !resolutionFallback.has(key) ||
                format.videoBitrate >
                  (resolutionFallback.get(key).videoBitrate || 0)
              ) {
                resolutionFallback.set(key, {
                  ...format,
                  id: `simple_${format.id}`,
                  label: `${height}p (${format.videoCodec.toUpperCase()})`,
                  description: `${height}p • ${format.videoCodec.toUpperCase()} codec`,
                  simple: true,
                });
              }
            }
          }
        });

        Array.from(resolutionFallback.values())
          .sort((a, b) => parseInt(a.label) - parseInt(b.label))
          .forEach((format) => simpleVideoFormats.push(format));
      }

      return {
        audioFormats,
        videoFormats,
        simpleVideoFormats,
        advancedVideoFormats: videoFormats,
      };
    } catch (error) {
      throw new Error(`Failed to get available formats: ${error.message}`);
    }
  }

  async downloadAlbum(albumId, options = {}) {
    await this.ensureInitialized();

    const { format = 'mp3', quality = 'highest', onProgress, downloadKey } = options;

    const yt = await getInnertube();
    const albumDetails = await yt.music.getAlbum(albumId);

    const albumTitle = albumDetails.header?.title?.text ?? albumId;
    const albumArtist =
      albumDetails.header?.strapline_text_one?.text ?? 'Unknown Artist';
    const songs = albumDetails.contents ?? [];

    if (songs.length === 0) {
      throw new Error(`No songs found for album: ${albumTitle}`);
    }

    const sanitizedTitle = this.sanitizeFilename(albumTitle);
    const albumDir = path.join(this.downloadsDir, sanitizedTitle);
    await fs.mkdir(albumDir, { recursive: true });

    const { formatStr, extraArgs } = this._buildCliFormat(format, quality, null);
    const results = [];
    const failed = [];

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const videoId = song.id;
      const songTitle = song.title ?? `Track ${i + 1}`;
      const position = i + 1;
      const paddedPos = String(position).padStart(2, '0');

      onProgress?.({
        currentSong: position,
        totalSongs: songs.length,
        currentSongTitle: songTitle,
        songProgress: 0,
        overallProgress: Math.round((i / songs.length) * 100),
        albumTitle,
        albumId,
        type: 'album',
      });

      try {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const timestamp = Date.now();
        const outputTemplate = path.join(
          albumDir,
          `${paddedPos}. ${this.sanitizeFilename(songTitle)}_${timestamp}.%(ext)s`
        );

        const args = ['-f', formatStr, '-o', outputTemplate, ...extraArgs];

        const songKey = downloadKey ? `${downloadKey}_song${i}` : undefined;
        await this._download(videoUrl, args, (progress) => {
          const percent = Math.max(0, Math.min(100, Number(progress?.percent ?? 0)));
          onProgress?.({
            currentSong: position,
            totalSongs: songs.length,
            currentSongTitle: songTitle,
            songProgress: percent,
            overallProgress: Math.round(
              ((i + percent / 100) / songs.length) * 100
            ),
            albumTitle,
            albumId,
            type: 'album',
          });
        }, songKey);

        const files = await fs.readdir(albumDir);
        const downloadedFile = files.find((f) => f.includes(timestamp.toString()));
        const filePath = downloadedFile
          ? path.join(albumDir, downloadedFile)
          : null;
        const fileSize = filePath ? (await fs.stat(filePath)).size : 0;

        results.push({
          success: true,
          videoId,
          title: songTitle,
          filename: downloadedFile ?? `${paddedPos}. ${songTitle}`,
          duration: song.duration?.seconds ?? 0,
          format: this.getFormatName({ filter: format }),
          quality: quality.toString(),
          size: fileSize,
        });
      } catch (err) {
        logger.error(
          { err, position, songTitle },
          'Failed to download album track'
        );
        failed.push({ position, title: songTitle, videoId, reason: err.message });
      }
    }

    onProgress?.({
      currentSong: songs.length,
      totalSongs: songs.length,
      currentSongTitle: '',
      songProgress: 100,
      overallProgress: 100,
      albumTitle,
      albumId,
      type: 'album',
      completed: true,
    });

    return {
      success: true,
      albumId,
      albumTitle,
      albumArtist,
      totalSongs: songs.length,
      downloadedSongs: results.length,
      failedSongs: failed.length,
      downloads: results,
      failed,
      format,
      quality: quality.toString(),
      albumPath: albumDir,
    };
  }

  async getVideoInfo(videoId) {
    await this.ensureInitialized();

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const info = await this._getInfo(videoUrl);
      return {
        id: info.id,
        title: info.title,
        duration: info.duration,
        uploader: info.uploader,
        description: info.description,
        thumbnail: info.thumbnail,
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async getStreamingUrl(videoId) {
    await this.ensureInitialized();

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const info = await this._getInfo(videoUrl);

      if (!info.formats || !Array.isArray(info.formats)) {
        throw new Error('No formats available');
      }

      const audioFormats = info.formats.filter(
        (f) =>
          f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
      );

      let bestFormat = null;

      if (audioFormats.length > 0) {
        bestFormat = audioFormats.reduce((best, current) =>
          (current.abr || 0) > (best.abr || 0) ? current : best
        );
      } else {
        const combinedFormats = info.formats.filter(
          (f) =>
            f.acodec && f.acodec !== 'none' && f.vcodec && f.vcodec !== 'none'
        );

        if (combinedFormats.length > 0) {
          bestFormat = combinedFormats.reduce((best, current) =>
            (current.abr || 0) > (best.abr || 0) ? current : best
          );
        }
      }

      if (!bestFormat || !bestFormat.url) {
        throw new Error('No valid streaming URL found');
      }

      return {
        url: bestFormat.url,
        title: info.title,
        duration: info.duration,
        bitrate: bestFormat.abr,
        codec: bestFormat.acodec,
        format: bestFormat.format_id,
        headers: bestFormat.http_headers || {},
      };
    } catch (error) {
      throw new Error(`Failed to get streaming URL: ${error.message}`);
    }
  }

  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.downloadsDir);
      const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.downloadsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          logger.info({ file }, 'Deleted old download file');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Cleanup error');
    }
  }

  // ── Format helpers ────────────────────────────────────────────────────────────

  getFormatConfig(format, quality) {
    switch (format) {
      case 'audioonly':
        return { filter: 'audioonly', quality: quality === 'highest' ? 'highest' : 'lowest' };
      case 'audioonly_mp3':
        return { filter: 'audioonly', type: 'mp3', quality: parseInt(quality) || 0 };
      case 'audioonly_flac':
        return { filter: 'audioonly', type: 'flac', quality: parseInt(quality) || 0 };
      case 'audioonly_aac':
        return { filter: 'audioonly', type: 'aac', quality: parseInt(quality) || 0 };
      case 'audioandvideo':
        return { filter: 'audioandvideo', quality: quality === 'highest' ? 'highest' : 'lowest', type: 'mp4' };
      case 'videoonly':
        return { filter: 'videoonly', quality: quality || 'highest', type: 'mp4' };
      default:
        return { filter: 'audioonly', quality: 'highest' };
    }
  }

  getFormatName(formatConfig) {
    if (formatConfig.filter === 'audioonly') return formatConfig.type || 'audio';
    if (formatConfig.filter === 'audioandvideo') return formatConfig.type || 'mp4';
    if (formatConfig.filter === 'videoonly') return formatConfig.type || 'mp4';
    return 'unknown';
  }

  _getQualityInfoFromFormats(format, formats) {
    const isAudio = format.startsWith('audioonly') || format === 'audioonly';

    if (isAudio) {
      const audioFormats = formats.filter(
        (f) =>
          f.acodec &&
          f.acodec !== 'none' &&
          (!f.vcodec || f.vcodec === 'none')
      );

      const best = audioFormats.reduce(
        (b, c) => ((c.abr || 0) > (b.abr || 0) ? c : b),
        { abr: 0, acodec: 'unknown', asr: 0 }
      );

      return {
        type: 'audio',
        bitrate: best.abr ? `${Math.round(best.abr)} kbps` : 'unknown',
        codec: best.acodec || 'unknown',
        sampleRate: best.asr ? `${best.asr} Hz` : 'unknown',
        quality: this.getAudioQualityRating(best.abr || 0),
      };
    }

    const videoFormats = formats.filter(
      (f) => f.vcodec && f.vcodec !== 'none' && f.height
    );

    const best = videoFormats.reduce(
      (b, c) => ((c.height || 0) > (b.height || 0) ? c : b),
      { height: 0, vcodec: 'unknown', fps: 0 }
    );

    return {
      type: 'video',
      resolution:
        best.width && best.height ? `${best.width}x${best.height}` : 'unknown',
      fps: best.fps ? `${best.fps} fps` : 'unknown',
      videoCodec: best.vcodec || 'unknown',
      quality: this.getVideoQualityRating(best.height || 0),
    };
  }

  getAudioQualityRating(bitrate) {
    if (bitrate >= 256) return 'Excellent (256+ kbps)';
    if (bitrate >= 192) return 'Very Good (192+ kbps)';
    if (bitrate >= 128) return 'Good (128+ kbps)';
    if (bitrate >= 96) return 'Standard (96+ kbps)';
    if (bitrate >= 64) return 'Low (64+ kbps)';
    return 'Very Low (<64 kbps)';
  }

  getVideoQualityRating(height) {
    if (height >= 2160) return '4K (2160p)';
    if (height >= 1440) return '2K (1440p)';
    if (height >= 1080) return 'Full HD (1080p)';
    if (height >= 720) return 'HD (720p)';
    if (height >= 480) return 'SD (480p)';
    return 'Low Quality (<480p)';
  }

  bytesToMB(bytes) {
    if (!bytes || bytes === 0) return null;
    return (bytes / (1024 * 1024)).toFixed(1);
  }

  estimateConvertedSize(originalBitrate, targetFormat) {
    const multipliers = { mp3: 1.2, flac: 4.0, aac: 1.0 };
    const multiplier = multipliers[targetFormat] || 1.0;
    const estimatedMB = originalBitrate * 0.0075 * multiplier;
    return estimatedMB.toFixed(1);
  }

  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }
}

export default new DownloadService();
