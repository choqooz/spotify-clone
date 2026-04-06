import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';
import { toast } from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';

// Types

interface AlbumDownloadProgress {
  currentSong: number;
  totalSongs: number;
  currentSongTitle: string;
  songProgress: number;
  overallProgress: number;
  albumTitle: string;
  albumId: string;
  type: 'album';
  completed?: boolean;
}

interface DownloadResult {
  success: boolean;
  videoId: string;
  title: string;
  filename: string;
  duration: number;
  format: string;
  quality: string;
  size: number;
  qualityInfo?: QualityInfo;
}

interface AlbumDownloadResult {
  success: boolean;
  albumId: string;
  albumTitle: string;
  albumArtist: string;
  totalSongs: number;
  downloadedSongs: number;
  failedSongs: number;
  downloads: DownloadResult[];
  failed: Array<{
    position: number;
    title: string;
    videoId: string;
    reason: string;
  }>;
  format: string;
  quality: string;
  albumPath: string;
}

interface QualityInfo {
  type: 'audio' | 'video' | 'unknown';
  bitrate?: string;
  sampleRate?: string;
  codec?: string;
  resolution?: string;
  fps?: string;
  videoBitrate?: string;
  videoCodec?: string;
  quality?: string;
}

interface ActiveDownload {
  id: string;
  type: 'song' | 'album';
  title: string;
  progress: number;
  status: 'downloading' | 'completed' | 'error';
  format: string;
  quality: string;
  startTime: Date;
  error?: string;
  result?: DownloadResult | AlbumDownloadResult;
  albumProgress?: AlbumDownloadProgress;
  qualityInfo?: QualityInfo;
  artist?: string;
  fileSize?: string;
}

export interface FormatOption {
  id: string;
  format: string;
  quality: string;
  formatId?: string;
  label: string;
  description?: string;
  type: 'audio' | 'video';
  codec?: string;
  bitrate?: number | string;
  sampleRate?: string;
  resolution?: string;
  fps?: string;
  videoBitrate?: number | string;
  audioBitrate?: number | string;
  audioCodec?: string;
  videoCodec?: string;
  filesize?: number;
  filesizeMB?: string | null;
  native?: boolean;
  note?: string;
  qualityRank?: number;
  container?: string;
}

interface AvailableFormats {
  audioFormats: FormatOption[];
  videoFormats: FormatOption[];
  simpleVideoFormats?: FormatOption[];
  advancedVideoFormats?: FormatOption[];
}

interface DownloadStore {
  // State
  activeDownloads: Map<string, ActiveDownload>;
  downloadHistory: (DownloadResult | AlbumDownloadResult)[];
  isConnected: boolean;
  socket: Socket | null;

  // Download Options
  selectedFormat: string;
  selectedQuality: string | number;
  availableFormats: AvailableFormats | null;
  formatsVideoId: string | null;
  isLoadingFormats: boolean;

  // Actions
  initializeSocket: (token: string) => void;
  disconnectSocket: () => void;
  downloadSong: (
    videoId: string,
    title: string,
    options?: {
      format?: string;
      quality?: string | number;
      formatId?: string;
      artist?: string;
      fileSize?: string;
    }
  ) => Promise<void>;
  downloadAlbum: (
    albumId: string,
    title: string,
    options?: { format?: string; quality?: string | number }
  ) => Promise<void>;
  cancelDownload: (downloadId: string) => Promise<void>;
  setFormat: (format: string) => void;
  setQuality: (quality: string | number) => void;
  clearHistory: () => void;
  removeFromHistory: (id: string) => void;
  getVideoInfo: (videoId: string) => Promise<any>;
  getAvailableFormats: (videoId: string) => Promise<void>;
  clearAvailableFormats: () => void;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  // Initial State
  activeDownloads: new Map(),
  downloadHistory: [],
  isConnected: false,
  socket: null,
  selectedFormat: 'audioonly',
  selectedQuality: 'highest',
  availableFormats: null,
  formatsVideoId: null,
  isLoadingFormats: false,

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
    socket.on('connect_error', (err) => console.error('Download socket error:', err.message));

    socket.onAny((eventName: string, data: any) => {
      if (eventName.startsWith('download-progress-')) {
        const videoId = eventName.replace('download-progress-', '');

        set((state) => {
          const downloads = new Map(state.activeDownloads);
          const existing = downloads.get(videoId);

          if (existing) {
            downloads.set(videoId, {
              ...existing,
              progress: data.percent || 0,
              status: 'downloading',
              qualityInfo: data.qualityInfo || existing.qualityInfo,
            });
          }

          return { activeDownloads: downloads };
        });
      }

      // Progreso de álbumes
      else if (eventName.startsWith('album-progress-')) {
        const albumId = eventName.replace('album-progress-', '');

        set((state) => {
          const downloads = new Map(state.activeDownloads);
          const existing = downloads.get(albumId);

          if (existing) {
            downloads.set(albumId, {
              ...existing,
              progress: data.overallProgress || 0,
              status: 'downloading',
              albumProgress: data,
            });
          }

          return { activeDownloads: downloads };
        });
      }

      // Completado de canciones
      else if (eventName.startsWith('download-complete-')) {
        const videoId = eventName.replace('download-complete-', '');

        set((state) => {
          const downloads = new Map(state.activeDownloads);
          const existing = downloads.get(videoId);

          if (existing) {
            downloads.set(videoId, {
              ...existing,
              progress: 100,
              status: 'completed',
              result: data,
            });

            // Trigger browser file download via fetch (includes Authorization header,
            // avoids Clerk handshake redirect that breaks anchor-tag downloads)
            if (data?.filename) {
              const origin = (axiosInstance.defaults.baseURL ?? '').replace(/\/api$/, '');
              const url = `${origin}/api/download/file/${encodeURIComponent(data.filename)}`;
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
                  a.download = data.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(blobUrl);
                })
                .catch((err) => console.error('File download failed:', err));
            }

            // Mover a historial después de unos segundos
            setTimeout(() => {
              set((state) => {
                const newDownloads = new Map(state.activeDownloads);
                const completed = newDownloads.get(videoId);
                newDownloads.delete(videoId);

                return {
                  activeDownloads: newDownloads,
                  downloadHistory: completed?.result
                    ? [completed.result, ...state.downloadHistory]
                    : state.downloadHistory,
                };
              });
            }, 3000);
          }

          return { activeDownloads: downloads };
        });
      }

      // Completado de álbumes
      else if (eventName.startsWith('album-complete-')) {
        const albumId = eventName.replace('album-complete-', '');

        set((state) => {
          const downloads = new Map(state.activeDownloads);
          const existing = downloads.get(albumId);

          if (existing) {
            downloads.set(albumId, {
              ...existing,
              progress: 100,
              status: 'completed',
              result: data,
            });

            // Mover a historial después de unos segundos
            setTimeout(() => {
              set((state) => {
                const newDownloads = new Map(state.activeDownloads);
                const completed = newDownloads.get(albumId);
                newDownloads.delete(albumId);

                return {
                  activeDownloads: newDownloads,
                  downloadHistory: completed?.result
                    ? [completed.result, ...state.downloadHistory]
                    : state.downloadHistory,
                };
              });
            }, 5000);
          }

          return { activeDownloads: downloads };
        });
      }

      // Errores
      else if (
        eventName.startsWith('download-error-') ||
        eventName.startsWith('album-error-')
      ) {
        const id = eventName.includes('download-error-')
          ? eventName.replace('download-error-', '')
          : eventName.replace('album-error-', '');

        set((state) => {
          const downloads = new Map(state.activeDownloads);
          const existing = downloads.get(id);

          if (existing) {
            downloads.set(id, {
              ...existing,
              status: 'error',
              error: data.error,
            });

            // Quitar después de unos segundos
            setTimeout(() => {
              set((state) => {
                const newDownloads = new Map(state.activeDownloads);
                newDownloads.delete(id);
                return { activeDownloads: newDownloads };
              });
            }, 5000);
          }

          return { activeDownloads: downloads };
        });
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

  downloadSong: async (videoId: string, title: string, options = {}) => {
    const { selectedFormat, selectedQuality } = get();
    const format = options.format || selectedFormat;
    const quality = options.quality || selectedQuality;
    const formatId = options.formatId;
    const artist = options.artist;
    const fileSize = options.fileSize;

    try {
      // Agregar a descargas activas
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        downloads.set(videoId, {
          id: videoId,
          type: 'song',
          title,
          progress: 0,
          status: 'downloading',
          format,
          quality: quality.toString(),
          startTime: new Date(),
          artist,
          fileSize,
        });
        return { activeDownloads: downloads };
      });

      // Crear notificación personalizada más rica
      const displayTitle = artist ? `${artist} - ${title}` : title;
      const sizeInfo = fileSize ? `\n📦 ${fileSize} MB` : '';

      toast.success(`🎵 ${displayTitle}${sizeInfo}`, {
        duration: 4000,
        style: {
          background: '#27272a',
          border: '1px solid #22c55e',
          color: '#f8fafc',
          borderRadius: '8px',
          padding: '16px',
          fontSize: '14px',
          fontWeight: '500',
          minWidth: '280px',
          textAlign: 'center',
          whiteSpace: 'pre-line',
        },
        iconTheme: {
          primary: '#22c55e',
          secondary: '#ffffff',
        },
      });

      interface DownloadSongRequest {
        videoId: string;
        format: string;
        quality: string | number;
        formatId?: string;
      }

      const requestBody: DownloadSongRequest = { videoId, format, quality };
      if (formatId) requestBody.formatId = formatId;

      const response = await axiosInstance.post('/download/song', requestBody);
      const result = response.data?.data;
      const filename = result?.filename;

      // Mark as completed immediately
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        const existing = downloads.get(videoId);
        if (existing) {
          downloads.set(videoId, { ...existing, progress: 100, status: 'completed', result });
        }
        return { activeDownloads: downloads };
      });

      // Move to history after a short delay
      setTimeout(() => {
        set((state) => {
          const downloads = new Map(state.activeDownloads);
          const item = downloads.get(videoId);
          downloads.delete(videoId);
          const historyEntry = result ?? (item ? { videoId, title: item.title, format: item.format, quality: item.quality, filename: '', duration: 0, size: 0, success: true } : null);
          return {
            activeDownloads: downloads,
            downloadHistory: historyEntry ? [historyEntry, ...state.downloadHistory] : state.downloadHistory,
          };
        });
      }, 3000);

      if (filename) {
        const origin = (axiosInstance.defaults.baseURL ?? '').replace(/\/api$/, '');
        const url = `${origin}/api/download/file/${encodeURIComponent(filename)}`;
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
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          })
          .catch((err) => console.error('File download failed:', err));
      }
    } catch (error) {
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        downloads.delete(videoId);
        return { activeDownloads: downloads };
      });

      const message =
        getApiError(error) ?? 'Download failed';
      toast.error(`❌ Download failed: ${message}`);
      console.error('Download song error:', error);
    }
  },

  downloadAlbum: async (albumId: string, title: string, options = {}) => {
    const { selectedFormat, selectedQuality } = get();
    const format = options.format || selectedFormat;
    const quality = options.quality || selectedQuality;

    // Solo formatos de audio para álbumes
    if (['mp4', 'webm'].includes(format)) {
      toast.error('Video formats not supported for album downloads');
      return;
    }

    try {
      // Agregar a descargas activas
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        downloads.set(albumId, {
          id: albumId,
          type: 'album',
          title,
          progress: 0,
          status: 'downloading',
          format,
          quality: quality.toString(),
          startTime: new Date(),
        });
        return { activeDownloads: downloads };
      });

      toast.success(
        `💿 Starting album download: ${title} (${format.toUpperCase()})`
      );

      const response = await axiosInstance.post('/download/album', {
        albumId,
        format,
        quality,
      });
      const result = response.data?.data;

      // Mark as completed immediately
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        const existing = downloads.get(albumId);
        if (existing) {
          downloads.set(albumId, { ...existing, progress: 100, status: 'completed', result });
        }
        return { activeDownloads: downloads };
      });

      // Move to history after a short delay
      setTimeout(() => {
        set((state) => {
          const downloads = new Map(state.activeDownloads);
          downloads.delete(albumId);
          const historyEntry = result ?? null;
          return {
            activeDownloads: downloads,
            downloadHistory: historyEntry ? [historyEntry, ...state.downloadHistory] : state.downloadHistory,
          };
        });
      }, 3000);
    } catch (error) {
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        downloads.delete(albumId);
        return { activeDownloads: downloads };
      });

      const message =
        getApiError(error) ?? 'Album download failed';
      toast.error(`❌ Album download failed: ${message}`);
      console.error('Download album error:', error);
    }
  },

  cancelDownload: async (downloadId: string) => {
    try {
      // Buscar en descargas activas para crear la downloadKey
      const { activeDownloads } = get();
      const download = activeDownloads.get(downloadId);

      if (!download) {
        toast.error('Download not found');
        return;
      }

      const downloadKey = `${download.type}_${downloadId}_${download.format}_${download.quality}`;

      await axiosInstance.delete(`/download/cancel/${downloadKey}`);

      // Remover de descargas activas
      set((state) => {
        const downloads = new Map(state.activeDownloads);
        downloads.delete(downloadId);
        return { activeDownloads: downloads };
      });

      toast.success(`🚫 Download cancelled: ${download.title}`);
    } catch (error) {
      const message =
        getApiError(error) ?? 'Cancel failed';
      toast.error(`❌ Cancel failed: ${message}`);
      console.error('Cancel download error:', error);
    }
  },

  getVideoInfo: async (videoId: string) => {
    try {
      const response = await axiosInstance.get(`/download/info/${videoId}`);
      return response.data.data;
    } catch (error) {
      const message =
        getApiError(error) ?? 'Failed to get video info';
      toast.error(`❌ ${message}`);
      throw error;
    }
  },

  setFormat: (format: string) => {
    set({ selectedFormat: format });
  },

  setQuality: (quality: string | number) => {
    set({ selectedQuality: quality });
  },

  clearHistory: () => {
    set({ downloadHistory: [] });
  },

  removeFromHistory: (id: string) => {
    set((state) => ({
      downloadHistory: state.downloadHistory.filter(
        (item) => ('videoId' in item ? item.videoId : item.albumId) !== id
      ),
    }));
  },

  getAvailableFormats: async (videoId: string) => {
    set({ isLoadingFormats: true, formatsVideoId: videoId });

    try {
      const response = await axiosInstance.get(`/download/formats/${videoId}`);
      set({
        availableFormats: response.data.data,
        isLoadingFormats: false,
      });
    } catch (error) {
      console.error('Error getting available formats:', error);
      set({
        availableFormats: null,
        formatsVideoId: null,
        isLoadingFormats: false,
      });
    }
  },

  clearAvailableFormats: () => {
    set({ availableFormats: null, formatsVideoId: null });
  },
}));
