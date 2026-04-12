import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { axiosInstance } from '@/lib/axios';
import { useDownloadStore } from './useDownloadStore';

interface DownloadSocketStore {
  socket: Socket | null;
  isConnected: boolean;
  initializeSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useDownloadSocketStore = create<DownloadSocketStore>((set, get) => ({
  socket: null,
  isConnected: false,

  initializeSocket: (token: string) => {
    const existing = get().socket;
    if (existing?.connected) return; // already connected, reuse

    const getBaseURL = () => {
      if (import.meta.env.MODE === 'development') {
        const host = window.location.hostname;
        const port = import.meta.env.VITE_API_PORT ?? '5000';
        return `http://${host}:${port}`;
      }
      return '/';
    };

    const socket = io(getBaseURL(), {
      auth: { token },
      autoConnect: true,
      withCredentials: true,
    });

    socket.on('connect', () => set({ isConnected: true }));
    socket.on('disconnect', () => set({ isConnected: false }));
    socket.on('connect_error', (err) => {
      if (import.meta.env.DEV) {
        console.error('Download socket error:', err.message);
      }
    });

    socket.onAny((eventName: string, data: unknown) => {
      const store = useDownloadStore.getState();

      if (eventName.startsWith('download-progress-')) {
        const videoId = eventName.replace('download-progress-', '');
        store.handleSocketProgress(videoId, data as { percent?: number; qualityInfo?: unknown });
      }

      else if (eventName.startsWith('album-progress-')) {
        const albumId = eventName.replace('album-progress-', '');
        store.handleSocketAlbumProgress(albumId, data as { overallProgress?: number });
      }

      else if (eventName.startsWith('download-complete-')) {
        const videoId = eventName.replace('download-complete-', '');
        store.handleSocketComplete(videoId, data as { filename?: string; [key: string]: unknown });

        // Trigger browser file download
        const payload = data as { filename?: string };
        if (payload?.filename) {
          const origin = (axiosInstance.defaults.baseURL ?? '').replace(/\/api$/, '');
          const url = `${origin}/api/download/file/${encodeURIComponent(payload.filename)}`;
          const authHeader = axiosInstance.defaults.headers.common['Authorization'] as string | undefined;

          fetch(url, { headers: authHeader ? { Authorization: authHeader } : {} })
            .then((res) => {
              if (!res.ok) throw new Error(`Server returned ${res.status}`);
              return res.blob();
            })
            .then((blob) => {
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = payload.filename!;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
            })
            .catch(() => {
              // File download failure is non-fatal — the download was already saved server-side
            });
        }
      }

      else if (eventName.startsWith('album-complete-')) {
        const albumId = eventName.replace('album-complete-', '');
        store.handleSocketAlbumComplete(albumId, data as Record<string, unknown>);
      }

      else if (
        eventName.startsWith('download-error-') ||
        eventName.startsWith('album-error-')
      ) {
        const id = eventName.includes('download-error-')
          ? eventName.replace('download-error-', '')
          : eventName.replace('album-error-', '');
        store.handleSocketError(id, data as { error?: string });
      }
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));
