/**
 * Unit tests for the pure utility functions exported from downloadService.js.
 *
 * We stub all external I/O modules (ytmusic, logger, fs, child_process) so
 * the DownloadService singleton constructor's async init() fires silently
 * in the background without network calls or filesystem side-effects.
 * The named exports (sanitizeFilename, etc.) are purely computational and
 * safe to call immediately.
 *
 * Format-analysis utility tests (getAudioQualityRating, parseFormatId, etc.)
 * live in formatAnalyzer.test.js — those functions are now owned by formatAnalyzer.js
 * but remain re-exported from downloadService.js for backward compatibility.
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
