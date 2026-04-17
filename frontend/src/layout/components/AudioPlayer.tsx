import { usePlayerStore } from '@/stores/usePlayerStore';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import YouTube, { type YouTubePlayer, type YouTubeEvent } from 'react-youtube';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubeRef = useRef<YouTubePlayer | null>(null);
  // prevSongRef tracks either audioUrl (local) or videoId (YouTube) to detect song changes
  const prevSongRef = useRef<string | null>(null);
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [youtubeReady, setYoutubeReady] = useState(false);

  const {
    currentSong,
    isPlaying,
    playNext,
    setCurrentTime,
    setDuration,
    volume,
  } = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      playNext: s.playNext,
      setCurrentTime: s.setCurrentTime,
      setDuration: s.setDuration,
      volume: s.volume,
    }))
  );

  const seekCommand = usePlayerStore((s) => s.seekCommand);
  const volumeCommand = usePlayerStore((s) => s.volumeCommand);
  const restartCommand = usePlayerStore((s) => s.restartCommand);
  const youtubeStreamUrl = usePlayerStore((s) => s.youtubeStreamUrl);
  const setYoutubeStreamUrl = usePlayerStore((s) => s.setYoutubeStreamUrl);

  // Whether this song originally comes from YouTube (no local audioUrl)
  const isYouTubeSong = Boolean(currentSong?.videoId && !currentSong?.audioUrl);

  // TRUE → use the native <audio> element (local song OR YouTube with streaming URL ready)
  const useNativeAudioPlayer = !isYouTubeSong || !!youtubeStreamUrl;
  // TRUE → fall back to the YouTube iframe (YouTube song but streaming URL not yet available)
  const useYouTubeIframe = isYouTubeSong && !youtubeStreamUrl;

  // YouTube player options - optimized for local networks like chocolateey
  const youtubeOpts = {
    height: '0',
    width: '0',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      enablejsapi: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      // NO incluir origin para evitar bloqueos de CORS en red local - chocolateey solution
      ...(window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
        ? { origin: window.location.origin }
        : {}),
    },
  };

  // Helper function to safely call YouTube methods
  const safeYouTubeCall = (method: () => void) => {
    try {
      if (
        youtubeRef.current &&
        youtubeRef.current.getPlayerState &&
        typeof youtubeRef.current.getPlayerState === 'function'
      ) {
        method();
      }
    } catch {
      // YouTube API not ready yet — swallow silently
    }
  };

  // Handle play/pause logic
  useEffect(() => {
    if (useYouTubeIframe && youtubeRef.current) {
      if (isPlaying) {
        safeYouTubeCall(() => youtubeRef.current.playVideo());
      } else {
        safeYouTubeCall(() => youtubeRef.current.pauseVideo());
      }
    } else if (useNativeAudioPlayer && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          setNeedsManualPlay(true);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, useYouTubeIframe, useNativeAudioPlayer]);

  // Handle song ends — always wired on the audio element (covers both local and YouTube-via-native)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      playNext();
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [playNext]);

  // Handle audio element errors — clears the streaming URL so we fall back to iframe
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleError = () => {
      if (isYouTubeSong && youtubeStreamUrl) {
        // Streaming URL probably expired — clear it so iframe fallback kicks in
        setYoutubeStreamUrl(null, null);
      }
    };

    audio.addEventListener('error', handleError);
    return () => audio.removeEventListener('error', handleError);
  }, [isYouTubeSong, youtubeStreamUrl, setYoutubeStreamUrl]);

  // Handle song changes for local songs (audioUrl-based)
  useEffect(() => {
    if (isYouTubeSong || !audioRef.current || !currentSong?.audioUrl) return;

    const audio = audioRef.current;
    const isSongChange = prevSongRef.current !== currentSong.audioUrl;

    if (isSongChange) {
      audio.src = currentSong.audioUrl;
      audio.currentTime = 0;
      prevSongRef.current = currentSong.audioUrl;

      if (isPlaying) {
        audio.play().catch(() => {
          setNeedsManualPlay(true);
        });
      }
    }
  }, [currentSong, isPlaying, isYouTubeSong]);

  // Handle song changes for YouTube songs with a streaming URL (native audio path)
  useEffect(() => {
    if (!isYouTubeSong || !youtubeStreamUrl || !audioRef.current) return;

    const audio = audioRef.current;
    const isSongChange = prevSongRef.current !== currentSong?.videoId;

    if (isSongChange) {
      audio.src = youtubeStreamUrl;
      audio.currentTime = 0;
      prevSongRef.current = currentSong?.videoId ?? null;

      if (isPlaying) {
        audio.play().catch(() => {
          setNeedsManualPlay(true);
        });
      }
    }
  }, [currentSong, youtubeStreamUrl, isPlaying, isYouTubeSong]);

  // Handle song changes for YouTube songs using the iframe fallback
  useEffect(() => {
    if (!useYouTubeIframe || !currentSong?.videoId) return;

    const isNewYouTubeSong = prevSongRef.current !== currentSong.videoId;

    if (isNewYouTubeSong) {
      prevSongRef.current = currentSong.videoId;
      setNeedsManualPlay(false);
      setYoutubeReady(false);

      if (youtubeRef.current && isPlaying) {
        setTimeout(() => {
          safeYouTubeCall(() => youtubeRef.current.playVideo());
        }, 100);
      }
    }
  }, [currentSong, useYouTubeIframe, isPlaying]);

  // YouTube event handlers
  const onYouTubeReady = (event: YouTubeEvent) => {
    youtubeRef.current = event.target;
    setYoutubeReady(true);

    safeYouTubeCall(() => {
      youtubeRef.current.setVolume(volume);
      const duration = youtubeRef.current.getDuration();
      if (duration && duration > 0) {
        setDuration(duration);
      }
    });

    if (isPlaying && currentSong?.videoId) {
      setTimeout(() => {
        safeYouTubeCall(() => youtubeRef.current.playVideo());
      }, 500);
    }
  };

  const onYouTubeEnd = () => {
    playNext();
  };

  const onYouTubeError = (event: YouTubeEvent<number>) => {
    const errorCode = event.data;

    // YouTube error codes:
    // 2 - Invalid video ID
    // 5 - Video cannot be played in HTML5 player
    // 100 - Video not found or private
    // 101 - Video owner does not allow embedding
    // 150 - Video owner does not allow embedding

    let errorMessage = 'Error desconocido';
    switch (errorCode) {
      case 2:
        errorMessage = 'ID de video inválido';
        break;
      case 5:
        errorMessage = 'Video no compatible con reproductor HTML5';
        break;
      case 100:
        errorMessage = 'Video no encontrado o privado';
        break;
      case 101:
      case 150:
        errorMessage = 'Video no permite reproducción embebida';
        break;
    }

    if (import.meta.env.DEV) {
      console.error('YouTube player error', { code: errorCode, videoId: currentSong?.videoId, message: errorMessage });
    }
  };

  const onYouTubeStateChange = (event: YouTubeEvent<number>) => {
    const state = event.data;

    if (state === 1) {
      setNeedsManualPlay(false);
    } else if (state === 2) {
      if (isPlaying) {
        setTimeout(() => {
          setNeedsManualPlay(true);
        }, 1000);
      }
    } else if (state === 0) {
      setNeedsManualPlay(false);
    } else if (state === 5) {
      if (isPlaying) {
        setTimeout(() => {
          safeYouTubeCall(() => {
            youtubeRef.current.playVideo();
            setTimeout(() => {
              safeYouTubeCall(() => {
                const currentState = youtubeRef.current.getPlayerState();
                if (currentState !== 1 && isPlaying) {
                  setNeedsManualPlay(true);
                }
              });
            }, 1000);
          });
        }, 200);
      }
    }
  };

  // Time updates for YouTube iframe path
  useEffect(() => {
    if (!useYouTubeIframe || !youtubeReady || !youtubeRef.current) return;

    const interval = setInterval(() => {
      safeYouTubeCall(() => {
        const currentTime = youtubeRef.current.getCurrentTime();
        const duration = youtubeRef.current.getDuration();
        setCurrentTime(currentTime);
        if (duration) setDuration(duration);

        // Keep OS lockscreen progress bar in sync
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
          try {
            navigator.mediaSession.setPositionState({
              duration: duration || 0,
              playbackRate: 1,
              position: Math.min(currentTime, duration || 0),
            });
          } catch {
            // Some browsers throw if position > duration — swallow silently
          }
        }
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [useYouTubeIframe, youtubeReady, setCurrentTime, setDuration]);

  // Time updates for native audio element (local songs AND YouTube-via-streaming-URL)
  useEffect(() => {
    if (!useNativeAudioPlayer || !audioRef.current) return;

    const audio = audioRef.current;
    const updateTime = () => {
      setCurrentTime(audio.currentTime);

      // Keep OS lockscreen progress bar in sync
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration || 0,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration || 0),
          });
        } catch {
          // Some browsers throw if position > duration — swallow silently
        }
      }
    };
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [useNativeAudioPlayer, setCurrentTime, setDuration]);

  // Manual play function (iframe fallback path)
  const handleManualPlay = () => {
    if (useYouTubeIframe && youtubeRef.current && isPlaying) {
      safeYouTubeCall(() => {
        youtubeRef.current.playVideo();
        setNeedsManualPlay(false);
      });
    } else if (useNativeAudioPlayer && audioRef.current && isPlaying) {
      audioRef.current.play().catch(() => {});
      setNeedsManualPlay(false);
    }
  };

  // React to seek commands from the store
  useEffect(() => {
    if (!seekCommand) return;

    if (useYouTubeIframe && youtubeRef.current) {
      safeYouTubeCall(() => youtubeRef.current.seekTo(seekCommand.time, true));
    } else if (audioRef.current) {
      audioRef.current.currentTime = seekCommand.time;
    }

    usePlayerStore.getState().clearSeekCommand();
  }, [seekCommand, useYouTubeIframe]);

  // React to volume commands from the store
  useEffect(() => {
    if (!volumeCommand) return;

    if (useYouTubeIframe && youtubeRef.current) {
      safeYouTubeCall(() => youtubeRef.current.setVolume(volumeCommand.volume));
    } else if (audioRef.current) {
      audioRef.current.volume = volumeCommand.volume / 100;
    }

    usePlayerStore.getState().clearVolumeCommand();
  }, [volumeCommand, useYouTubeIframe]);

  // React to restart commands from the store
  useEffect(() => {
    if (restartCommand === null) return;

    if (useYouTubeIframe && youtubeRef.current) {
      safeYouTubeCall(() => {
        youtubeRef.current.seekTo(0, true);
        youtubeRef.current.playVideo();
      });
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        setNeedsManualPlay(true);
      });
    }

    usePlayerStore.getState().clearRestartCommand();
  }, [restartCommand, useYouTubeIframe]);

  return (
    <>
      {/* Native audio player — always mounted for local songs and YouTube-via-streaming-URL */}
      <audio ref={audioRef} />

      {/* YouTube iframe — only rendered as fallback when streaming URL is not yet available */}
      {useYouTubeIframe && currentSong?.videoId && (
        <YouTube
          key={currentSong.videoId}
          videoId={currentSong.videoId}
          opts={youtubeOpts}
          onReady={onYouTubeReady}
          onEnd={onYouTubeEnd}
          onStateChange={onYouTubeStateChange}
          onError={onYouTubeError}
          style={{ display: 'none' }}
        />
      )}

      {/* Manual play button when autoplay is blocked */}
      {needsManualPlay && (
        <div className="fixed top-20 right-4 z-50 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-sm text-zinc-300">
              <p className="font-medium">Autoplay bloqueado</p>
              <p className="text-xs text-zinc-400">Haz clic para reproducir</p>
            </div>
            <Button
              onClick={handleManualPlay}
              size="sm"
              className="bg-green-500 hover:bg-green-400 text-black">
              <Play className="size-4 mr-1" />
              Play
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
