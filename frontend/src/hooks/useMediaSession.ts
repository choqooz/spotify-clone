import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';

/**
 * Integrates the browser Media Session API so the OS lockscreen/notification
 * shows song metadata and media controls (play/pause/prev/next/seek).
 *
 * Call this ONCE at the top-level layout alongside useKeyboardShortcuts().
 *
 * Notes on YouTube songs:
 *   YouTube iframe playback is paused automatically by the browser when the
 *   page loses visibility — this is a YouTube restriction that cannot be
 *   overridden from JavaScript. A future improvement would be to detect
 *   background state and switch YouTube audio to a direct stream URL (if
 *   available via a streaming URL endpoint) played through the native <audio>
 *   element, enabling true background playback for YouTube tracks.
 */
export const useMediaSession = () => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Update metadata when the song changes
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: '',
      artwork: currentSong.imageUrl
        ? [
            { src: currentSong.imageUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: currentSong.imageUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: currentSong.imageUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: currentSong.imageUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: currentSong.imageUrl, sizes: '384x384', type: 'image/jpeg' },
            { src: currentSong.imageUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });
  }, [currentSong]);

  // Sync OS playback state indicator (the pill/badge on the lockscreen)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Register action handlers once — access store imperatively to avoid
  // re-registering on every render (same pattern as useKeyboardShortcuts)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const store = usePlayerStore.getState;

    navigator.mediaSession.setActionHandler('play', () => {
      store().togglePlay();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      store().togglePlay();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      store().playPrevious();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      store().playNext();
    });

    // seekto enables the lockscreen progress bar to be draggable
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        store().requestSeek(details.seekTime);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, []);
};
