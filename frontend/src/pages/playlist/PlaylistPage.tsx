import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePlaylistStore } from '@/stores/usePlaylistStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { formatDuration } from '@/lib/utils';
import { Clock, Pause, Play, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useShallow } from 'zustand/react/shallow';
import { SongRowSkeleton } from '@/components/skeletons/SongRowSkeleton';

export const PlaylistPage = () => {
  const { id } = useParams<{ id: string }>();
  const { fetchPlaylistById, currentPlaylist, isLoading, error, removeSong } = usePlaylistStore(
    useShallow((s) => ({
      fetchPlaylistById: s.fetchPlaylistById,
      currentPlaylist: s.currentPlaylist,
      isLoading: s.isLoading,
      error: s.error,
      removeSong: s.removeSong,
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
  const { user } = useUser();

  useEffect(() => {
    if (id) fetchPlaylistById(id);
  }, [fetchPlaylistById, id]);

  if (isLoading) {
    return (
      <div className="h-full">
        <ScrollArea className="h-full rounded-md">
          <div className="relative min-h-full">
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#4a3080]/80 via-zinc-900/80 to-zinc-900 pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative z-10 animate-pulse">
              {/* Header */}
              <div className="flex p-6 gap-6 pb-8">
                <div className="w-[240px] h-[240px] bg-zinc-800 rounded shadow-xl flex-shrink-0" />
                <div className="flex flex-col justify-end gap-3 flex-1">
                  <div className="h-4 bg-zinc-800 rounded w-20" />
                  <div className="h-14 bg-zinc-800 rounded w-2/3" />
                  <div className="h-4 bg-zinc-800 rounded w-24" />
                </div>
              </div>
              {/* Play button area */}
              <div className="px-6 pb-4">
                <div className="w-14 h-14 rounded-full bg-zinc-800" />
              </div>
              {/* Table */}
              <div className="bg-black/20 backdrop-blur-sm">
                <div className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-10 py-2 border-b border-white/5">
                  <div className="h-4 bg-zinc-800 rounded" />
                  <div className="h-4 bg-zinc-800 rounded w-12" />
                  <div className="h-4 bg-zinc-800 rounded w-16" />
                  <div className="h-4 bg-zinc-800 rounded w-8" />
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

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!currentPlaylist) return null;

  const isOwner = user?.id === currentPlaylist.clerkId;
  const songs = currentPlaylist.songs;

  const handlePlayPlaylist = () => {
    if (songs.length === 0) return;
    const isCurrentPlaylistPlaying = songs.some((song) => song._id === currentSong?._id);
    if (isCurrentPlaylistPlaying) togglePlay();
    else playAlbum(songs, 0);
  };

  const handlePlaySong = (index: number) => {
    playAlbum(songs, index);
  };

  return (
    <div className="h-full">
      <ScrollArea className="h-full rounded-md">
        <div className="relative min-h-full">
          {/* bg gradient */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#4a3080]/80 via-zinc-900/80 to-zinc-900 pointer-events-none"
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex p-6 gap-6 pb-8">
              {/* Playlist cover — use first song image or a placeholder */}
              <div className="w-[240px] h-[240px] shadow-xl rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {songs[0]?.imageUrl ? (
                  <img
                    src={songs[0].imageUrl}
                    alt={currentPlaylist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-zinc-500 text-6xl">♫</span>
                )}
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-sm font-medium">Playlist</p>
                <h1 className="text-7xl font-bold my-4">{currentPlaylist.name}</h1>
                {currentPlaylist.description && (
                  <p className="text-sm text-zinc-400 mb-2">{currentPlaylist.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-zinc-100">
                  <span>• {songs.length} songs</span>
                </div>
              </div>
            </div>

            {/* Play button */}
            <div className="px-6 pb-4 flex items-center gap-6">
              <Button
                onClick={handlePlayPlaylist}
                disabled={songs.length === 0}
                size="icon"
                className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all disabled:opacity-50">
                {isPlaying && songs.some((song) => song._id === currentSong?._id) ? (
                  <Pause className="h-7 w-7 text-black" />
                ) : (
                  <Play className="h-7 w-7 text-black" />
                )}
              </Button>
            </div>

            {/* Songs table */}
            <div className="bg-black/20 backdrop-blur-sm">
              {/* table header */}
              <div
                className={`grid gap-4 px-10 py-2 text-sm text-zinc-400 border-b border-white/5 ${
                  isOwner
                    ? 'grid-cols-[16px_4fr_2fr_1fr_auto]'
                    : 'grid-cols-[16px_4fr_2fr_1fr]'
                }`}>
                <div>#</div>
                <div>Title</div>
                <div>Artist</div>
                <div>
                  <Clock className="h-4 w-4" />
                </div>
                {isOwner && <div />}
              </div>

              {songs.length === 0 ? (
                <div className="px-10 py-8 text-zinc-400 text-sm">
                  This playlist is empty. Add songs to get started.
                </div>
              ) : (
                <div className="px-6">
                  <div className="space-y-2 py-4">
                    {songs.map((song, index) => {
                      const isCurrentSong = currentSong?._id === song._id;
                      return (
                        <div
                          key={song._id}
                          className={`grid gap-4 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 rounded-md group ${
                            isOwner
                              ? 'grid-cols-[16px_4fr_2fr_1fr_auto]'
                              : 'grid-cols-[16px_4fr_2fr_1fr]'
                          }`}>
                          <div
                            className="flex items-center justify-center cursor-pointer"
                            onClick={() => handlePlaySong(index)}>
                            {isCurrentSong && isPlaying ? (
                              <div className="size-4 text-green-500">♫</div>
                            ) : (
                              <span className="group-hover:hidden">{index + 1}</span>
                            )}
                            {!isCurrentSong && (
                              <Play className="h-4 w-4 hidden group-hover:block" />
                            )}
                          </div>

                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => handlePlaySong(index)}>
                            <img src={song.imageUrl} alt={song.title} className="size-10" />
                            <div>
                              <div className="font-medium text-white">{song.title}</div>
                              <div>{song.artist}</div>
                            </div>
                          </div>

                          <div
                            className="flex items-center cursor-pointer"
                            onClick={() => handlePlaySong(index)}>
                            {song.artist}
                          </div>

                          <div
                            className="flex items-center cursor-pointer"
                            onClick={() => handlePlaySong(index)}>
                            {formatDuration(song.duration)}
                          </div>

                          {isOwner && (
                            <div className="flex items-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 h-8 w-8 text-zinc-400 hover:text-red-400"
                                onClick={() => removeSong(currentPlaylist._id, song._id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
