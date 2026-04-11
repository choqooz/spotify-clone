/**
 * Shared download format definitions and validation utilities.
 * Single source of truth for valid format strings — used by both
 * the controller (request validation) and the service (internal validation).
 */

export const VALID_FORMATS = {
  song: [
    'audioonly',
    'audioandvideo',
    'videoonly',
    'audioonly_mp3',
    'audioonly_flac',
    'audioonly_wav',
    'audioonly_m4a',
    'audioonly_aac',
    'audioonly_opus',
    'mp3',
    'flac',
    'wav',
    'm4a',
    'aac',
    'opus',
    'mp4',
    'webm',
  ],
  album: [
    'audioonly',
    'audioonly_mp3',
    'audioonly_flac',
    'audioonly_wav',
    'audioonly_m4a',
    'audioonly_aac',
    'audioonly_opus',
    'mp3',
    'flac',
    'wav',
    'm4a',
    'aac',
    'opus',
  ],
};

/**
 * Returns true if `format` is a valid format string for the given download type.
 * @param {string} format
 * @param {'song' | 'album'} type
 */
export const isValidFormat = (format, type) => {
  const list = VALID_FORMATS[type];
  if (!list) return false;
  return list.includes(format);
};
