import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';
import toast from 'react-hot-toast';
import type { Album, YouTubeSong } from '@/types';

type SearchType = 'songs' | 'albums' | 'videos';

interface YouTubeStore {
  searchQuery: string;
  searchType: SearchType;
  searchResults: YouTubeSong[];
  searchSuggestions: string[];
  currentAlbum: Album | null;
  isLoading: boolean;
  isLoadingAlbum: boolean;
  isLoadingSuggestions: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  setSearchType: (type: SearchType) => void;
  searchYouTube: (query: string, type?: SearchType) => Promise<void>;
  getSearchSuggestions: (query: string) => Promise<void>;
  fetchYouTubeAlbum: (albumId: string) => Promise<void>;
  clearResults: () => void;
  clearSuggestions: () => void;
  clearError: () => void;
}

export const useYouTubeStore = create<YouTubeStore>((set) => ({
  searchQuery: '',
  searchType: 'songs',
  searchResults: [],
  searchSuggestions: [],
  currentAlbum: null,
  isLoading: false,
  isLoadingAlbum: false,
  isLoadingSuggestions: false,
  error: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchType: (type) => set({ searchType: type }),

  searchYouTube: async (query, type) => {
    if (!query.trim()) return;

    // Use provided type or current searchType from state
    const searchType = type || useYouTubeStore.getState().searchType;

    set({ isLoading: true, error: null, searchQuery: query, searchType });

    try {
      const response = await axiosInstance.get(
        `/youtube/search?query=${encodeURIComponent(query)}&type=${searchType}`
      );

      if (response.data.success) {
        const results = response.data.data.map((song: YouTubeSong & { _id?: string; audioUrl?: null }) => ({
          videoId: song.videoId,
          albumId: song.albumId,
          title: song.title,
          artist: song.artist,
          duration: song.duration,
          imageUrl: song.imageUrl,
          thumbnails: song.thumbnails,
          _id: song.videoId ?? song.albumId, // For compatibility — albums have no videoId
          audioUrl: null,
        }));
        set({ searchResults: results, isLoading: false });
      } else {
        throw new Error(response.data.error || 'Search failed');
      }
    } catch (error) {
      const errorMessage =
        getApiError(error) ?? 'Unknown error occurred';
      set({ error: errorMessage, isLoading: false });
      toast.error(`Error searching YouTube: ${errorMessage}`);
    }
  },

  fetchYouTubeAlbum: async (albumId) => {
    set({ isLoadingAlbum: true, error: null });

    try {
      const response = await axiosInstance.get(`/youtube/album/${albumId}`);

      if (response.data.success) {
        set({ currentAlbum: response.data.data, isLoadingAlbum: false });
      } else {
        throw new Error(response.data.error || 'Failed to fetch album');
      }
    } catch (error) {
      const errorMessage =
        getApiError(error) ?? 'Unknown error occurred';
      set({ error: errorMessage, isLoadingAlbum: false });
      toast.error(`Error fetching YouTube album: ${errorMessage}`);
    }
  },

  getSearchSuggestions: async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      set({ searchSuggestions: [] });
      return;
    }

    set({ isLoadingSuggestions: true });

    try {
      const response = await axiosInstance.get(
        `/youtube/search/suggestions?query=${encodeURIComponent(query)}`
      );

      if (response.data.success) {
        set({
          searchSuggestions: response.data.data,
          isLoadingSuggestions: false,
        });
      } else {
        throw new Error(response.data.error || 'Failed to get suggestions');
      }
    } catch (error) {
      set({ isLoadingSuggestions: false });
      // No mostrar error para sugerencias, solo fallar silenciosamente
      console.error('Error getting search suggestions:', error);
    }
  },

  clearResults: () => set({ searchResults: [], searchQuery: '' }),
  clearSuggestions: () => set({ searchSuggestions: [] }),
  clearError: () => set({ error: null }),
}));
