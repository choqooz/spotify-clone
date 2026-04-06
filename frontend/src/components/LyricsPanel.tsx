import { useLyricsStore, LyricLine } from '@/stores/useLyricsStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Mic2, Loader } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';

export const LyricsPanel = () => {
  const {
    lyricsData,
    currentLyricIndex,
    isLoading,
    error,
    isVisible,
    hideLyrics,
    fetchLyrics,
    updateCurrentLyric,
    seekToLyric,
  } = useLyricsStore(
    useShallow((s) => ({
      lyricsData: s.lyricsData,
      currentLyricIndex: s.currentLyricIndex,
      isLoading: s.isLoading,
      error: s.error,
      isVisible: s.isVisible,
      hideLyrics: s.hideLyrics,
      fetchLyrics: s.fetchLyrics,
      updateCurrentLyric: s.updateCurrentLyric,
      seekToLyric: s.seekToLyric,
    }))
  );

  const { currentSong, currentTime } = usePlayerStore(
    useShallow((s) => ({ currentSong: s.currentSong, currentTime: s.currentTime }))
  );

  // Refs for auto-scroll functionality
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentLyricRef = useRef<HTMLDivElement>(null);

  // State for exit animation
  const [isExiting, setIsExiting] = useState(false);

  // State for slide animation on mobile
  const [slideDirection, setSlideDirection] = useState<'up' | 'down' | null>(null);

  // Auto-fetch lyrics when a song is selected
  useEffect(() => {
    if (currentSong?.videoId && isVisible) {
      fetchLyrics(currentSong.videoId, currentSong.title, currentSong.artist);
    }
  }, [currentSong?.videoId, isVisible, fetchLyrics]);

  // Update current lyric in real-time
  useEffect(() => {
    if (lyricsData && currentTime >= 0) {
      updateCurrentLyric(currentTime);
    }
  }, [currentTime, lyricsData, updateCurrentLyric]);

  // Auto-scroll to current lyric
  useEffect(() => {
    if (currentLyricRef.current && scrollAreaRef.current && currentLyricIndex >= 0) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        const currentElement = currentLyricRef.current;
        const containerRect = scrollContainer.getBoundingClientRect();
        const elementRect = currentElement.getBoundingClientRect();

        const isAbove = elementRect.top < containerRect.top;
        const isBelow = elementRect.bottom > containerRect.bottom;

        if (isAbove || isBelow) {
          const elementTop = currentElement.offsetTop;
          const containerHeight = scrollContainer.clientHeight;
          const elementHeight = currentElement.clientHeight;
          const scrollTop = elementTop - containerHeight / 2 + elementHeight / 2;

          scrollContainer.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth',
          });
        }
      }
    }
  }, [currentLyricIndex]);

  const handleLyricClick = (
    line: LyricLine,
    clickedIndex: number,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (lyricsData?.type === 'synced' && line.time !== undefined) {
      const target = event.currentTarget;
      if (target) {
        target.blur();
        target.style.outline = 'none';
      }

      if (window.innerWidth <= 640) {
        if (clickedIndex < currentLyricIndex) {
          setSlideDirection('up');
        } else if (clickedIndex > currentLyricIndex) {
          setSlideDirection('down');
        }
        setTimeout(() => setSlideDirection(null), 300);
      }

      seekToLyric(line.time);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleTouchEnd = (
    line: LyricLine,
    clickedIndex: number,
    event: React.TouchEvent<HTMLDivElement>
  ) => {
    if (window.innerWidth <= 640) {
      event.preventDefault();
      const target = event.currentTarget;
      if (target) target.blur();

      if (lyricsData?.type === 'synced' && line.time !== undefined) {
        if (clickedIndex < currentLyricIndex) {
          setSlideDirection('up');
        } else if (clickedIndex > currentLyricIndex) {
          setSlideDirection('down');
        }
        setTimeout(() => setSlideDirection(null), 300);
        seekToLyric(line.time);
      }
    }
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      hideLyrics();
      setIsExiting(false);
    }, 300);
  };

  useEffect(() => {
    if (isVisible) setIsExiting(false);
  }, [isVisible]);

  if (!isVisible) return null;

  const getSlideAnimationClass = () => {
    if (slideDirection === 'up') return 'animate-pulse animate-in slide-in-from-top-2 duration-300';
    if (slideDirection === 'down') return 'animate-pulse animate-in slide-in-from-bottom-2 duration-300';
    return '';
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/20 backdrop-blur-sm z-40 duration-300',
          isExiting ? 'animate-out fade-out' : 'animate-in fade-in'
        )}
        onClick={handleClose}
      />

      {/* Lyrics Panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col duration-300 ease-out bg-zinc-900 border-zinc-800',
          'top-12 bottom-12 left-8 right-8 rounded-2xl border',
          'sm:right-0 sm:left-auto sm:w-72 sm:top-6 sm:bottom-6 sm:rounded-tl-2xl sm:rounded-bl-2xl sm:rounded-tr-none sm:rounded-br-none sm:border-l sm:border-t-0 sm:border-r-0 sm:border-b-0',
          isExiting ? 'animate-out slide-out-to-right' : 'animate-in slide-in-from-right'
        )}>
        {/* Header */}
        <div
          className={cn(
            'relative flex items-center justify-center p-3 sm:p-4 border-b border-zinc-800',
            !isExiting && 'animate-in fade-in slide-in-from-top delay-150 duration-500'
          )}>
          <div className="flex items-center gap-2">
            <Mic2 className="size-5 text-green-500" />
            <h3 className="font-semibold">Lyrics</h3>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-3 sm:right-4 text-zinc-400 hover:text-white"
            onClick={handleClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Lyrics Content */}
        <ScrollArea
          className={cn(
            'flex-1 p-3 sm:p-4',
            !isExiting && 'animate-in fade-in slide-in-from-bottom delay-300 duration-700'
          )}
          ref={scrollAreaRef}>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader className="size-6 animate-spin text-green-500" />
              <span className="ml-2 text-zinc-400">Loading lyrics...</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              {currentSong?.videoId && (
                <Button
                  onClick={() => fetchLyrics(currentSong.videoId!, currentSong.title, currentSong.artist)}
                  variant="outline"
                  size="sm">
                  Try again
                </Button>
              )}
            </div>
          )}

          {lyricsData && lyricsData.lines && lyricsData.lines.length > 0 && !isLoading && !error && (
            <div className={cn('space-y-0.5 mx-4', getSlideAnimationClass())}>
              {lyricsData.type === 'unsynced' && (
                <div className="text-xs text-zinc-500 mb-4 flex items-center gap-2">
                  <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white">
                    Not synchronized
                  </span>
                </div>
              )}

              {lyricsData.lines.map((line, index) => {
                const isCurrentLine = index === currentLyricIndex;
                const isPastLine = index < currentLyricIndex;
                const isClickable = lyricsData.type === 'synced' && line.time !== undefined;

                return (
                  <div
                    key={index}
                    onClick={(event) => handleLyricClick(line, index, event)}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(event) => handleTouchEnd(line, index, event)}
                    className={cn(
                      'text-sm leading-relaxed transition-all duration-300 py-2 px-4 rounded-xl relative',
                      'select-none touch-manipulation outline-none focus:outline-none active:outline-none',
                      '[-webkit-touch-callout:none] [-webkit-user-select:none] [-webkit-tap-highlight-color:transparent]',
                      isCurrentLine
                        ? 'text-white font-medium bg-zinc-800/60 scale-105 shadow-lg'
                        : isPastLine
                        ? 'text-zinc-500'
                        : 'text-zinc-300',
                      isClickable && 'cursor-pointer hover:bg-zinc-800/30 hover:text-white hover:scale-[1.02] sm:active:scale-95',
                      isClickable && !isCurrentLine && 'hover:shadow-md'
                    )}
                    ref={(el) => {
                      if (isCurrentLine && el) {
                        (currentLyricRef as React.MutableRefObject<HTMLDivElement>).current = el;
                      }
                    }}>
                    {isCurrentLine && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-green-500 rounded-full" />
                    )}

                    {isClickable && !isCurrentLine && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      </div>
                    )}

                    <div className="text-center">
                      <span>{line.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!currentSong?.videoId && !isLoading && (
            <div className="text-center py-12">
              <Mic2 className="size-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 mb-2">No song selected</p>
              <p className="text-xs text-zinc-500">Play a song to see lyrics</p>
            </div>
          )}

          {currentSong?.videoId && (!lyricsData || lyricsData.type === 'none') && !isLoading && !error && (
            <div className="text-center py-12">
              <p className="text-zinc-400 mb-2">
                {lyricsData?.message || 'No lyrics loaded'}
              </p>
              <Button
                onClick={() => fetchLyrics(currentSong.videoId!, currentSong.title, currentSong.artist)}
                variant="outline"
                size="sm">
                {lyricsData ? 'Try again' : 'Load lyrics'}
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
};
