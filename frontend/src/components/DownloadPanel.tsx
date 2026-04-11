import { useState } from 'react';
import { useDownloadStore } from '@/stores/useDownloadStore';
import type { ActiveDownload } from '@/stores/useDownloadStore';
import { useShallow } from 'zustand/react/shallow';
import {
  Download,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Music,
  Album,
  Trash2,
  StopCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDuration } from '@/lib/utils';

// Utils
const getStatusIcon = (status: string) => {
  const icons = {
    downloading: <Download className="h-4 w-4 animate-pulse text-blue-500" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
    default: <Clock className="h-4 w-4 text-gray-500" />,
  };
  return icons[status as keyof typeof icons] || icons.default;
};

const getTypeIcon = (type: string) => {
  return type === 'album' ? (
    <Album className="h-4 w-4" />
  ) : (
    <Music className="h-4 w-4" />
  );
};

const formatProgress = (download: ActiveDownload) => {
  if (download.type === 'album' && download.albumProgress) {
    const {
      currentSong,
      totalSongs,
      currentSongTitle,
      songProgress,
      overallProgress,
    } = download.albumProgress;
    return {
      mainProgress: overallProgress,
      subtitle: `Song ${currentSong}/${totalSongs}: ${currentSongTitle}`,
      subProgress: songProgress,
    };
  }
  return { mainProgress: download.progress, subtitle: null, subProgress: null };
};

interface DownloadPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadPanel({ isOpen, onClose }: DownloadPanelProps) {
  const {
    activeDownloads,
    downloadHistory,
    cancelDownload,
    clearHistory,
    removeFromHistory,
  } = useDownloadStore(
    useShallow((s) => ({
      activeDownloads: s.activeDownloads,
      downloadHistory: s.downloadHistory,
      cancelDownload: s.cancelDownload,
      clearHistory: s.clearHistory,
      removeFromHistory: s.removeFromHistory,
    }))
  );

  const [currentTab, setCurrentTab] = useState('active');

  const activeDownloadsArray = Array.from(activeDownloads.values());
  const hasActiveDownloads = activeDownloadsArray.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl h-auto bg-zinc-900 border border-zinc-800 shadow-2xl rounded-lg flex flex-col mx-auto p-4 sm:p-8 pt-6 pb-6">
        {/* Header */}
        <div className="flex flex-col items-center justify-center py-4 border-b border-zinc-800">
          <Download className="h-7 w-7 mb-1" />
          <h2 className="font-semibold text-lg">Downloads</h2>
        </div>
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
          onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
        {/* Tabs */}
        <Tabs
          value={currentTab}
          onValueChange={setCurrentTab}
          className="flex-1 flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-2 min-w-0 mt-4 overflow-hidden">
            <TabsTrigger
              value="active"
              className="relative min-w-0 flex items-center justify-center">
              Active
              {hasActiveDownloads && (
                <Badge
                  variant="default"
                  className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {activeDownloadsArray.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="min-w-0 flex items-center justify-center">
              History
              {downloadHistory.length > 0 && (
                <Badge
                  variant="default"
                  className="ml-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {downloadHistory.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          {/* Active Tab Content */}
          <TabsContent value="active" className="flex-1 m-0">
            <ScrollArea className="h-full p-4">
              {hasActiveDownloads ? (
                <div className="space-y-4">
                  {activeDownloadsArray.map((download) => {
                    const progress = formatProgress(download);
                    return (
                      <div
                        key={download.id}
                        className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getTypeIcon(download.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(download.status)}
                              <h3 className="font-medium text-sm truncate">
                                {download.title}
                              </h3>
                            </div>
                            <div className="space-y-2">
                              <Progress
                                value={progress.mainProgress}
                                className="h-2"
                              />
                              {progress.subtitle && (
                                <>
                                  <p className="text-xs text-zinc-400 truncate">
                                    {progress.subtitle}
                                  </p>
                                  {progress.subProgress !== null && (
                                    <Progress
                                      value={progress.subProgress}
                                      className="h-1"
                                    />
                                  )}
                                </>
                              )}
                              <div className="flex items-center justify-between text-xs text-zinc-400">
                                <span>
                                  {Math.round(progress.mainProgress)}%
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="h-5 text-xs">
                                    {download.format.toUpperCase()}
                                  </Badge>
                                  {download.status === 'downloading' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={() =>
                                        cancelDownload(download.id)
                                      }>
                                      <StopCircle className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {download.error && (
                              <p className="text-xs text-red-400 mt-2">
                                {download.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
                  <Download className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    No Active Downloads
                  </p>
                  <p className="text-sm">
                    Downloads will appear here when started
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          {/* History Tab Content (unchanged) */}
          <TabsContent value="history" className="flex-1 m-0">
            <ScrollArea className="h-full p-4">
              {downloadHistory.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-sm">Download History</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearHistory}
                      className="text-zinc-400 hover:text-white">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {downloadHistory.map((item, index) => {
                    const isAlbum = 'albumId' in item;
                    const id = isAlbum ? item.albumId : item.videoId;
                    const title = isAlbum ? item.albumTitle : item.title;
                    const subtitle = isAlbum
                      ? `${item.downloadedSongs} songs`
                      : formatDuration(item.duration);
                    return (
                      <div
                        key={`${id}-${index}`}
                        className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {isAlbum ? (
                              <Album className="h-4 w-4" />
                            ) : (
                              <Music className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <h4 className="font-medium text-sm truncate">
                                {title}
                              </h4>
                            </div>
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                              <span>{subtitle}</span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="h-5 text-xs">
                                  {item.format.toUpperCase()}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => removeFromHistory(id)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {/* Quality Information for History */}
                            {!isAlbum && item.qualityInfo && (
                              <div className="text-xs text-zinc-600 mt-1 flex flex-wrap gap-1">
                                {item.qualityInfo.type === 'audio' ? (
                                  <>
                                    {item.qualityInfo.bitrate !== 'unknown' && (
                                      <span className="bg-zinc-700/30 px-1.5 py-0.5 rounded text-xs">
                                        🎵 {item.qualityInfo.bitrate}
                                      </span>
                                    )}
                                    {item.qualityInfo.quality && (
                                      <span className="bg-zinc-700/30 px-1.5 py-0.5 rounded text-xs">
                                        {item.qualityInfo.quality}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {item.qualityInfo.resolution !==
                                      'unknown' && (
                                      <span className="bg-zinc-700/30 px-1.5 py-0.5 rounded text-xs">
                                        📺 {item.qualityInfo.resolution}
                                      </span>
                                    )}
                                    {item.qualityInfo.quality && (
                                      <span className="bg-zinc-700/30 px-1.5 py-0.5 rounded text-xs">
                                        {item.qualityInfo.quality}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            {isAlbum && item.failedSongs > 0 && (
                              <p className="text-xs text-yellow-400 mt-1">
                                {item.failedSongs} songs failed
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
                  <Clock className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    No Download History
                  </p>
                  <p className="text-sm">
                    Your completed downloads will appear here
                  </p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
