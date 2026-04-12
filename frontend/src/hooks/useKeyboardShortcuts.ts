import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLyricsStore } from '@/stores/useLyricsStore';

/**
 * Global media keyboard shortcuts.
 * Call this ONCE at the top-level layout — it attaches a single global listener.
 *
 * Shortcuts:
 *   Space      → toggle play/pause
 *   ArrowLeft  → previous track
 *   ArrowRight → next track
 *   ArrowUp    → volume +10 (max 100)
 *   ArrowDown  → volume -10 (min 0)
 *   M          → toggle mute
 *   L          → toggle lyrics panel
 *   S          → toggle shuffle
 *   R          → cycle repeat mode
 */
export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when the user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      const {
        togglePlay,
        playNext,
        playPrevious,
        volume,
        setVolume,
        toggleMute,
        toggleShuffle,
        cycleRepeatMode,
      } = usePlayerStore.getState();

      const { toggleLyrics } = useLyricsStore.getState();

      switch (e.key) {
        case ' ':
          // Prevent default to avoid page scroll
          e.preventDefault();
          togglePlay();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          playPrevious();
          break;

        case 'ArrowRight':
          e.preventDefault();
          playNext();
          break;

        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(100, volume + 10));
          break;

        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 10));
          break;

        case 'm':
        case 'M':
          toggleMute();
          break;

        case 'l':
        case 'L':
          toggleLyrics();
          break;

        case 's':
        case 'S':
          toggleShuffle();
          break;

        case 'r':
        case 'R':
          cycleRepeatMode();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};
