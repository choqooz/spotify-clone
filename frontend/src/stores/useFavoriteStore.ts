import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';
import { Song } from '@/types';

interface FavoriteStore {
  favorites: Song[];
  favoritedIds: Set<string>;
  isLoading: boolean;
  error: string | null;

  fetchFavorites: () => Promise<void>;
  addFavorite: (songId: string) => Promise<void>;
  removeFavorite: (songId: string) => Promise<void>;
  isFavorite: (songId: string) => boolean;
}

export const useFavoriteStore = create<FavoriteStore>((set, get) => ({
  favorites: [],
  favoritedIds: new Set(),
  isLoading: false,
  error: null,

  fetchFavorites: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get('/favorites');
      const songs: Song[] = res.data.songs;
      set({ favorites: songs, favoritedIds: new Set(songs.map((s) => s._id)) });
    } catch (error) {
      set({ error: getApiError(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  addFavorite: async (songId) => {
    try {
      await axiosInstance.post(`/favorites/${songId}`);
      set((state) => ({ favoritedIds: new Set([...state.favoritedIds, songId]) }));
      get().fetchFavorites();
    } catch (error) {
      set({ error: getApiError(error) });
    }
  },

  removeFavorite: async (songId) => {
    try {
      await axiosInstance.delete(`/favorites/${songId}`);
      set((state) => {
        const updated = new Set(state.favoritedIds);
        updated.delete(songId);
        return {
          favoritedIds: updated,
          favorites: state.favorites.filter((s) => s._id !== songId),
        };
      });
    } catch (error) {
      set({ error: getApiError(error) });
    }
  },

  isFavorite: (songId) => get().favoritedIds.has(songId),
}));
