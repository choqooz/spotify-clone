import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { FavoriteButton } from '@/components/FavoriteButton';
import { formatDuration } from '@/lib/utils';
import { Clock, Heart, Pause, Play } from 'lucide-react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SongRowSkeleton } from '@/components/skeletons/SongRowSkeleton';

export const FavoritesPage = () => {
  const { favorites, fetchFavorites, isLoading } = useFavoriteStore(
    useShallow((s) => ({
      favorites: s.favorites,
      fetchFavorites: s.fetchFavorites,
      isLoading: s.isLoading,
    }))
  );
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      playAlbum: s.playAlbum,
      togglePlay: s.togglePlay,
    }))
  );

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handlePlayAll = () => {
    if (favorites.length === 0) return;
    const isFavoritesPlaying = favorites.some((s) => s._id === currentSong?._id);
    if (isFavoritesPlaying) togglePlay();
    else playAlbum(favorites, 0);
  };

  const handlePlaySong = (index: number) => {
    playAlbum(favorites, index);
  };

  if (isLoading) {
    return (
      <div className="h-full">
        <ScrollArea className="h-full rounded-md">
          <div className="relative min-h-full">
            <div
              className="absolute inset-0 bg-gradient-to-b from-red-900/60 via-zinc-900/80 to-zinc-900 pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative z-10 animate-pulse">
              {/* Header */}
              <div className="flex p-6 gap-6 pb-8">
                <div className="w-[240px] h-[240px] bg-zinc-800 rounded shadow-xl flex-shrink-0" />
                <div className="flex flex-col justify-end gap-3 flex-1">
                  <div className="h-4 bg-zinc-800 rounded w-16" />
                  <div className="h-14 bg-zinc-800 rounded w-40" />
                  <div className="h-4 bg-zinc-800 rounded w-20" />
                </div>
              </div>
              {/* Play button area */}
              <div className="px-6 pb-4">
                <div className="w-14 h-14 rounded-full bg-zinc-800" />
              </div>
              {/* Table */}
              <div className="bg-black/20 backdrop-blur-sm">
                <div className="grid grid-cols-[16px_4fr_2fr_1fr_48px] gap-4 px-10 py-2 border-b border-white/5">
                  <div className="h-4 bg-zinc-800 rounded" />
                  <div className="h-4 bg-zinc-800 rounded w-12" />
                  <div className="h-4 bg-zinc-800 rounded w-16" />
                  <div className="h-4 bg-zinc-800 rounded w-8" />
                  <div />
                </div>
                <div className="px-6">
                  <div className="space-y-2 py-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <SongRowSkeleton key={i} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ScrollArea className="h-full rounded-md">
        <div className="relative min-h-full">
          {/* bg gradient */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-red-900/60 via-zinc-900/80 to-zinc-900 pointer-events-none"
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex p-6 gap-6 pb-8">
              <div className="w-[240px] h-[240px] shadow-xl rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Heart className="size-24 text-red-500 fill-current" />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-sm font-medium">Playlist</p>
                <h1 className="text-7xl font-bold my-4">Favorites</h1>
                <div className="flex items-center gap-2 text-sm text-zinc-100">
                  <span>{favorites.length} songs</span>
                </div>
              </div>
            </div>

            {/* Play button */}
            {favorites.length > 0 && (
              <div className="px-6 pb-4 flex items-center gap-6">
                <Button
                  onClick={handlePlayAll}
                  size="icon"
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all"
                >
                  {isPlaying && favorites.some((s) => s._id === currentSong?._id) ? (
                    <Pause className="h-7 w-7 text-black" />
                  ) : (
                    <Play className="h-7 w-7 text-black" />
                  )}
                </Button>
              </div>
            )}

            {/* Song list */}
            <div className="bg-black/20 backdrop-blur-sm">
              {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-4">
                  <Heart className="size-16 text-zinc-600" />
                  <p className="text-xl font-medium">No favorites yet</p>
                  <p className="text-sm">Songs you like will appear here</p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[16px_4fr_2fr_1fr_48px] gap-4 px-10 py-2 text-sm text-zinc-400 border-b border-white/5">
                    <div>#</div>
                    <div>Title</div>
                    <div>Artist</div>
                    <div>
                      <Clock className="h-4 w-4" />
                    </div>
                    <div />
                  </div>

                  {/* Songs */}
                  <div className="px-6">
                    <div className="space-y-2 py-4">
                      {favorites.map((song, index) => {
                        const isCurrentSong = currentSong?._id === song._id;
                        return (
                          <div
                            key={song._id}
                            onClick={() => handlePlaySong(index)}
                            className="grid grid-cols-[16px_4fr_2fr_1fr_48px] gap-4 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 rounded-md group cursor-pointer"
                          >
                            <div className="flex items-center justify-center">
                              {isCurrentSong && isPlaying ? (
                                <div className="size-4 text-green-500">♫</div>
                              ) : (
                                <span className="group-hover:hidden">{index + 1}</span>
                              )}
                              {!isCurrentSong && (
                                <Play className="h-4 w-4 hidden group-hover:block" />
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <img
                                src={song.imageUrl}
                                alt={song.title}
                                className="size-10 rounded"
                              />
                              <div>
                                <div className="font-medium text-white">{song.title}</div>
                                <div>{song.artist}</div>
                              </div>
                            </div>

                            <div className="flex items-center">{song.artist}</div>

                            <div className="flex items-center">{formatDuration(song.duration)}</div>

                            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                              <FavoriteButton songId={song._id} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
