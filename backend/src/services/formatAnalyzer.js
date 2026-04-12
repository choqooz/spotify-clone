/**
 * FormatAnalyzer — format detection, classification, and quality rating.
 *
 * Responsible for converting raw format lists (from Innertube / yt-dlp) into
 * the structured audio/video format objects that the download dialog renders.
 *
 * Pure utility functions are exported as named exports at the bottom of the
 * file so unit tests can import them without instantiating FormatAnalyzer.
 */

// ── Format analysis constants ─────────────────────────────────────────────────

/** Audio bitrate quality thresholds in kbps */
const BITRATE_TIERS = { HIGH: 256, MEDIUM: 192, STANDARD: 128, LOW: 96, MINIMUM: 64 };

/** Video resolution quality thresholds in pixels (height) */
const RESOLUTION_TIERS = { UHD: 2160, QHD: 1440, FHD: 1080, HD: 720, SD: 480 };

/** Reduction factor applied to source bitrate when estimating converted MP3 size */
const MP3_SIZE_REDUCTION = 0.8;

/** Multipliers for estimating output file size per codec relative to source */
const CODEC_SIZE_MULTIPLIERS = { mp3: 1.2, flac: 4.0, aac: 1.0 };

class FormatAnalyzer {
  /**
   * @param {{ getInfo: (videoId: string) => Promise<object>, ffmpegAvailable: boolean }} deps
   */
  constructor({ getInfo, ffmpegAvailable }) {
    this._getInfo = getInfo;
    this.ffmpegAvailable = ffmpegAvailable;
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
      (f) => isAudioOnlyFormat(f) && f.abr && f.ext === 'm4a'
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
          filesizeMB: bytesToMB(filesize),
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
        label: `MP3 ~${Math.round(maxBitrate * MP3_SIZE_REDUCTION)} kbps`,
        description: 'Converted from best quality',
        codec: 'mp3',
        bitrate: Math.round(maxBitrate * MP3_SIZE_REDUCTION),
        sampleRate: 'variable',
        filesize: 0,
        filesizeMB: '~' + estimateConvertedSize(maxBitrate, 'mp3'),
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
          filesizeMB: '~' + estimateConvertedSize(maxBitrate, 'flac'),
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
          filesizeMB: bytesToMB(filesize),
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
          filesizeMB: bytesToMB(filesize),
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

  /**
   * Analyse the quality of the best stream available for a given format string.
   * @param {string} format
   * @param {object[]} formats  — yt-dlp-shaped format list
   */
  _getQualityInfoFromFormats(format, formats) {
    const isAudio = format.startsWith('audioonly') || format === 'audioonly';

    if (isAudio) {
      const audioFormats = formats.filter((f) => isAudioOnlyFormat(f));

      const best = audioFormats.reduce(
        (b, c) => ((c.abr || 0) > (b.abr || 0) ? c : b),
        { abr: 0, acodec: 'unknown', asr: 0 }
      );

      return {
        type: 'audio',
        bitrate: best.abr ? `${Math.round(best.abr)} kbps` : 'unknown',
        codec: best.acodec || 'unknown',
        sampleRate: best.asr ? `${best.asr} Hz` : 'unknown',
        quality: getAudioQualityRating(best.abr || 0),
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
      quality: getVideoQualityRating(best.height || 0),
    };
  }

  /**
   * Fetch available formats for a video and classify them into audio/video buckets.
   * @param {string} videoId
   * @returns {Promise<{ audioFormats: object[], videoFormats: object[], simpleVideoFormats: object[], advancedVideoFormats: object[] }>}
   */
  async getAvailableFormats(videoId) {
    try {
      const info = await this._getInfo(videoId);

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
}

export default FormatAnalyzer;

// ── Pure utility exports (testable without instantiation) ─────────────────────
// These functions have zero external dependencies (no FS, no network, no DB).
// Exported as standalone functions so unit tests can import them directly
// without triggering the DownloadService constructor (which runs init/yt-dlp).

/**
 * Returns true for audio-only formats: has an audio codec and no video codec.
 * @param {{ acodec?: string, vcodec?: string }} format
 * @returns {boolean}
 */
export const isAudioOnlyFormat = (format) =>
  Boolean(format.acodec) &&
  format.acodec !== 'none' &&
  (!format.vcodec || format.vcodec === 'none');

/**
 * Return a human-readable audio quality label for a given bitrate in kbps.
 * @param {number} bitrate
 * @returns {string}
 */
export const getAudioQualityRating = (bitrate) => {
  if (bitrate >= BITRATE_TIERS.HIGH) return `Excellent (${BITRATE_TIERS.HIGH}+ kbps)`;
  if (bitrate >= BITRATE_TIERS.MEDIUM) return `Very Good (${BITRATE_TIERS.MEDIUM}+ kbps)`;
  if (bitrate >= BITRATE_TIERS.STANDARD) return `Good (${BITRATE_TIERS.STANDARD}+ kbps)`;
  if (bitrate >= BITRATE_TIERS.LOW) return `Standard (${BITRATE_TIERS.LOW}+ kbps)`;
  if (bitrate >= BITRATE_TIERS.MINIMUM) return `Low (${BITRATE_TIERS.MINIMUM}+ kbps)`;
  return `Very Low (<${BITRATE_TIERS.MINIMUM} kbps)`;
};

/**
 * Return a human-readable video quality label for a given resolution height in pixels.
 * @param {number} height
 * @returns {string}
 */
export const getVideoQualityRating = (height) => {
  if (height >= RESOLUTION_TIERS.UHD) return `4K (${RESOLUTION_TIERS.UHD}p)`;
  if (height >= RESOLUTION_TIERS.QHD) return `2K (${RESOLUTION_TIERS.QHD}p)`;
  if (height >= RESOLUTION_TIERS.FHD) return `Full HD (${RESOLUTION_TIERS.FHD}p)`;
  if (height >= RESOLUTION_TIERS.HD) return `HD (${RESOLUTION_TIERS.HD}p)`;
  if (height >= RESOLUTION_TIERS.SD) return `SD (${RESOLUTION_TIERS.SD}p)`;
  return `Low Quality (<${RESOLUTION_TIERS.SD}p)`;
};

/**
 * Convert bytes to megabytes string. Returns null for zero/falsy input.
 * @param {number} bytes
 * @returns {string | null}
 */
export const bytesToMB = (bytes) => {
  if (!bytes || bytes === 0) return null;
  return (bytes / (1024 * 1024)).toFixed(1);
};

/**
 * Estimate output file size in MB after codec conversion.
 * @param {number} originalBitrate  — source bitrate in kbps
 * @param {'mp3' | 'flac' | 'aac'} targetFormat
 * @returns {string}  — estimated size as a string like "12.3"
 */
export const estimateConvertedSize = (originalBitrate, targetFormat) => {
  const multiplier = CODEC_SIZE_MULTIPLIERS[targetFormat] ?? 1.0;
  const estimatedMB = originalBitrate * 0.0075 * multiplier;
  return estimatedMB.toFixed(1);
};

/**
 * Return the human-readable name for a format config object.
 * @param {{ filter: string, type?: string }} formatConfig
 * @returns {string}
 */
export const getFormatName = (formatConfig) => {
  if (formatConfig.filter === 'audioonly') return formatConfig.type || 'audio';
  if (formatConfig.filter === 'audioandvideo') return formatConfig.type || 'mp4';
  if (formatConfig.filter === 'videoonly') return formatConfig.type || 'mp4';
  return 'unknown';
};

/**
 * Parse a frontend formatId string into a structured descriptor.
 * @param {string | null | undefined} formatId
 * @returns {{ kind: 'generic' | 'dash' | 'single', videoItag?: number, audioItag?: number, itag?: number }}
 */
export const parseFormatId = (formatId) => {
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
};

/**
 * Map a download format string to the Innertube download options object.
 * @param {string} format
 * @returns {{ type: string, quality: string, format: string }}
 */
export const mapToInnertubeOptions = (format) => {
  switch (format) {
    case 'audioonly':
    case 'audioonly_aac':
    case 'audioonly_m4a':
    case 'audioonly_mp3':
    case 'audioonly_flac':
    case 'audioonly_wav':
      return { type: 'audio', quality: 'best', format: 'mp4' };
    case 'audioonly_opus':
      return { type: 'audio', quality: 'best', format: 'webm' };
    case 'audioandvideo':
      return { type: 'video+audio', quality: 'best', format: 'mp4' };
    case 'videoonly':
      return { type: 'video', quality: 'best', format: 'mp4' };
    default:
      return { type: 'audio', quality: 'best', format: 'mp4' };
  }
};

/**
 * Return the ffmpeg conversion target format, or null if no conversion is needed.
 * @param {string} format
 * @returns {'mp3' | 'flac' | 'wav' | null}
 */
export const audioConversionTarget = (format) => {
  if (format === 'audioonly_mp3') return 'mp3';
  if (format === 'audioonly_flac') return 'flac';
  if (format === 'audioonly_wav') return 'wav';
  return null;
};

/**
 * Return the temporary file extension to use when streaming before conversion.
 * @param {string} format
 * @returns {string}
 */
export const tempExtForFormat = (format) => {
  if (format === 'audioonly_opus') return 'webm';
  if (format === 'audioandvideo' || format === 'videoonly') return 'mp4';
  return 'm4a';
};
