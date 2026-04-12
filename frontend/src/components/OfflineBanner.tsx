import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-center gap-2 px-4 py-2',
        'bg-yellow-500/90 backdrop-blur-sm text-yellow-950',
        'text-sm font-medium'
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="size-4 shrink-0" />
      <span>You're offline — some features may be limited</span>
    </div>
  );
}
