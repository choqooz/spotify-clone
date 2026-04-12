import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useYouTubeStore } from '@/stores/useYouTubeStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Share2, Clock, Download, Pause, Play } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useShallow } from 'zustand/react/shallow';
import { formatDuration } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

export const YouTubeAlbumPage = () => {
  const { albumId } = useParams();
  const { fetchYouTubeAlbum, currentAlbum, isLoadingAlbum } = useYouTubeStore(
    useShallow((s) => ({
      fetchYouTubeAlbum: s.fetchYouTubeAlbum,
      currentAlbum: s.currentAlbum,
      isLoadingAlbum: s.isLoadingAlbum,
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
  const isMobile = useIsMobile();

  useEffect(() => {
    if (albumId) fetchYouTubeAlbum(albumId);
  }, [fetchYouTubeAlbum, albumId]);

  if (isLoadingAlbum) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading album...</p>
        </div>
      </div>
    );
  }

  if (!currentAlbum) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Album not found</p>
        </div>
      </div>
    );
  }

  const handlePlayAlbum = () => {
    if (!currentAlbum?.songs || currentAlbum.songs.length === 0) return;

    const isCurrentAlbumPlaying = currentAlbum?.songs.some(
      (song) => song._id === currentSong?._id
    );
    if (isCurrentAlbumPlaying) {
      togglePlay();
    } else {
      // start playing the album from the beginning
      playAlbum(currentAlbum?.songs, 0);
    }
  };

  const handlePlaySong = (index: number) => {
    if (!currentAlbum?.songs || currentAlbum.songs.length === 0) return;
    playAlbum(currentAlbum.songs, index);
  };

  const handleDownload = () => {
    // Placeholder para descarga - en un futuro se puede implementar
    toast.success('Download feature coming soon!');
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://music.youtube.com/browse/${albumId}`;

      if (navigator.share) {
        // Usar Web Share API si está disponible (móvil)
        await navigator.share({
          title: `${currentAlbum?.title} - ${currentAlbum?.artist}`,
          text: `Check out this album: ${currentAlbum?.title} by ${currentAlbum?.artist}`,
          url: shareUrl,
        });
      } else {
        // Fallback: copiar al clipboard
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Album link copied to clipboard!');
      }
    } catch {
      toast.error('Could not share album');
    }
  };

  if (isMobile) {
    // Layout móvil optimizado
    return (
      <div className="h-full bg-gradient-to-b from-[#5038a0]/80 via-zinc-900/80 to-zinc-900">
        <ScrollArea className="h-full">
          <div className="px-4 pt-4">
            {/* Album header - móvil */}
            <div className="text-center mb-4">
              <img
                src={currentAlbum?.imageUrl}
                alt={currentAlbum?.title}
                className="w-64 h-64 mx-auto shadow-xl rounded-lg mb-4"
              />
              <h1 className="text-2xl font-bold mb-2">{currentAlbum?.title}</h1>
              <p className="text-lg text-zinc-300 mb-2">
                {currentAlbum?.artist}
              </p>
              <p className="text-sm text-zinc-400">
                Album • {currentAlbum?.releaseYear} •{' '}
                {currentAlbum?.songs?.length || 0} songs
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center items-center gap-4 mb-4">
              {/* Download button */}
              <Button
                onClick={handleDownload}
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500">
                <Download className="h-4 w-4" />
              </Button>

              {/* Play button - más pequeño */}
              <Button
                onClick={handlePlayAlbum}
                size="icon"
                className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-all">
                {isPlaying &&
                currentAlbum?.songs?.some(
                  (song) => song._id === currentSong?._id
                ) ? (
                  <Pause className="h-6 w-6 text-black" />
                ) : (
                  <Play className="h-6 w-6 text-black" />
                )}
              </Button>

              {/* Share button */}
              <Button
                onClick={handleShare}
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Songs list - móvil */}
            <div className="space-y-2 pb-4">
              {currentAlbum?.songs?.map((song, index) => {
                const isCurrentSong = currentSong?._id === song._id;
                return (
                  <div
                    key={song._id}
                    onClick={() => handlePlaySong(index)}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-md group cursor-pointer">
                    <div className="flex items-center justify-center w-6">
                      {isCurrentSong && isPlaying ? (
                        <div className="size-4 text-green-500">♫</div>
                      ) : (
                        <span className="text-sm text-zinc-400 group-hover:hidden">
                          {index + 1}
                        </span>
                      )}
                      {!isCurrentSong && (
                        <Play className="h-4 w-4 hidden group-hover:block text-white" />
                      )}
                    </div>

                    <img
                      src={song.imageUrl}
                      alt={song.title}
                      className="size-12 rounded"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {song.title}
                      </div>
                      <div className="text-sm text-zinc-400 truncate">
                        {song.artist}
                      </div>
                    </div>

                    <div className="text-sm text-zinc-400">
                      {formatDuration(song.duration)}
                    </div>
                  </div>
                );
              }) || []}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Layout desktop: mantener diseño actual
  return (
    <div className="h-full">
      <ScrollArea className="h-full rounded-md">
        {/* Main Content */}
        <div className="relative min-h-full">
          {/* bg gradient */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#5038a0]/80 via-zinc-900/80
					 to-zinc-900 pointer-events-none"
            aria-hidden="true"
          />

          {/* Content */}
          <div className="relative z-10">
            <div className="flex p-6 gap-6 pb-8">
              <img
                src={currentAlbum?.imageUrl}
                alt={currentAlbum?.title}
                className="w-[240px] h-[240px] shadow-xl rounded"
              />
              <div className="flex flex-col justify-end">
                <p className="text-sm font-medium">YouTube Album</p>
                <h1 className="text-7xl font-bold my-4">
                  {currentAlbum?.title}
                </h1>
                <div className="flex items-center gap-2 text-sm text-zinc-100">
                  <span className="font-medium text-white">
                    {currentAlbum?.artist}
                  </span>
                  <span>• {currentAlbum?.songs?.length || 0} songs</span>
                  <span>• {currentAlbum?.releaseYear}</span>
                </div>
              </div>
            </div>

            {/* action buttons */}
            <div className="px-6 pb-4 flex items-center gap-4">
              <Button
                onClick={handlePlayAlbum}
                size="icon"
                className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 
                hover:scale-105 transition-all">
                {isPlaying &&
                currentAlbum?.songs?.some(
                  (song) => song._id === currentSong?._id
                ) ? (
                  <Pause className="h-7 w-7 text-black" />
                ) : (
                  <Play className="h-7 w-7 text-black" />
                )}
              </Button>

              <Button
                onClick={handleDownload}
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500">
                <Download className="h-4 w-4" />
              </Button>

              <Button
                onClick={handleShare}
                variant="outline"
                size="icon"
                className="w-10 h-10 rounded-full border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Table Section */}
            <div className="bg-black/20 backdrop-blur-sm">
              {/* table header */}
              <div className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-10 py-2 text-sm text-zinc-400 border-b border-white/5">
                <div>#</div>
                <div>Title</div>
                <div>Artist</div>
                <div>
                  <Clock className="h-4 w-4" />
                </div>
              </div>

              {/* songs list */}
              <div className="px-6">
                <div className="space-y-2 py-4">
                  {currentAlbum?.songs?.map((song, index) => {
                    const isCurrentSong = currentSong?._id === song._id;
                    return (
                      <div
                        key={song._id}
                        onClick={() => handlePlaySong(index)}
                        className="grid grid-cols-[16px_4fr_2fr_1fr] gap-4 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 rounded-md group cursor-pointer">
                        <div className="flex items-center justify-center">
                          {isCurrentSong && isPlaying ? (
                            <div className="size-4 text-green-500">♫</div>
                          ) : (
                            <span className="group-hover:hidden">
                              {index + 1}
                            </span>
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
                            <div className="font-medium text-white">
                              {song.title}
                            </div>
                            <div>{song.artist}</div>
                          </div>
                        </div>
                        <div className="flex items-center">{song.artist}</div>
                        <div className="flex items-center">
                          {formatDuration(song.duration)}
                        </div>
                      </div>
                    );
                  }) || []}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};


