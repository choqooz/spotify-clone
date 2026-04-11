/**
 * Unit tests for the pure utility functions exported from downloadService.js.
 *
 * We stub all external I/O modules (ytmusic, logger, fs, child_process) so
 * the DownloadService singleton constructor's async init() fires silently
 * in the background without network calls or filesystem side-effects.
 * The named exports (sanitizeFilename, getAudioQualityRating, etc.) are
 * purely computational and safe to call immediately.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Module mocks (hoisted — must come before any import of the module under test) ──

vi.mock('../../lib/ytmusic.js', () => ({
  getInnertube: vi.fn().mockResolvedValue({}),
  getAuthedInnertube: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Stub fs/promises so init() mkdir / access calls don't hit the real FS
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error('ENOENT')),
    copyFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 0, mtime: new Date() }),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  copyFile: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0, mtime: new Date() }),
  readdir: vi.fn().mockResolvedValue([]),
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
}));

// Stub child_process so yt-dlp spawn calls during init() fire silently
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const ee = { stdout: null, stderr: null, on: vi.fn(), kill: vi.fn() };
    ee.stdout = { on: vi.fn() };
    ee.stderr = { on: vi.fn() };
    // Simulate successful exit (code 0) so init() resolves without throwing
    ee.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 0);
    });
    return ee;
  }),
  createWriteStream: vi.fn(() => ({
    write: vi.fn(() => true),
    end: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  })),
}));

// Also stub the 'fs' named import (createWriteStream used inside service)
vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({
    write: vi.fn(() => true),
    end: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  })),
}));

// Now import the pure named exports — safe because they don't touch I/O
import {
  sanitizeFilename,
  getAudioQualityRating,
  getVideoQualityRating,
  bytesToMB,
  estimateConvertedSize,
  getFormatName,
  parseFormatId,
  mapToInnertubeOptions,
  audioConversionTarget,
  tempExtForFormat,
} from '../downloadService.js';

// ── sanitizeFilename ──────────────────────────────────────────────────────────

describe('sanitizeFilename()', () => {
  it('removes illegal Windows/POSIX filename characters', () => {
    expect(sanitizeFilename('file<name>:test')).toBe('filenametest');
    expect(sanitizeFilename('a/b\\c')).toBe('abc');
    expect(sanitizeFilename('a|b?c*d')).toBe('abcd');
    expect(sanitizeFilename('"quoted"')).toBe('quoted');
  });

  it('collapses multiple spaces into a single space', () => {
    expect(sanitizeFilename('Hello   World')).toBe('Hello World');
    expect(sanitizeFilename('a  b  c')).toBe('a b c');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello');
  });

  it('truncates to 100 characters', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeFilename(long)).toHaveLength(100);
  });

  it('preserves normal filenames unchanged', () => {
    expect(sanitizeFilename('My Song 2024')).toBe('My Song 2024');
  });

  it('handles a real-world song title', () => {
    const title = 'The Beatles - "Come Together" (Remastered)';
    const result = sanitizeFilename(title);
    // quotes removed, parens preserved, colons removed
    expect(result).toBe('The Beatles - Come Together (Remastered)');
  });

  it('returns empty string for a string of only illegal characters', () => {
    expect(sanitizeFilename('<>:"/\\|?*')).toBe('');
  });
});

// ── getAudioQualityRating ─────────────────────────────────────────────────────

describe('getAudioQualityRating()', () => {
  it('returns Excellent for bitrate >= 256 kbps', () => {
    expect(getAudioQualityRating(256)).toMatch(/Excellent/);
    expect(getAudioQualityRating(320)).toMatch(/Excellent/);
  });

  it('returns Very Good for bitrate >= 192 and < 256 kbps', () => {
    expect(getAudioQualityRating(192)).toMatch(/Very Good/);
    expect(getAudioQualityRating(255)).toMatch(/Very Good/);
  });

  it('returns Good for bitrate >= 128 and < 192 kbps', () => {
    expect(getAudioQualityRating(128)).toMatch(/Good/);
    expect(getAudioQualityRating(191)).toMatch(/Good/);
  });

  it('returns Standard for bitrate >= 96 and < 128 kbps', () => {
    expect(getAudioQualityRating(96)).toMatch(/Standard/);
    expect(getAudioQualityRating(127)).toMatch(/Standard/);
  });

  it('returns Low for bitrate >= 64 and < 96 kbps', () => {
    expect(getAudioQualityRating(64)).toMatch(/Low/);
    expect(getAudioQualityRating(95)).toMatch(/Low/);
  });

  it('returns Very Low for bitrate < 64 kbps', () => {
    expect(getAudioQualityRating(0)).toMatch(/Very Low/);
    expect(getAudioQualityRating(63)).toMatch(/Very Low/);
  });
});

// ── getVideoQualityRating ─────────────────────────────────────────────────────

describe('getVideoQualityRating()', () => {
  it('returns 4K for height >= 2160', () => {
    expect(getVideoQualityRating(2160)).toMatch(/4K/);
    expect(getVideoQualityRating(4320)).toMatch(/4K/);
  });

  it('returns 2K for height >= 1440 and < 2160', () => {
    expect(getVideoQualityRating(1440)).toMatch(/2K/);
    expect(getVideoQualityRating(2159)).toMatch(/2K/);
  });

  it('returns Full HD for height >= 1080 and < 1440', () => {
    expect(getVideoQualityRating(1080)).toMatch(/Full HD/);
    expect(getVideoQualityRating(1439)).toMatch(/Full HD/);
  });

  it('returns HD for height >= 720 and < 1080', () => {
    expect(getVideoQualityRating(720)).toMatch(/HD/);
    expect(getVideoQualityRating(1079)).toMatch(/HD/);
  });

  it('returns SD for height >= 480 and < 720', () => {
    expect(getVideoQualityRating(480)).toMatch(/SD/);
    expect(getVideoQualityRating(719)).toMatch(/SD/);
  });

  it('returns Low Quality for height < 480', () => {
    expect(getVideoQualityRating(360)).toMatch(/Low Quality/);
    expect(getVideoQualityRating(0)).toMatch(/Low Quality/);
  });
});

// ── bytesToMB ─────────────────────────────────────────────────────────────────

describe('bytesToMB()', () => {
  it('converts 1 MB (1048576 bytes) correctly', () => {
    expect(bytesToMB(1048576)).toBe('1.0');
  });

  it('converts 10 MB correctly', () => {
    expect(bytesToMB(10 * 1048576)).toBe('10.0');
  });

  it('returns a string with one decimal place', () => {
    const result = bytesToMB(1500000);
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d+\.\d$/);
  });

  it('returns null for 0 bytes', () => {
    expect(bytesToMB(0)).toBeNull();
  });

  it('returns null for falsy input', () => {
    expect(bytesToMB(null)).toBeNull();
    expect(bytesToMB(undefined)).toBeNull();
  });

  it('rounds to 1 decimal place', () => {
    // 1.5 * 1048576 = 1572864 → 1.5 MB
    expect(bytesToMB(1572864)).toBe('1.5');
  });
});

// ── estimateConvertedSize ─────────────────────────────────────────────────────

describe('estimateConvertedSize()', () => {
  it('returns a string', () => {
    expect(typeof estimateConvertedSize(128, 'mp3')).toBe('string');
  });

  it('applies the mp3 multiplier (1.2)', () => {
    // 128 kbps * 0.0075 * 1.2 = 1.152 → "1.2"
    expect(estimateConvertedSize(128, 'mp3')).toBe('1.2');
  });

  it('applies the flac multiplier (4.0)', () => {
    // 128 * 0.0075 * 4.0 = 3.84 → "3.8"
    expect(estimateConvertedSize(128, 'flac')).toBe('3.8');
  });

  it('applies the aac multiplier (1.0)', () => {
    // 128 * 0.0075 * 1.0 = 0.96 → "1.0"
    expect(estimateConvertedSize(128, 'aac')).toBe('1.0');
  });

  it('falls back to multiplier 1.0 for unknown format', () => {
    // Same result as aac
    expect(estimateConvertedSize(128, 'ogg')).toBe(estimateConvertedSize(128, 'aac'));
  });

  it('scales with bitrate — higher bitrate = larger estimate', () => {
    const low = Number(estimateConvertedSize(64, 'mp3'));
    const high = Number(estimateConvertedSize(256, 'mp3'));
    expect(high).toBeGreaterThan(low);
  });
});

// ── getFormatName ─────────────────────────────────────────────────────────────

describe('getFormatName()', () => {
  it('returns type or "audio" for audioonly filter', () => {
    expect(getFormatName({ filter: 'audioonly' })).toBe('audio');
    expect(getFormatName({ filter: 'audioonly', type: 'mp3' })).toBe('mp3');
  });

  it('returns type or "mp4" for audioandvideo filter', () => {
    expect(getFormatName({ filter: 'audioandvideo' })).toBe('mp4');
    expect(getFormatName({ filter: 'audioandvideo', type: 'webm' })).toBe('webm');
  });

  it('returns type or "mp4" for videoonly filter', () => {
    expect(getFormatName({ filter: 'videoonly' })).toBe('mp4');
  });

  it('returns "unknown" for unrecognized filter', () => {
    expect(getFormatName({ filter: 'something' })).toBe('unknown');
    expect(getFormatName({})).toBe('unknown');
  });
});

// ── parseFormatId ─────────────────────────────────────────────────────────────

describe('parseFormatId()', () => {
  it('returns generic for null', () => {
    expect(parseFormatId(null)).toEqual({ kind: 'generic' });
  });

  it('returns generic for undefined', () => {
    expect(parseFormatId(undefined)).toEqual({ kind: 'generic' });
  });

  it('returns generic for "best"', () => {
    expect(parseFormatId('best')).toEqual({ kind: 'generic' });
  });

  it('returns generic for "bestaudio"', () => {
    expect(parseFormatId('bestaudio')).toEqual({ kind: 'generic' });
  });

  it('returns generic for "converted"', () => {
    expect(parseFormatId('converted')).toEqual({ kind: 'generic' });
  });

  it('returns single itag for a numeric string', () => {
    expect(parseFormatId('140')).toEqual({ kind: 'single', itag: 140 });
    expect(parseFormatId('251')).toEqual({ kind: 'single', itag: 251 });
  });

  it('returns dash with videoItag and audioItag for "vId+aId"', () => {
    expect(parseFormatId('399+140')).toEqual({ kind: 'dash', videoItag: 399, audioItag: 140 });
  });

  it('returns dash correctly with spaces around "+"', () => {
    expect(parseFormatId('399 + 140')).toEqual({ kind: 'dash', videoItag: 399, audioItag: 140 });
  });

  it('returns generic for a non-numeric non-known string', () => {
    expect(parseFormatId('notanumber')).toEqual({ kind: 'generic' });
  });
});

// ── mapToInnertubeOptions ────────────────────────────────────────────────────

describe('mapToInnertubeOptions()', () => {
  it('maps audioonly to audio/best/mp4', () => {
    expect(mapToInnertubeOptions('audioonly')).toEqual({ type: 'audio', quality: 'best', format: 'mp4' });
  });

  it('maps all audioonly_* (except opus) to audio/best/mp4', () => {
    const variants = ['audioonly_aac', 'audioonly_m4a', 'audioonly_mp3', 'audioonly_flac', 'audioonly_wav'];
    for (const v of variants) {
      expect(mapToInnertubeOptions(v)).toEqual({ type: 'audio', quality: 'best', format: 'mp4' });
    }
  });

  it('maps audioonly_opus to audio/best/webm', () => {
    expect(mapToInnertubeOptions('audioonly_opus')).toEqual({ type: 'audio', quality: 'best', format: 'webm' });
  });

  it('maps audioandvideo to video+audio/best/mp4', () => {
    expect(mapToInnertubeOptions('audioandvideo')).toEqual({ type: 'video+audio', quality: 'best', format: 'mp4' });
  });

  it('maps videoonly to video/best/mp4', () => {
    expect(mapToInnertubeOptions('videoonly')).toEqual({ type: 'video', quality: 'best', format: 'mp4' });
  });

  it('falls back to audio/best/mp4 for unknown format', () => {
    expect(mapToInnertubeOptions('unknown_format')).toEqual({ type: 'audio', quality: 'best', format: 'mp4' });
  });
});

// ── audioConversionTarget ────────────────────────────────────────────────────

describe('audioConversionTarget()', () => {
  it('returns "mp3" for audioonly_mp3', () => {
    expect(audioConversionTarget('audioonly_mp3')).toBe('mp3');
  });

  it('returns "flac" for audioonly_flac', () => {
    expect(audioConversionTarget('audioonly_flac')).toBe('flac');
  });

  it('returns "wav" for audioonly_wav', () => {
    expect(audioConversionTarget('audioonly_wav')).toBe('wav');
  });

  it('returns null for audioonly (no conversion needed)', () => {
    expect(audioConversionTarget('audioonly')).toBeNull();
  });

  it('returns null for audioonly_aac (no conversion needed)', () => {
    expect(audioConversionTarget('audioonly_aac')).toBeNull();
  });

  it('returns null for audioonly_opus', () => {
    expect(audioConversionTarget('audioonly_opus')).toBeNull();
  });

  it('returns null for mp3 shorthand (no audioonly_ prefix)', () => {
    expect(audioConversionTarget('mp3')).toBeNull();
  });
});

// ── tempExtForFormat ─────────────────────────────────────────────────────────

describe('tempExtForFormat()', () => {
  it('returns "webm" for audioonly_opus', () => {
    expect(tempExtForFormat('audioonly_opus')).toBe('webm');
  });

  it('returns "mp4" for audioandvideo', () => {
    expect(tempExtForFormat('audioandvideo')).toBe('mp4');
  });

  it('returns "mp4" for videoonly', () => {
    expect(tempExtForFormat('videoonly')).toBe('mp4');
  });

  it('returns "m4a" for audioonly', () => {
    expect(tempExtForFormat('audioonly')).toBe('m4a');
  });

  it('returns "m4a" for all other audio variants', () => {
    const variants = ['audioonly_mp3', 'audioonly_flac', 'audioonly_wav', 'audioonly_m4a', 'audioonly_aac'];
    for (const v of variants) {
      expect(tempExtForFormat(v)).toBe('m4a');
    }
  });
});
