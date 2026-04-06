import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';

export interface LyricLine {
  time: number;
  text: string;
}

interface LyricsData {
  type: 'synced' | 'unsynced' | 'none';
  lines: LyricLine[];
  message?: string;
}

interface LyricsStore {
  lyricsData: LyricsData | null;
  currentLyricIndex: number;
  isLoading: boolean;
  error: string | null;
  isVisible: boolean;
  offset: number; // Offset in seconds to adjust lyrics timing

  fetchLyrics: (videoId: string, title?: string, artist?: string) => Promise<void>;
  updateCurrentLyric: (currentTime: number) => void;
  toggleLyrics: () => void;
  showLyrics: () => void;
  hideLyrics: () => void;
  seekToLyric: (time: number) => void;
  setOffset: (offset: number) => void;
}

export const useLyricsStore = create<LyricsStore>((set, get) => ({
  lyricsData: null,
  currentLyricIndex: -1,
  isLoading: false,
  error: null,
  isVisible: false,
  offset: 0.77, // Default offset: advance lyrics by 0.77 seconds

  fetchLyrics: async (videoId: string, title?: string, artist?: string) => {
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (artist) params.set('artist', artist);
      const query = params.toString() ? `?${params}` : '';
      const response = await axiosInstance.get(`/youtube/lyrics/${videoId}${query}`);
      set({
        lyricsData: response.data.data,
        isLoading: false,
        currentLyricIndex: -1,
      });
    } catch (error) {
      set({
        error: getApiError(error),
        isLoading: false,
      });
    }
  },

  updateCurrentLyric: (currentTime: number) => {
    const { lyricsData, offset } = get();

    if (
      !lyricsData ||
      lyricsData.type !== 'synced' ||
      !lyricsData.lines.length
    ) {
      return;
    }

    // Apply offset to advance lyrics timing
    const adjustedTime = currentTime + offset;

    let newIndex = -1;
    for (let i = 0; i < lyricsData.lines.length; i++) {
      if (adjustedTime >= lyricsData.lines[i].time) {
        newIndex = i;
      } else {
        break;
      }
    }

    set({ currentLyricIndex: newIndex });
  },

  toggleLyrics: () => set((state) => ({ isVisible: !state.isVisible })),
  showLyrics: () => set({ isVisible: true }),
  hideLyrics: () => set({ isVisible: false }),

  seekToLyric: (time: number) => {
    const event = new CustomEvent('seekToTime', { detail: { time } });
    window.dispatchEvent(event);
  },

  setOffset: (offset: number) => {
    set({ offset });
  },
}));
