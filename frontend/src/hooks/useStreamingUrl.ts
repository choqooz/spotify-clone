import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { axiosInstance } from '@/lib/axios';

/**
 * Fetches a deciphered streaming URL for the currently playing YouTube song.
 * When a valid URL is available, AudioPlayer switches from the YouTube iframe
 * to the native <audio> element — enabling background playback and Media Session.
 *
 * Expiration is handled with a 5-minute buffer so we refresh before the URL
 * becomes stale during playback.
 */
export function useStreamingUrl() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const youtubeStreamUrl = usePlayerStore((s) => s.youtubeStreamUrl);
  const youtubeStreamExpiresAt = usePlayerStore((s) => s.youtubeStreamExpiresAt);
  const setYoutubeStreamUrl = usePlayerStore((s) => s.setYoutubeStreamUrl);

  const isYouTubeSong = Boolean(currentSong?.videoId && !currentSong?.audioUrl);

  useEffect(() => {
    if (!isYouTubeSong || !currentSong?.videoId) {
      setYoutubeStreamUrl(null, null);
      return;
    }

    // Re-use existing URL if still valid (5-minute expiry buffer)
    const fiveMinutesMs = 5 * 60 * 1000;
    const isExpired =
      youtubeStreamExpiresAt !== null &&
      Date.now() > youtubeStreamExpiresAt - fiveMinutesMs;

    if (youtubeStreamUrl && !isExpired) return;

    let cancelled = false;

    const fetchUrl = async () => {
      try {
        const { data } = await axiosInstance.get<{
          success: boolean;
          url: string;
          expiresAt: number;
        }>(`/download/streaming/${currentSong.videoId}`);

        if (!cancelled && data.success && data.url) {
          setYoutubeStreamUrl(data.url, data.expiresAt);
        }
      } catch {
        // Streaming URL fetch failed — YouTube song will fall back to iframe
        if (!cancelled) {
          setYoutubeStreamUrl(null, null);
        }
      }
    };

    fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.videoId, isYouTubeSong]); // eslint-disable-line react-hooks/exhaustive-deps
}
