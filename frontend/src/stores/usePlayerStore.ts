import { create } from 'zustand';
import { Song } from '@/types';
import { useChatStore } from './useChatStore';

const emitActivity = (activity: string) => {
  const socket = useChatStore.getState().socket;
  if (socket?.auth) socket.emit('update_activity', { activity });
};

/** Fisher-Yates shuffle — returns a new shuffled copy */
const fisherYatesShuffle = (arr: number[]): number[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

interface PlayerStore {
  currentSong: Song | null;
  isPlaying: boolean;
  queue: Song[];
  currentIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  previousVolume: number;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  shuffledIndices: number[];

  initializeQueue: (songs: Song[]) => void;
  playAlbum: (songs: Song[], startIndex?: number) => void;
  setCurrentSong: (song: Song | null) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  queue: [],
  currentIndex: -1,
  currentTime: 0,
  duration: 0,
  volume: 75,
  isMuted: false,
  previousVolume: 75,
  isShuffled: false,
  repeatMode: 'none',
  shuffledIndices: [],

  initializeQueue: (songs: Song[]) => {
    const { currentSong } = get();
    // Don't override the queue if a YouTube song is currently active —
    // the user may have navigated back to Home while a YouTube album plays.
    if (currentSong?.isYouTube) return;

    set({
      queue: songs,
      currentSong: currentSong || songs[0],
      currentIndex: get().currentIndex === -1 ? 0 : get().currentIndex,
    });
  },

  playAlbum: (songs: Song[], startIndex = 0) => {
    if (songs.length === 0) return;
    const song = songs[startIndex];
    emitActivity(`Playing ${song.title} by ${song.artist}`);
    set({ queue: songs, currentSong: song, currentIndex: startIndex, isPlaying: true });
  },

  setCurrentSong: (song: Song | null) => {
    if (!song) return;
    emitActivity(`Playing ${song.title} by ${song.artist}`);
    const songIndex = get().queue.findIndex((s) => s._id === song._id);
    set({
      currentSong: song,
      isPlaying: true,
      currentIndex: songIndex !== -1 ? songIndex : get().currentIndex,
    });
  },

  togglePlay: () => {
    const willStartPlaying = !get().isPlaying;
    const currentSong = get().currentSong;
    emitActivity(
      willStartPlaying && currentSong
        ? `Playing ${currentSong.title} by ${currentSong.artist}`
        : 'Idle'
    );
    set({ isPlaying: willStartPlaying });
  },

  playNext: () => {
    const { currentIndex, queue, repeatMode, isShuffled, shuffledIndices } = get();

    // repeat one → replay current song
    if (repeatMode === 'one') {
      const currentSong = queue[currentIndex];
      if (currentSong) {
        emitActivity(`Playing ${currentSong.title} by ${currentSong.artist}`);
        // Trigger a re-play by toggling isPlaying off then on, but the
        // AudioPlayer listens to currentSong changes. Emit same song again
        // via a temporary null trick isn't clean — instead we dispatch a
        // custom event that AudioPlayer can use to seek to 0 and resume.
        window.dispatchEvent(new CustomEvent('player-restart'));
      }
      return;
    }

    if (isShuffled && shuffledIndices.length > 0) {
      // find position of currentIndex inside shuffledIndices
      const pos = shuffledIndices.indexOf(currentIndex);
      const nextPos = pos + 1;

      if (nextPos < shuffledIndices.length) {
        const nextIndex = shuffledIndices[nextPos];
        const nextSong = queue[nextIndex];
        emitActivity(`Playing ${nextSong.title} by ${nextSong.artist}`);
        set({ currentSong: nextSong, currentIndex: nextIndex, isPlaying: true });
      } else if (repeatMode === 'all') {
        // wrap to beginning of shuffled order
        const nextIndex = shuffledIndices[0];
        const nextSong = queue[nextIndex];
        emitActivity(`Playing ${nextSong.title} by ${nextSong.artist}`);
        set({ currentSong: nextSong, currentIndex: nextIndex, isPlaying: true });
      } else {
        set({ isPlaying: false });
      }
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < queue.length) {
      const nextSong = queue[nextIndex];
      emitActivity(`Playing ${nextSong.title} by ${nextSong.artist}`);
      set({ currentSong: nextSong, currentIndex: nextIndex, isPlaying: true });
    } else if (repeatMode === 'all' && queue.length > 0) {
      const firstSong = queue[0];
      emitActivity(`Playing ${firstSong.title} by ${firstSong.artist}`);
      set({ currentSong: firstSong, currentIndex: 0, isPlaying: true });
    } else {
      set({ isPlaying: false });
    }
  },

  playPrevious: () => {
    const { currentIndex, queue, repeatMode, isShuffled, shuffledIndices } = get();

    // repeat one → restart current
    if (repeatMode === 'one') {
      window.dispatchEvent(new CustomEvent('player-restart'));
      return;
    }

    if (isShuffled && shuffledIndices.length > 0) {
      const pos = shuffledIndices.indexOf(currentIndex);
      const prevPos = pos - 1;

      if (prevPos >= 0) {
        const prevIndex = shuffledIndices[prevPos];
        const prevSong = queue[prevIndex];
        emitActivity(`Playing ${prevSong.title} by ${prevSong.artist}`);
        set({ currentSong: prevSong, currentIndex: prevIndex, isPlaying: true });
      } else if (repeatMode === 'all') {
        // wrap to end of shuffled order
        const prevIndex = shuffledIndices[shuffledIndices.length - 1];
        const prevSong = queue[prevIndex];
        emitActivity(`Playing ${prevSong.title} by ${prevSong.artist}`);
        set({ currentSong: prevSong, currentIndex: prevIndex, isPlaying: true });
      } else {
        // already at start — stay on current
        window.dispatchEvent(new CustomEvent('player-restart'));
      }
      return;
    }

    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      const prevSong = queue[prevIndex];
      emitActivity(`Playing ${prevSong.title} by ${prevSong.artist}`);
      set({ currentSong: prevSong, currentIndex: prevIndex, isPlaying: true });
    } else if (repeatMode === 'all' && queue.length > 0) {
      const lastSong = queue[queue.length - 1];
      emitActivity(`Playing ${lastSong.title} by ${lastSong.artist}`);
      set({ currentSong: lastSong, currentIndex: queue.length - 1, isPlaying: true });
    } else if (queue.length > 0) {
      // at start with no repeat — restart current song
      window.dispatchEvent(new CustomEvent('player-restart'));
    } else {
      set({ isPlaying: false });
    }
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  seekTo: (time) => {
    const { currentSong } = get();

    // For local audio files
    if (currentSong && !currentSong.videoId) {
      const audio = document.querySelector('audio') as HTMLAudioElement;
      if (audio) {
        audio.currentTime = time;
      }
    }

    // For YouTube videos, dispatch a custom event that AudioPlayer can listen to
    if (currentSong && currentSong.videoId) {
      window.dispatchEvent(
        new CustomEvent('youtube-seek', {
          detail: { time },
        })
      );
    }
  },

  setVolume: (volume) => {
    const { currentSong } = get();

    // Update store first
    set({ volume, isMuted: volume === 0 });

    // For local audio files
    if (currentSong && !currentSong.videoId) {
      const audio = document.querySelector('audio') as HTMLAudioElement;
      if (audio) {
        audio.volume = volume / 100;
      }
    }

    // For YouTube videos, dispatch a custom event
    if (currentSong && currentSong.videoId) {
      window.dispatchEvent(
        new CustomEvent('youtube-volume', {
          detail: { volume },
        })
      );
    }
  },

  toggleMute: () => {
    const { volume, isMuted, previousVolume } = get();

    if (isMuted) {
      // Unmute: restore previous volume
      const volumeToRestore = previousVolume > 0 ? previousVolume : 75;
      get().setVolume(volumeToRestore);
    } else {
      // Mute: save current volume and set to 0
      set({ previousVolume: volume });
      get().setVolume(0);
    }
  },

  toggleShuffle: () => {
    const { isShuffled, queue, currentIndex } = get();

    if (!isShuffled) {
      // Build shuffled indices: Fisher-Yates, then move currentIndex to front
      const indices = Array.from({ length: queue.length }, (_, i) => i);
      const shuffled = fisherYatesShuffle(indices);
      // Ensure current song plays first in the shuffled order
      const currentPos = shuffled.indexOf(currentIndex);
      if (currentPos !== -1) {
        shuffled.splice(currentPos, 1);
        shuffled.unshift(currentIndex);
      }
      set({ isShuffled: true, shuffledIndices: shuffled });
    } else {
      set({ isShuffled: false, shuffledIndices: [] });
    }
  },

  cycleRepeatMode: () => {
    const { repeatMode } = get();
    const next: Record<'none' | 'one' | 'all', 'none' | 'one' | 'all'> = {
      none: 'all',
      all: 'one',
      one: 'none',
    };
    set({ repeatMode: next[repeatMode] });
  },
}));
