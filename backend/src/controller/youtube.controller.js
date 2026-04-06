import { getInnertube } from '../lib/ytmusic.js';
import { Client } from 'lrclib-api';
import {
  asyncHandler,
  ValidationError,
  NotFoundError,
} from '../middleware/error.middleware.js';

// ─── Clients ──────────────────────────────────────────────────────────────────

const lrcClient = new Client();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Picks the largest thumbnail URL from a MusicThumbnail object.
 * youtubei.js returns thumbnails already sorted largest-first.
 * @param {{ contents?: Array<{ url: string, width: number, height: number }> } | undefined} thumbnail
 */
const pickThumbnail = (thumbnail) => {
  const contents = thumbnail?.contents;
  if (!contents?.length) return '';
  // Already sorted largest first by youtubei.js
  const url = contents[0].url;
  // Upscale size parameters baked into the URL by YouTube:
  //   lh3.googleusercontent.com → =w226-h226-l90-rj becomes =w500-h500-l90-rj
  //   yt3.ggpht.com             → =s226-c-k becomes =s500-c-k
  return url
    .replace(/=w\d+-h\d+/, '=w500-h500')
    .replace(/=s\d+/, '=s500');
};

/**
 * Extracts a plain artist name string from a MusicResponsiveListItem.
 * For song/video results the `artists` array is populated.
 * For album results it sits in flex_columns[1].
 * @param {object} item
 */
const extractArtist = (item) => {
  if (item.artists?.length) return item.artists[0].name;
  // Fallback: first run in the second flex column that has an endpoint (= artist link)
  const secondCol = item.flex_columns?.[1]?.title?.runs;
  if (secondCol?.length) {
    const artistRun = secondCol.find((r) => r.endpoint?.payload?.browseId?.startsWith('UC'));
    if (artistRun) return artistRun.text;
  }
  return 'Unknown Artist';
};

/**
 * Parses "Album • 1999" or "Single • 2024" into a numeric year.
 * @param {string | undefined} subtitleText
 */
const parseYear = (subtitleText) => {
  if (!subtitleText) return new Date().getFullYear();
  const match = subtitleText.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : new Date().getFullYear();
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { query } = req.query;

  if (!query || query.trim().length < 2) {
    return res.json({ success: true, data: [] });
  }

  const yt = await getInnertube();
  const raw = await yt.music.getSearchSuggestions(query.trim());

  // raw is an array of SearchSuggestionsSection, each has a .contents array of SearchSuggestion
  const suggestions = raw
    .flatMap((section) => section.contents ?? [])
    .map((item) => item.suggestion?.text ?? item.suggestion?.toString() ?? '')
    .filter(Boolean);

  res.json({ success: true, data: suggestions });
});

export const searchYouTube = asyncHandler(async (req, res) => {
  const { query, type = 'songs' } = req.query;

  if (!query) {
    throw new ValidationError('Query parameter is required');
  }

  const yt = await getInnertube();

  // youtubei.js type filter values
  const typeMap = {
    songs: 'song',
    artists: 'artist',
    albums: 'album',
    videos: 'video',
  };

  const filter = typeMap[type] ?? 'song';
  const results = await yt.music.search(query.trim(), { type: filter });

  // Results live inside a MusicShelf node
  const shelf = results.contents?.find((c) => c.type === 'MusicShelf');
  const items = shelf?.contents ?? [];

  const processed = items.map((item) => {
    const isAlbum = type === 'albums';
    const id = item.id ?? '';
    const artist = extractArtist(item);
    const imageUrl = pickThumbnail(item.thumbnail);
    const year = isAlbum ? parseYear(item.subtitle?.text) : undefined;

    return {
      _id: id,
      videoId: isAlbum ? undefined : id,
      albumId: isAlbum ? id : (item.album?.id ?? undefined),
      title: item.title ?? 'Unknown Title',
      artist,
      duration: item.duration?.seconds ?? 0,
      imageUrl,
      type: filter.toUpperCase(),
      audioUrl: null,
      ...(year !== undefined && { releaseYear: year }),
    };
  });

  res.json({ success: true, data: processed });
});

export const getSongDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) throw new ValidationError('videoId is required');

  const yt = await getInnertube();
  const info = await yt.music.getInfo(videoId);

  if (!info) throw new NotFoundError('Song');

  const basic = info.basic_info;
  res.json({
    success: true,
    data: {
      _id: basic.id,
      videoId: basic.id,
      title: basic.title ?? 'Unknown Title',
      artist: basic.author ?? 'Unknown Artist',
      duration: basic.duration ?? 0,
      imageUrl: pickThumbnail({ contents: basic.thumbnail }),
      audioUrl: null,
      isYouTube: true,
    },
  });
});

export const getAlbumDetails = asyncHandler(async (req, res) => {
  const { albumId } = req.params;

  if (!albumId) throw new ValidationError('albumId is required');

  const yt = await getInnertube();
  const album = await yt.music.getAlbum(albumId);

  if (!album) throw new NotFoundError('Album');

  const header = album.header;
  const title = header?.title?.text ?? 'Unknown Album';
  const artist = header?.strapline_text_one?.text ?? 'Unknown Artist';
  const releaseYear = parseYear(header?.subtitle?.text);
  const imageUrl = pickThumbnail(header?.thumbnail);

  const songs = (album.contents ?? []).map((song) => ({
    _id: song.id ?? '',
    videoId: song.id ?? '',
    title: song.title ?? 'Unknown Title',
    artist,                          // album-level artist — song level has no separate artist field
    duration: song.duration?.seconds ?? 0,
    imageUrl,                        // album cover shared by all tracks
    audioUrl: null,
    isYouTube: true,
    albumId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  res.json({
    success: true,
    data: {
      _id: albumId,
      title,
      artist,
      imageUrl,
      releaseYear,
      songs,
      isYouTube: true,
    },
  });
});

export const getLyrics = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) throw new ValidationError('videoId is required');

  const yt = await getInnertube();
  const info = await yt.music.getInfo(videoId);

  if (!info) throw new NotFoundError('Song');

  const basic = info.basic_info;
  const trackName = basic.title;
  const artistName = basic.author ?? basic.channel?.name ?? '';
  const duration = basic.duration ?? 0;

  if (!trackName) {
    throw new ValidationError('Missing track information');
  }

  const lrcQuery = { track_name: trackName, ...(artistName && { artist_name: artistName }) };
  let lyricsData = null;

  try {
    const synced = await lrcClient.getSynced(lrcQuery);
    if (synced?.length) {
      lyricsData = {
        type: 'synced',
        lines: synced.map((line) => ({ time: line.startTime, text: line.text })),
      };
    }
  } catch {
    // fallthrough to unsynced
  }

  if (!lyricsData) {
    try {
      const unsynced = await lrcClient.getUnsynced(lrcQuery);
      if (unsynced?.length) {
        const timePerLine = (duration || 180) / unsynced.length;
        lyricsData = {
          type: 'unsynced',
          lines: unsynced.map((line, i) => ({
            time: i * timePerLine,
            text: line.text,
          })),
        };
      }
    } catch {
      // no lyrics available
    }
  }

  res.json({
    success: true,
    data: lyricsData ?? { type: 'none', lines: [], message: 'No lyrics found for this song' },
  });
});

export const healthCheck = async (req, res) => {
  const yt = await getInnertube();
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiInitialized: !!yt,
    client: 'youtubei.js',
  });
};
