import { PlaylistSkeleton } from '@/components/skeletons/PlaylistSkeleton';
import { buttonVariants } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMusicStore } from '@/stores/useMusicStore';
import { useDownloadStore } from '@/stores/useDownloadStore';
import { useShallow } from 'zustand/react/shallow';
import { SignedIn } from '@clerk/clerk-react';
import {
  HomeIcon,
  Heart,
  Library,
  ListMusic,
  MessageCircle,
  Search,
  Download,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useIsMobile';

interface LeftSidebarProps {
  onOpenDownloadPanel?: () => void;
}

export const LeftSidebar = ({ onOpenDownloadPanel }: LeftSidebarProps) => {
  const { albums, fetchAlbums, isLoading } = useMusicStore(
    useShallow((s) => ({ albums: s.albums, fetchAlbums: s.fetchAlbums, isLoading: s.isLoading }))
  );
  const { activeDownloads } = useDownloadStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  if (isMobile) {
    // Layout móvil: navegación horizontal simple
    return (
      <div className="bg-zinc-900 p-2">
        <div className="flex justify-around items-center">
          <Link
            to={'/'}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'flex-col h-auto py-2 text-white hover:bg-zinc-800',
              })
            )}>
            <HomeIcon className="size-5 mb-1" />
            <span className="text-xs">Home</span>
          </Link>

          <Link
            to={'/search'}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'flex-col h-auto py-2 text-white hover:bg-zinc-800',
              })
            )}>
            <Search className="size-5 mb-1" />
            <span className="text-xs">Search</span>
          </Link>

          <button
            onClick={onOpenDownloadPanel}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className:
                  'flex-col h-auto py-2 text-white hover:bg-zinc-800 relative',
              })
            )}>
            <Download className="size-5 mb-1" />
            <span className="text-xs">Downloads</span>
            {activeDownloads.size > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                {activeDownloads.size}
              </div>
            )}
          </button>

          <SignedIn>
            <Link
              to={'/favorites'}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'flex-col h-auto py-2 text-white hover:bg-zinc-800',
                })
              )}>
              <Heart className="size-5 mb-1" />
              <span className="text-xs">Favorites</span>
            </Link>
          </SignedIn>

          <SignedIn>
            <Link
              to={'/playlists'}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className: 'flex-col h-auto py-2 text-white hover:bg-zinc-800',
                })
              )}>
              <ListMusic className="size-5 mb-1" />
              <span className="text-xs">Playlists</span>
            </Link>
          </SignedIn>

          <Link
            to={'/'}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className: 'flex-col h-auto py-2 text-white hover:bg-zinc-800',
              })
            )}>
            <Library className="size-5 mb-1" />
            <span className="text-xs">Library</span>
          </Link>

          <SignedIn>
            <Link
              to={'/chat'}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  size: 'sm',
                  className:
                    'flex-col h-auto py-2 text-white hover:bg-zinc-800',
                })
              )}>
              <MessageCircle className="size-5 mb-1" />
              <span className="text-xs">Chat</span>
            </Link>
          </SignedIn>
        </div>
      </div>
    );
  }

  // Layout desktop: mantener diseño actual
  return (
    <div className="h-full flex flex-col gap-2">
      {/* Navigation menu */}
      <div className="rounded-lg bg-zinc-900 p-4">
        <div className="space-y-2">
          <Link
            to={'/'}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                className: 'w-full justify-start text-white hover:bg-zinc-800',
              })
            )}>
            <HomeIcon className="mr-2 size-5" />
            <span className="hidden md:inline">Home</span>
          </Link>

          <SignedIn>
            <Link
              to={'/chat'}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  className:
                    'w-full justify-start text-white hover:bg-zinc-800',
                })
              )}>
              <MessageCircle className="mr-2 size-5" />
              <span className="hidden md:inline">Messages</span>
            </Link>
          </SignedIn>

          <Link
            to={'/search'}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                className: 'w-full justify-start text-white hover:bg-zinc-800',
              })
            )}>
            <Search className="mr-2 size-5" />
            <span className="hidden md:inline">Search</span>
          </Link>

          <SignedIn>
            <Link
              to={'/favorites'}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  className: 'w-full justify-start text-white hover:bg-zinc-800',
                })
              )}>
              <Heart className="mr-2 size-5" />
              <span className="hidden md:inline">Favorites</span>
            </Link>
          </SignedIn>

          <SignedIn>
            <Link
              to={'/playlists'}
              className={cn(
                buttonVariants({
                  variant: 'ghost',
                  className: 'w-full justify-start text-white hover:bg-zinc-800',
                })
              )}>
              <ListMusic className="mr-2 size-5" />
              <span className="hidden md:inline">Playlists</span>
            </Link>
          </SignedIn>

          <button
            onClick={onOpenDownloadPanel}
            className={cn(
              buttonVariants({
                variant: 'ghost',
                className:
                  'w-full justify-start text-white hover:bg-zinc-800 relative',
              })
            )}>
            <Download className="mr-2 size-5" />
            <span className="hidden md:inline">Downloads</span>
            {activeDownloads.size > 0 && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
                {activeDownloads.size}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Library section */}
      <div className="flex-1 rounded-lg bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-white px-2">
            <Library className="size-5 mr-2" />
            <span className="hidden md:inline">Playlists</span>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-2">
            {isLoading ? (
              <PlaylistSkeleton />
            ) : (
              albums.map((album) => (
                <Link
                  to={`/albums/${album._id}`}
                  key={album._id}
                  className="p-2 hover:bg-zinc-800 rounded-md flex items-center gap-3 group cursor-pointer">
                  <img
                    src={album.imageUrl}
                    alt="Playlist img"
                    className="size-12 rounded-md flex-shrink-0 object-cover"
                  />

                  <div className="flex-1 min-w-0 hidden md:block">
                    <p className="font-medium truncate">{album.title}</p>
                    <p className="text-sm text-zinc-400 truncate">
                      Album • {album.artist}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
