import { usePlayerStore } from '@/stores/usePlayerStore';
import { AlertTriangle, RefreshCw, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayerErrorFallbackProps {
  onRetry?: () => void;
}

const PlayerErrorFallback = ({ onRetry }: PlayerErrorFallbackProps) => {
  const playNext = usePlayerStore((s) => s.playNext);

  const handleSkip = () => {
    playNext();
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4',
        'h-20 sm:h-24 bg-zinc-900 border-t border-zinc-800'
      )}>
      {/* Left: error info */}
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="size-4 text-yellow-500 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">Playback error</p>
          <p className="text-xs text-zinc-400 truncate">
            This video can't be played — try retrying or skip to the next song
          </p>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
              'bg-zinc-700 hover:bg-zinc-600 text-white transition-colors'
            )}>
            <RefreshCw className="size-3" />
            Retry
          </button>
        )}
        <button
          onClick={handleSkip}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
            'bg-green-600 hover:bg-green-500 text-white transition-colors'
          )}>
          <SkipForward className="size-3" />
          Skip
        </button>
      </div>
    </div>
  );
};

export { PlayerErrorFallback };
