import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Utils } from 'youtubei.js';
import { getInnertube, getAuthedInnertube } from '../lib/ytmusic.js';
import { logger } from '../lib/logger.js';
import { VALID_FORMATS, isValidFormat } from '../lib/downloadFormats.js';

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
    /** @type {Map<string, ReadableStream<Uint8Array>>} */
    this._activeStreams = new Map(); // downloadKey → Innertube stream
    /**
     * Tracks in-flight downloads (metadata only — not the stream itself).
     * Moved here from download.controller.js so state lives in the service layer.
     * @type {Map<string, {type: string, startTime: Date, [key: string]: any}>}
     */
    this._downloadQueue = new Map();
  }

  // ── Download queue management ─────────────────────────────────────────────────

  /**
   * Returns the queue entry for a given downloadKey, or undefined if not found.
   * @param {string} downloadKey
   */
  getDownloadStatus(downloadKey) {
    return this._downloadQueue.get(downloadKey);
  }

  /**
   * Returns all active downloads as an array of { downloadKey, ...metadata }.
   */
  getActiveDownloads() {
    return Array.from(this._downloadQueue.entries()).map(([key, value]) => ({
      downloadKey: key,
      ...value,
    }));
  }

  /**
   * Removes the queue entry and kills any active stream/process for the key.
   * @param {string} downloadKey
   * @returns {boolean} true if there was an active download to cancel
   */
  cancelDownload(downloadKey) {
    const wasActive = this._downloadQueue.has(downloadKey);
    this._downloadQueue.delete(downloadKey);
    this.killDownload(downloadKey);
    return wasActive;
  }

  /**
   * Validates that `format` is allowed for the given download type.
   * Throws an Error with a human-readable message if invalid.
   * @param {string} format
   * @param {'song' | 'album'} type
   */
  validateFormat(format, type) {
    if (!isValidFormat(format, type)) {
      const valid = VALID_FORMATS[type]?.join(', ') ?? '';
      throw new Error(`Invalid format "${format}". Valid formats: ${valid}`);
    }
  }

  /**
   * Register a new download in the queue.
   * @param {string} downloadKey
   * @param {object} meta  — arbitrary metadata (type, videoId, format, etc.)
   */
  trackDownload(downloadKey, meta) {
    this._downloadQueue.set(downloadKey, { ...meta, startTime: new Date() });
  }

  /**
   * Remove a download from the queue (on success or error).
   * @param {string} downloadKey
   */
  untrackDownload(downloadKey) {
    this._downloadQueue.delete(downloadKey);
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

  // Fallback format options when streaming data is unavailable (datacenter IP blocked).
  // Uses generic yt-dlp format strings that resolve at download time with mweb+web+cookies.
  _defaultFormats() {
    return [
      { format_id: 'bestaudio', ext: 'm4a', acodec: 'aac', vcodec: 'none', abr: 128, vbr: 0, height: null, width: null, fps: null, filesize: 0, filesize_approx: 0, format_note: 'Best Audio', format: 'bestaudio - Best Audio' },
      { format_id: 'bestaudio', ext: 'webm', acodec: 'opus', vcodec: 'none', abr: 160, vbr: 0, height: null, width: null, fps: null, filesize: 0, filesize_approx: 0, format_note: 'Best Audio Opus', format: 'bestaudio - Best Audio Opus' },
      { format_id: 'best', ext: 'mp4', acodec: 'aac', vcodec: 'h264', abr: 128, vbr: 2000, height: 720, width: 1280, fps: 30, filesize: 0, filesize_approx: 0, format_note: '720p', format: 'best - 720p' },
    ];
  }

  // (Cookie parsing has been moved to lib/ytmusic.js → readCookieString())

  // Client priority for info/download. MWEB goes FIRST because on Render's
  // datacenter IP it's the only client whose signed stream URLs actually
  // fetch successfully — WEB lists AV1 up to 4K but its signed URLs require
  // a PO token and return 403 from datacenter IPs. MWEB provides H264 up
  // to 1080p + AAC, which covers the sensible quality range.
  // Listing and download MUST use the same order; otherwise the user picks
  // an itag from one client's set that doesn't exist in the download
  // client's set and chooseFormat silently falls back to the 360p default.
  static INNERTUBE_CLIENT_ORDER = ['MWEB', 'WEB_EMBEDDED', 'TV_EMBEDDED', 'WEB', 'ANDROID', 'IOS'];

  async _getInfoViaInnertube(videoId) {
    // Reuse the cached authed Innertube — creating a new one on every request
    // takes ~15s (fetches iframe_api, player JS, runs JsAnalyzer).
    const yt = await this._createAuthedInnertube();

    let info;
    let streamingData;
    for (const client of DownloadService.INNERTUBE_CLIENT_ORDER) {
      try {
        info = await yt.getInfo(videoId, { client });
        streamingData = info.streaming_data;
        if (streamingData) {
          logger.info({ videoId, client }, 'Got streaming data via Innertube');
          break;
        }
      } catch (err) {
        logger.warn({ videoId, client, err: err.message }, 'Innertube client failed');
      }
    }

    if (!streamingData) {
      // All clients failed — return default format options so user can still
      // download. yt-dlp with mweb+web+cookies may succeed at download time.
      const title = info?.basic_info?.title ?? 'Unknown';
      return {
        id: videoId,
        title,
        uploader: info?.basic_info?.author ?? 'Unknown',
        duration: info?.basic_info?.duration ?? 0,
        thumbnail: info?.basic_info?.thumbnail?.[0]?.url ?? '',
        formats: this._defaultFormats(),
      };
    }

    const formats = [];

    const mapFormat = (f) => {
      const mime = f.mime_type ?? '';
      const [typeContainer, codecStr] = mime.split(';');
      const [type, container] = (typeContainer ?? '').split('/');
      const codecs = (codecStr ?? '').replace(/.*codecs="?([^"]*)"?/, '$1').trim();
      const codecParts = codecs.split(',').map((c) => c.trim());
      const isAudio = type === 'audio';
      const isMuxed = codecParts.length > 1; // e.g. "avc1.42001E, mp4a.40.2"

      let ext = container ?? 'unknown';
      if (ext === 'mp4') ext = isAudio ? 'm4a' : 'mp4';

      return {
        format_id: String(f.itag),
        ext,
        acodec: isAudio ? codecParts[0] : (isMuxed ? codecParts[1] : 'none'),
        vcodec: isAudio ? 'none' : codecParts[0],
        abr: isAudio
          ? Math.round((f.bitrate ?? 0) / 1000)
          : (isMuxed ? Math.round((f.bitrate ?? 0) / 1000 * 0.1) : 0),
        vbr: isAudio ? 0 : Math.round((f.bitrate ?? 0) / 1000),
        asr: f.audio_sample_rate ? Number(f.audio_sample_rate) : undefined,
        height: f.height ?? null,
        width: f.width ?? null,
        fps: f.fps ?? null,
        filesize: f.content_length ? Number(f.content_length) : 0,
        filesize_approx: f.content_length ? Number(f.content_length) : 0,
        format_note: f.quality_label ?? f.audio_quality ?? '',
        format: `${f.itag} - ${f.quality_label ?? f.audio_quality ?? 'unknown'}`,
      };
    };

    // Muxed formats (video+audio combined)
    for (const f of streamingData.formats ?? []) {
      formats.push(mapFormat(f));
    }
    // Adaptive formats (separate video-only / audio-only)
    for (const f of streamingData.adaptive_formats ?? []) {
      formats.push(mapFormat(f));
    }

    return {
      id: info.basic_info?.id ?? videoId,
      title: info.basic_info?.title ?? 'Unknown',
      uploader: info.basic_info?.author ?? 'Unknown',
      duration: info.basic_info?.duration ?? 0,
      thumbnail: info.basic_info?.thumbnail?.[0]?.url ?? '',
      formats,
    };
  }

  // Fetch video info via Innertube directly.
  // yt-dlp ALWAYS fails on Render datacenter IPs — the yt-dlp-first path
  // was dead control flow in production and has been removed.
  async _getInfo(url) {
    const videoId = url.match(/[?&]v=([^&]+)/)?.[1] ?? url.split('/').pop();
    return this._getInfoViaInnertube(videoId);
  }

  /** Kill the active download for the given key (yt-dlp proc or Innertube stream). */
  killDownload(downloadKey) {
    let killed = false;
    const proc = this._activeProcs.get(downloadKey);
    if (proc) {
      proc.kill('SIGTERM');
      this._activeProcs.delete(downloadKey);
      killed = true;
    }
    const stream = this._activeStreams.get(downloadKey);
    if (stream) {
      try { stream.cancel?.(); } catch { /* noop */ }
      this._activeStreams.delete(downloadKey);
      killed = true;
    }
    return killed;
  }

  // ── Innertube download path ──────────────────────────────────────────────────
  // yt-dlp is fundamentally blocked on datacenter IPs (Render). Use youtubei.js
  // to call YouTube's InnerTube API directly — same auth path the Android/iOS
  // apps use. Returns raw streams; ffmpeg handles MP3/FLAC conversion after.

  _mapToInnertubeOptions(format) {
    switch (format) {
      case 'audioonly':
      case 'audioonly_aac':
      case 'audioonly_m4a':
      case 'audioonly_mp3':
      case 'audioonly_flac':
      case 'audioonly_wav':
        return { type: 'audio', quality: 'best', format: 'mp4' }; // → m4a
      case 'audioonly_opus':
        return { type: 'audio', quality: 'best', format: 'webm' };
      case 'audioandvideo':
        return { type: 'video+audio', quality: 'best', format: 'mp4' };
      case 'videoonly':
        return { type: 'video', quality: 'best', format: 'mp4' };
      default:
        return { type: 'audio', quality: 'best', format: 'mp4' };
    }
  }

  _audioConversionTarget(format) {
    if (format === 'audioonly_mp3') return 'mp3';
    if (format === 'audioonly_flac') return 'flac';
    if (format === 'audioonly_wav') return 'wav';
    return null;
  }

  _tempExtForFormat(format) {
    if (format === 'audioonly_opus') return 'webm';
    if (format === 'audioandvideo' || format === 'videoonly') return 'mp4';
    return 'm4a'; // all audio variants get demuxed from mp4 container
  }

  async _convertWithFfmpeg(inputFile, outputFile, targetFormat) {
    const args = ['-y', '-i', inputFile];
    if (targetFormat === 'mp3') args.push('-vn', '-c:a', 'libmp3lame', '-q:a', '0');
    else if (targetFormat === 'flac') args.push('-vn', '-c:a', 'flac');
    else if (targetFormat === 'wav') args.push('-vn', '-c:a', 'pcm_s16le');
    args.push(outputFile);
    await this._runCmd('ffmpeg', args);
    return outputFile;
  }

  // Delegate to the shared lib/ytmusic.js singleton — single source of truth.
  // Passes the resolved (writable) cookies path established during init().
  _createAuthedInnertube() {
    return getAuthedInnertube(this.cookiesFile);
  }

  // Parse the formatId from the frontend. Examples: "140" → single itag,
  // "399+140" → video+audio pair (DASH), "bestaudio" / "best" → no itag.
  _parseFormatId(formatId) {
    if (!formatId || formatId === 'best' || formatId === 'bestaudio' || formatId === 'converted') {
      return { kind: 'generic' };
    }
    if (formatId.includes('+')) {
      const [v, a] = formatId.split('+').map((s) => Number(s.trim()));
      if (Number.isFinite(v) && Number.isFinite(a)) return { kind: 'dash', videoItag: v, audioItag: a };
    }
    const itag = Number(formatId);
    if (Number.isFinite(itag)) return { kind: 'single', itag };
    return { kind: 'generic' };
  }

  // Stream an Innertube ReadableStream to a file with progress events.
  async _streamToFile(stream, filePath, { contentLength = 0, onProgress, downloadKey } = {}) {
    if (downloadKey) this._activeStreams.set(downloadKey, stream);
    const fileStream = createWriteStream(filePath);
    const sizeStr = contentLength > 0 ? `${(contentLength / 1048576).toFixed(2)}MB` : 'unknown';
    let downloaded = 0;
    let lastEmit = 0;
    const startTs = Date.now();
    try {
      for await (const chunk of Utils.streamToIterable(stream)) {
        if (!fileStream.write(chunk)) {
          await new Promise((resolve) => fileStream.once('drain', resolve));
        }
        downloaded += chunk.length;
        const now = Date.now();
        if (now - lastEmit > 250) {
          lastEmit = now;
          const elapsed = (now - startTs) / 1000;
          const speed = elapsed > 0 ? `${(downloaded / elapsed / 1048576).toFixed(2)}MB/s` : 'unknown';
          const percent = contentLength > 0 ? Math.min(99, (downloaded / contentLength) * 100) : 0;
          onProgress?.({ percent, size: sizeStr, speed, eta: 'unknown' });
        }
      }
      fileStream.end();
      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });
    } catch (err) {
      fileStream.destroy();
      await fs.unlink(filePath).catch(() => {});
      throw err;
    } finally {
      if (downloadKey) this._activeStreams.delete(downloadKey);
    }
  }

  // Merge a video-only and an audio-only file into a single mp4 using ffmpeg.
  async _ffmpegMerge(videoFile, audioFile, outputFile) {
    await this._runCmd('ffmpeg', [
      '-y', '-i', videoFile, '-i', audioFile,
      '-c:v', 'copy', '-c:a', 'copy',
      '-movflags', '+faststart',
      outputFile,
    ]);
    return outputFile;
  }

  // Download DASH streams (video-only + audio-only) and mux with ffmpeg.
  // Called by _downloadViaInnertube() when the user selected a "videoItag+audioItag" pair.
  // This is the ONLY way to get > 360p for combined downloads on YouTube since
  // muxed formats above 360p are rare/deprecated.
  async _downloadViaDash(info, parsed, { title, timestamp, onProgress, downloadKey }) {
    if (!this.ffmpegAvailable) {
      throw new Error('ffmpeg is required to merge DASH video+audio streams');
    }

    const videoFmt = info.chooseFormat({ itag: parsed.videoItag });
    const audioFmt = info.chooseFormat({ itag: parsed.audioItag });
    const videoLen = Number(videoFmt?.content_length ?? 0);
    const audioLen = Number(audioFmt?.content_length ?? 0);
    const totalLen = videoLen + audioLen;

    const videoTmp = path.join(this.downloadsDir, `${title}_${timestamp}.v.mp4`);
    const audioTmp = path.join(this.downloadsDir, `${title}_${timestamp}.a.m4a`);
    const outputFile = path.join(this.downloadsDir, `${title}_${timestamp}.mp4`);

    onProgress?.({ percent: 0, size: `${(totalLen / 1048576).toFixed(2)}MB`, speed: 'unknown', eta: 'unknown' });

    // Download video stream (0–70% of progress bar)
    const videoStream = await info.download({ type: 'video', quality: 'best', format: 'mp4', itag: parsed.videoItag });
    await this._streamToFile(videoStream, videoTmp, {
      contentLength: videoLen,
      downloadKey,
      onProgress: (p) => onProgress?.({ ...p, percent: (p.percent ?? 0) * 0.7 }),
    });

    // Download audio stream (70–95%)
    const audioStream = await info.download({ type: 'audio', quality: 'best', format: 'mp4', itag: parsed.audioItag });
    await this._streamToFile(audioStream, audioTmp, {
      contentLength: audioLen,
      downloadKey,
      onProgress: (p) => onProgress?.({ ...p, percent: 70 + (p.percent ?? 0) * 0.25 }),
    });

    // Mux (95–100%)
    onProgress?.({ percent: 96, size: `${(totalLen / 1048576).toFixed(2)}MB`, speed: 'muxing', eta: 'unknown' });
    await this._ffmpegMerge(videoTmp, audioTmp, outputFile);
    await Promise.all([
      fs.unlink(videoTmp).catch(() => {}),
      fs.unlink(audioTmp).catch(() => {}),
    ]);

    return { filePath: outputFile, filename: path.basename(outputFile), info };
  }

  // Download a video via Innertube. Tries multiple clients to bypass bot
  // detection on datacenter IPs. Streams to disk with progress events.
  async _downloadViaInnertube(videoId, options = {}) {
    const { format = 'audioonly', formatId, onProgress, downloadKey } = options;
    const yt = await this._createAuthedInnertube();

    // Use the SAME client priority as format listing. If the user picked a
    // specific itag, we iterate until we find a client whose streaming_data
    // actually contains that itag — otherwise chooseFormat falls back to the
    // 360p default and the user gets a low-quality download despite picking
    // high quality in the dialog.
    const wantedItag = formatId ? this._parseFormatId(formatId) : { kind: 'generic' };
    const requiredItags = wantedItag.kind === 'dash'
      ? [wantedItag.videoItag, wantedItag.audioItag]
      : wantedItag.kind === 'single'
        ? [wantedItag.itag]
        : [];

    const hasAllItags = (streamingData) => {
      if (requiredItags.length === 0) return true;
      const all = [...(streamingData.formats ?? []), ...(streamingData.adaptive_formats ?? [])];
      const available = new Set(all.map((f) => f.itag));
      return requiredItags.every((t) => available.has(t));
    };

    let info;
    let lastErr;
    for (const client of DownloadService.INNERTUBE_CLIENT_ORDER) {
      try {
        const candidate = await yt.getInfo(videoId, { client });
        if (!candidate?.streaming_data) continue;
        if (!hasAllItags(candidate.streaming_data)) {
          logger.info({ videoId, client, requiredItags }, 'Client OK but missing requested itags, trying next');
          info = info ?? candidate; // remember in case no client has the itag
          continue;
        }
        info = candidate;
        logger.info({ videoId, client, requiredItags }, 'Innertube info OK for download');
        break;
      } catch (err) {
        lastErr = err;
        logger.warn({ videoId, client, err: err.message }, 'Innertube getInfo failed');
      }
    }
    if (!info?.streaming_data) {
      throw new Error(`Innertube failed to fetch streaming data: ${lastErr?.message ?? 'no streaming data'}`);
    }

    const title = this.sanitizeFilename(info.basic_info?.title ?? videoId);
    const timestamp = Date.now();
    const parsed = this._parseFormatId(formatId);

    // ─── DASH path: user chose "videoItag+audioItag" from the dialog ─────────
    if (parsed.kind === 'dash') {
      return this._downloadViaDash(info, parsed, { title, timestamp, onProgress, downloadKey });
    }

    // ─── Single-stream path ──────────────────────────────────────────────────
    // User chose a specific itag (e.g. 140 for AAC audio) or no formatId at
    // all. We respect the itag if given, otherwise fall back to generic
    // type/quality selection from format name.
    const dlOpts = this._mapToInnertubeOptions(format);
    if (parsed.kind === 'single') dlOpts.itag = parsed.itag;

    let contentLength = 0;
    try {
      const fmt = info.chooseFormat({ ...dlOpts });
      contentLength = Number(fmt?.content_length ?? 0);
    } catch (err) {
      logger.warn({ err: err.message }, 'chooseFormat failed, progress will be size-less');
    }

    const tempExt = this._tempExtForFormat(format);
    const tempFile = path.join(this.downloadsDir, `${title}_${timestamp}.${tempExt}`);
    const stream = await info.download(dlOpts);
    await this._streamToFile(stream, tempFile, { contentLength, onProgress, downloadKey });

    // Optional ffmpeg conversion (mp3/flac/wav)
    const conversionTarget = this._audioConversionTarget(format);
    let finalFile = tempFile;
    if (conversionTarget) {
      if (!this.ffmpegAvailable) {
        logger.warn({ format }, 'ffmpeg unavailable, skipping conversion — returning raw m4a');
      } else {
        const convertedFile = path.join(this.downloadsDir, `${title}_${timestamp}.${conversionTarget}`);
        try {
          await this._convertWithFfmpeg(tempFile, convertedFile, conversionTarget);
          await fs.unlink(tempFile).catch(() => {});
          finalFile = convertedFile;
        } catch (err) {
          logger.error({ err: err.message }, 'ffmpeg conversion failed, returning raw file');
        }
      }
    }

    const finalSize = contentLength > 0 ? `${(contentLength / 1048576).toFixed(2)}MB` : 'unknown';
    onProgress?.({ percent: 100, size: finalSize, speed: 'done', eta: '0' });

    return {
      filePath: finalFile,
      filename: path.basename(finalFile),
      info,
    };
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

    try {
      const { filePath, filename, info } = await this._downloadViaInnertube(videoId, {
        format,
        formatId,
        onProgress,
        downloadKey,
      });

      const fileStats = await fs.stat(filePath);
      const title = info.basic_info?.title ?? 'Unknown';
      const uploader = info.basic_info?.author ?? 'Unknown';
      const duration = info.basic_info?.duration ?? 0;

      // Build a yt-dlp-shaped format list from Innertube streaming_data so the
      // existing quality-info helper keeps working unchanged.
      const ytdlpFormats = [];
      const sd = info.streaming_data;
      if (sd) {
        const all = [...(sd.formats ?? []), ...(sd.adaptive_formats ?? [])];
        for (const f of all) {
          const mime = f.mime_type ?? '';
          const isAudio = mime.startsWith('audio/');
          ytdlpFormats.push({
            format_id: String(f.itag),
            acodec: isAudio ? 'aac' : 'none',
            vcodec: isAudio ? 'none' : 'h264',
            abr: isAudio ? Math.round((f.bitrate ?? 0) / 1000) : 0,
            vbr: isAudio ? 0 : Math.round((f.bitrate ?? 0) / 1000),
            asr: f.audio_sample_rate ? Number(f.audio_sample_rate) : 0,
            height: f.height ?? null,
            width: f.width ?? null,
            fps: f.fps ?? null,
          });
        }
      }
      const qualityInfo = this._getQualityInfoFromFormats(format, ytdlpFormats);

      return {
        success: true,
        videoId,
        title,
        uploader,
        filename,
        filePath,
        duration,
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

  // ── getAvailableFormats sub-methods ──────────────────────────────────────────

  /**
   * Extract and build audio format entries from raw format list.
   * Returns { audioFormats, audioSourceFormats } so callers can use
   * audioSourceFormats for DASH pairing logic.
   */
  _getAudioFormats(formats) {
    const audioFormats = [];

    // Prefer native .m4a (AAC) audio-only streams
    const audioOnlyFormats = formats.filter(
      (f) =>
        f.acodec &&
        f.acodec !== 'none' &&
        (!f.vcodec || f.vcodec === 'none') &&
        f.abr &&
        f.ext === 'm4a'
    );

    let audioSourceFormats = audioOnlyFormats;
    if (audioOnlyFormats.length === 0) {
      const m4aVideoFormats = formats.filter(
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
          : formats.filter(
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

    return { audioFormats, audioSourceFormats };
  }

  /**
   * Build combined (muxed) video format entries.
   * Returns videoFormats array with a "best" sentinel + individual combined streams.
   */
  _getVideoFormats(formats) {
    const videoFormats = [];

    const videoWithAudioFormats = formats.filter(
      (f) =>
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.height &&
        f.acodec &&
        f.acodec !== 'none'
    );

    const videoOnlyFormats = formats.filter(
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

    return { videoFormats, videoOnlyFormats };
  }

  /**
   * Build DASH format entries (video-only + best audio paired).
   * Mutates videoFormats in-place by appending DASH entries.
   */
  _getDashFormats(formats, videoFormats, audioSourceFormats) {
    const videoOnlyFormats = formats.filter(
      (f) =>
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.height &&
        (!f.acodec || f.acodec === 'none')
    );

    if (videoOnlyFormats.length === 0 || audioSourceFormats.length === 0) return;

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

  /**
   * Build simple/fallback format list: AV1 by resolution, or best-per-resolution fallback.
   * Returns simpleVideoFormats array.
   */
  _getSimpleFormats(videoFormats) {
    const simpleVideoFormats = [];

    // Prefer AV1 formats grouped by resolution
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

    // Fallback: best format per resolution (any codec)
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

    return simpleVideoFormats;
  }

  async getAvailableFormats(videoId) {
    await this.ensureInitialized();

    try {
      // Use Innertube for format listing — yt-dlp's --dump-json requires
      // format selection which fails on datacenter IPs.
      const info = await this._getInfoViaInnertube(videoId);

      if (!info.formats || !Array.isArray(info.formats)) {
        return { audioFormats: [], videoFormats: [] };
      }

      const { audioFormats, audioSourceFormats } = this._getAudioFormats(info.formats);
      const { videoFormats } = this._getVideoFormats(info.formats);
      this._getDashFormats(info.formats, videoFormats, audioSourceFormats);
      const simpleVideoFormats = this._getSimpleFormats(videoFormats);

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
        const songKey = downloadKey ? `${downloadKey}_song${i}` : undefined;
        const { filePath: tmpPath, filename: tmpName } = await this._downloadViaInnertube(
          videoId,
          {
            format,
            downloadKey: songKey,
            onProgress: (progress) => {
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
            },
          }
        );

        // Move file into the album directory with the position prefix
        const ext = path.extname(tmpName);
        const finalName = `${paddedPos}. ${this.sanitizeFilename(songTitle)}${ext}`;
        const finalPath = path.join(albumDir, finalName);
        await fs.rename(tmpPath, finalPath);
        const fileSize = (await fs.stat(finalPath)).size;

        results.push({
          success: true,
          videoId,
          title: songTitle,
          filename: finalName,
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
