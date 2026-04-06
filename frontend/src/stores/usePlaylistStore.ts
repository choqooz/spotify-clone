import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';
import { Playlist } from '@/types';

interface PlaylistStore {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  isLoading: boolean;
  error: string | null;

  fetchPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: string) => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist | null>;
  deletePlaylist: (id: string) => Promise<void>;
  addSong: (playlistId: string, songId: string) => Promise<void>;
  removeSong: (playlistId: string, songId: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: [],
  currentPlaylist: null,
  isLoading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get('/playlists');
      set({ playlists: res.data.playlists });
    } catch (error) {
      set({ error: getApiError(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPlaylistById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get(`/playlists/${id}`);
      set({ currentPlaylist: res.data.playlist });
    } catch (error) {
      set({ error: getApiError(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  createPlaylist: async (name, description = '') => {
    try {
      const res = await axiosInstance.post('/playlists', { name, description });
      const playlist: Playlist = res.data.playlist;
      set((state) => ({ playlists: [playlist, ...state.playlists] }));
      return playlist;
    } catch (error) {
      set({ error: getApiError(error) });
      return null;
    }
  },

  deletePlaylist: async (id) => {
    try {
      await axiosInstance.delete(`/playlists/${id}`);
      set((state) => ({ playlists: state.playlists.filter((p) => p._id !== id) }));
    } catch (error) {
      set({ error: getApiError(error) });
    }
  },

  addSong: async (playlistId, songId) => {
    try {
      await axiosInstance.post(`/playlists/${playlistId}/songs/${songId}`);
      await get().fetchPlaylistById(playlistId);
    } catch (error) {
      set({ error: getApiError(error) });
    }
  },

  removeSong: async (playlistId, songId) => {
    try {
      await axiosInstance.delete(`/playlists/${playlistId}/songs/${songId}`);
      set((state) => ({
        currentPlaylist:
          state.currentPlaylist?._id === playlistId
            ? {
                ...state.currentPlaylist,
                songs: state.currentPlaylist.songs.filter((s) => s._id !== songId),
              }
            : state.currentPlaylist,
      }));
    } catch (error) {
      set({ error: getApiError(error) });
    }
  },
}));
