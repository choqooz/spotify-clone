import { describe, it, expect } from 'vitest';
import { VALID_FORMATS, isValidFormat } from '../downloadFormats.js';

describe('VALID_FORMATS', () => {
  it('has a song key', () => {
    expect(VALID_FORMATS).toHaveProperty('song');
    expect(Array.isArray(VALID_FORMATS.song)).toBe(true);
  });

  it('has an album key', () => {
    expect(VALID_FORMATS).toHaveProperty('album');
    expect(Array.isArray(VALID_FORMATS.album)).toBe(true);
  });

  it('song formats include audioonly', () => {
    expect(VALID_FORMATS.song).toContain('audioonly');
  });

  it('song formats include video types (audioandvideo, videoonly)', () => {
    expect(VALID_FORMATS.song).toContain('audioandvideo');
    expect(VALID_FORMATS.song).toContain('videoonly');
  });

  it('album formats do NOT include video-only types', () => {
    expect(VALID_FORMATS.album).not.toContain('audioandvideo');
    expect(VALID_FORMATS.album).not.toContain('videoonly');
  });

  it('song formats include all codec shortcuts (mp3, flac, wav, m4a, aac, opus, mp4, webm)', () => {
    const codecs = ['mp3', 'flac', 'wav', 'm4a', 'aac', 'opus', 'mp4', 'webm'];
    for (const codec of codecs) {
      expect(VALID_FORMATS.song).toContain(codec);
    }
  });
});

describe('isValidFormat()', () => {
  // ── Happy paths: song ────────────────────────────────────────────────────────

  it('returns true for audioonly with type song', () => {
    expect(isValidFormat('audioonly', 'song')).toBe(true);
  });

  it('returns true for mp3 with type song', () => {
    expect(isValidFormat('mp3', 'song')).toBe(true);
  });

  it('returns true for audioandvideo with type song', () => {
    expect(isValidFormat('audioandvideo', 'song')).toBe(true);
  });

  it('returns true for videoonly with type song', () => {
    expect(isValidFormat('videoonly', 'song')).toBe(true);
  });

  it('returns true for all audioonly_* variants with type song', () => {
    const variants = [
      'audioonly_mp3',
      'audioonly_flac',
      'audioonly_wav',
      'audioonly_m4a',
      'audioonly_aac',
      'audioonly_opus',
    ];
    for (const format of variants) {
      expect(isValidFormat(format, 'song')).toBe(true);
    }
  });

  // ── Happy paths: album ───────────────────────────────────────────────────────

  it('returns true for audioonly with type album', () => {
    expect(isValidFormat('audioonly', 'album')).toBe(true);
  });

  it('returns true for mp3 with type album', () => {
    expect(isValidFormat('mp3', 'album')).toBe(true);
  });

  it('returns true for flac with type album', () => {
    expect(isValidFormat('flac', 'album')).toBe(true);
  });

  // ── Invalid format strings ───────────────────────────────────────────────────

  it('returns false for an unknown format string', () => {
    expect(isValidFormat('something_random', 'song')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidFormat('', 'song')).toBe(false);
  });

  it('returns false for a video format when type is album', () => {
    expect(isValidFormat('audioandvideo', 'album')).toBe(false);
    expect(isValidFormat('videoonly', 'album')).toBe(false);
    expect(isValidFormat('mp4', 'album')).toBe(false);
    expect(isValidFormat('webm', 'album')).toBe(false);
  });

  // ── Invalid type ─────────────────────────────────────────────────────────────

  it('returns false for an unknown type', () => {
    expect(isValidFormat('audioonly', 'playlist')).toBe(false);
    expect(isValidFormat('mp3', 'track')).toBe(false);
  });

  it('returns false when type is undefined', () => {
    expect(isValidFormat('audioonly', undefined)).toBe(false);
  });

  it('returns false when type is null', () => {
    expect(isValidFormat('audioonly', null)).toBe(false);
  });

  it('returns false when type is empty string', () => {
    expect(isValidFormat('audioonly', '')).toBe(false);
  });

  // ── Edge: format is null or undefined ───────────────────────────────────────

  it('returns false when format is null', () => {
    expect(isValidFormat(null, 'song')).toBe(false);
  });

  it('returns false when format is undefined', () => {
    expect(isValidFormat(undefined, 'song')).toBe(false);
  });
});
