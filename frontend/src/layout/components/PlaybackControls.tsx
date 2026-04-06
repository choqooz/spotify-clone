import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLyricsStore } from '@/stores/useLyricsStore';
import {
  Mic2,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';

type VolumeSliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  orientation?: 'horizontal' | 'vertical';
};

// Custom Volume Slider with green colors
const VolumeSlider = ({
  className,
  orientation = 'horizontal',
  ...props
}: VolumeSliderProps) => (
  <SliderPrimitive.Root
    className={cn(
      'relative flex w-full touch-none select-none items-center',
      orientation === 'vertical' && 'flex-col h-full w-4',
      className
    )}
    orientation={orientation}
    {...props}>
    <SliderPrimitive.Track
      className={cn(
        'relative grow overflow-hidden rounded-full bg-zinc-700/50',
        orientation === 'vertical' ? 'w-1.5 h-full' : 'h-1.5 w-full'
      )}>
      <SliderPrimitive.Range
        className="absolute bg-green-500 rounded-full"
        style={{
          [orientation === 'vertical' ? 'width' : 'height']: '100%',
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-green-500/50 bg-white shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500 disabled:pointer-events-none disabled:opacity-50 hover:bg-green-50" />
  </SliderPrimitive.Root>
);

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const PlaybackControls = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    currentTime,
    duration,
    seekTo,
    volume,
    setVolume,
    isMuted,
    toggleMute,
  } = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      togglePlay: s.togglePlay,
      playNext: s.playNext,
      playPrevious: s.playPrevious,
      currentTime: s.currentTime,
      duration: s.duration,
      seekTo: s.seekTo,
      volume: s.volume,
      setVolume: s.setVolume,
      isMuted: s.isMuted,
      toggleMute: s.toggleMute,
    }))
  );

  const { toggleLyrics, isVisible: lyricsVisible } = useLyricsStore(
    useShallow((s) => ({ toggleLyrics: s.toggleLyrics, isVisible: s.isVisible }))
  );

  const [showMobileVolume, setShowMobileVolume] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const mobileVolumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = document.querySelector('audio') as HTMLAudioElement;
    if (audio && !currentSong?.videoId) {
      audio.volume = volume / 100;
    }
  }, [currentSong?.videoId, volume]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileVolumeRef.current &&
        !mobileVolumeRef.current.contains(event.target as Node)
      ) {
        setIsClosing(true);
        setTimeout(() => {
          setShowMobileVolume(false);
          setIsClosing(false);
        }, 300);
      }
    };

    if (showMobileVolume) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileVolume]);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="h-4 w-4" />;
    if (volume < 50) return <Volume1 className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  const handleSeek = (value: number[]) => {
    seekTo(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const toggleMobileVolume = () => {
    if (showMobileVolume) {
      setIsClosing(true);
      setTimeout(() => {
        setShowMobileVolume(false);
        setIsClosing(false);
      }, 300);
    } else {
      setShowMobileVolume(true);
      setIsOpening(true);
      setTimeout(() => setIsOpening(false), 50);
    }
  };

  return (
    <footer className="h-20 sm:h-24 bg-zinc-900 border-t border-zinc-800 px-4">
      <div className="flex justify-center sm:justify-between items-center h-full max-w-[1800px] mx-auto">
        {/* currently playing song */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 sm:min-w-[180px] sm:w-[30%] sm:flex-none">
          {currentSong && (
            <>
              <img
                src={currentSong.imageUrl}
                alt={currentSong.title}
                className="w-10 h-10 sm:w-14 sm:h-14 object-cover rounded-md flex-shrink-0"
              />
              <div className="flex-1 min-w-0 hidden sm:block">
                <div className="font-medium truncate hover:underline cursor-pointer">
                  {currentSong.title}
                </div>
                <div className="text-sm text-zinc-400 truncate hover:underline cursor-pointer">
                  {currentSong.artist}
                </div>
              </div>
              {/* Mobile: Show compact song info */}
              <div className="flex-1 min-w-0 sm:hidden">
                <div className="text-xs font-medium truncate">
                  {currentSong.title}
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  {currentSong.artist}
                </div>
              </div>
            </>
          )}
        </div>

        {/* player controls*/}
        <div className="flex flex-col items-center gap-1 sm:gap-2 flex-shrink-0 mx-2 sm:flex-1 sm:max-w-[45%]">
          <div className="flex items-center gap-2 sm:gap-6">
            <Button
              size="icon"
              variant="ghost"
              className="hidden sm:inline-flex hover:text-white text-zinc-400">
              <Shuffle className="h-4 w-4" />
            </Button>

            {/* Lyrics button (microphone) - moved to left of previous button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLyrics}
              className={cn('hover:text-white', lyricsVisible ? 'text-green-500' : 'text-zinc-400')}>
              <Mic2 className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={playPrevious}
              disabled={!currentSong}>
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              className="bg-white hover:bg-white/80 text-black rounded-full h-8 w-8"
              onClick={togglePlay}
              disabled={!currentSong}>
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={playNext}
              disabled={!currentSong}>
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Mobile Volume Control */}
            <div className="relative sm:hidden" ref={mobileVolumeRef}>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMobileVolume}
                className={cn('hover:text-white transition-colors', showMobileVolume ? 'text-white bg-zinc-800' : 'text-zinc-400')}>
                {getVolumeIcon()}
              </Button>

              {/* Mobile Volume Dropdown */}
              {showMobileVolume && (
                <div
                  className={cn(
                    'absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-16 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg backdrop-blur-sm z-50 transition-all duration-300 ease-out',
                    isOpening || isClosing ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                  )}
                  style={{ transformOrigin: '50% calc(100% + 16px)' }}>
                  <div className="h-24 w-6 flex items-center justify-center">
                    <VolumeSlider
                      value={[volume]}
                      max={100}
                      step={1}
                      orientation="vertical"
                      className="h-full hover:cursor-grab active:cursor-grabbing"
                      onValueChange={handleVolumeChange}
                    />
                  </div>
                </div>
              )}
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="hidden sm:inline-flex hover:text-white text-zinc-400">
              <Repeat className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile song slider */}
          <div className="flex sm:hidden items-center gap-2 w-full">
            <div className="text-xs text-zinc-400">
              {formatTime(currentTime)}
            </div>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="w-full hover:cursor-grab active:cursor-grabbing"
              onValueChange={handleSeek}
            />
            <div className="text-xs text-zinc-400">{formatTime(duration)}</div>
          </div>

          <div className="hidden sm:flex items-center gap-2 w-full">
            <div className="text-xs text-zinc-400">
              {formatTime(currentTime)}
            </div>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="w-full hover:cursor-grab active:cursor-grabbing"
              onValueChange={handleSeek}
            />
            <div className="text-xs text-zinc-400">{formatTime(duration)}</div>
          </div>
        </div>

        {/* Desktop volume controls */}
        <div className="hidden sm:flex items-center gap-4 min-w-[180px] w-[30%] justify-end">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              className="hover:text-white text-zinc-400">
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume1 className="h-4 w-4" />
              )}
            </Button>

            <VolumeSlider
              value={[volume]}
              max={100}
              step={1}
              className="w-24 hover:cursor-grab active:cursor-grabbing"
              onValueChange={handleVolumeChange}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
