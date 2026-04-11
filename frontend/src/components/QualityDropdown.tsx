import { useState, useEffect, type ReactNode } from 'react';
import { Download, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDownloadStore } from '@/stores/useDownloadStore';
import type { FormatOption } from '@/stores/useDownloadStore';
import { useShallow } from 'zustand/react/shallow';

interface QualityDropdownProps {
  videoId: string;
  title: string;
  artist?: string;
  onDownload?: (format: string, quality: string) => void;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'secondary' | 'outline';
  children?: ReactNode;
  className?: string;
  contentType?: 'songs' | 'videos' | 'both';
}

// Helper functions
const getQualityBadge = (format: FormatOption) => {
  const badgeClass = 'text-xs px-1.5 py-0.5 rounded';
  return format.native ? (
    <span className={`${badgeClass} bg-green-600/20 text-green-400`}>
      NATIVE
    </span>
  ) : (
    <span className={`${badgeClass} bg-yellow-600/20 text-yellow-400`}>
      CONVERTED
    </span>
  );
};

const getQualityIcon = (rank: number, total: number) => {
  const percentage = ((rank - 1) / (total - 1)) * 100;
  if (percentage <= 33) return '🔴';
  if (percentage <= 66) return '🟡';
  return '🟢';
};

// Sub-components
const FormatItem = ({
  format,
  onDownload,
  qualityIcon,
  showBadge = true,
}: {
  format: FormatOption;
  onDownload: () => void;
  qualityIcon: string;
  showBadge?: boolean;
}) => (
  <div
    onClick={onDownload}
    className="flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg cursor-pointer border border-zinc-700/50 hover:border-zinc-600 transition-all">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{qualityIcon}</span>
        <div className="font-medium text-sm text-white truncate">
          {format.label}
        </div>
        {showBadge && getQualityBadge(format)}
      </div>
      <div className="text-xs text-zinc-400 truncate">
        {format.description || format.container || format.resolution}
        {format.sampleRate &&
          format.sampleRate !== 'unknown' &&
          ` • ${format.sampleRate}`}
        {format.videoBitrate &&
          format.videoBitrate !== 'Auto' &&
          ` • ${format.videoBitrate} kbps`}
        {format.filesizeMB &&
          format.filesizeMB !== 'Variable' &&
          ` • ${format.filesizeMB} MB`}
      </div>
      {format.videoCodec && format.audioCodec && (
        <div className="text-xs text-zinc-500 mt-1">
          Video: {format.videoCodec} • Audio: {format.audioCodec}
        </div>
      )}
      {format.note && (
        <div className="text-xs text-yellow-500 mt-1">⚠️ {format.note}</div>
      )}
    </div>
    <Download className="h-4 w-4 ml-3 opacity-60 flex-shrink-0" />
  </div>
);

const FormatList = ({
  formats,
  onDownload,
  type = 'audio',
}: {
  formats: FormatOption[];
  onDownload: (format: FormatOption) => void;
  type?: 'audio' | 'video' | 'simple';
}) => {
  if (formats.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-400">
        <div className="text-sm">No {type} formats available</div>
        {type === 'simple' && (
          <div className="text-xs mt-1">Use Advanced tab for other codecs</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {formats.map((format) => {
        const qualityIcon =
          type === 'simple'
            ? '🎯'
            : format.qualityRank === 0
            ? '⭐'
            : getQualityIcon(format.qualityRank || 1, formats.length);

        const showBadge = type !== 'simple';

        return (
          <FormatItem
            key={format.id}
            format={format}
            onDownload={() => onDownload(format)}
            qualityIcon={qualityIcon}
            showBadge={showBadge}
          />
        );
      })}
    </div>
  );
};

export function QualityDropdown({
  videoId,
  title,
  artist,
  onDownload,
  size = 'sm',
  variant = 'default',
  children,
  className,
  contentType = 'both',
}: QualityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [isDirectDownloading, setIsDirectDownloading] = useState(false);
  const [shouldAutoOpen, setShouldAutoOpen] = useState(false);
  const {
    availableFormats,
    formatsVideoId,
    isLoadingFormats,
    getAvailableFormats,
    downloadSong,
    clearAvailableFormats,
  } = useDownloadStore(
    useShallow((s) => ({
      availableFormats: s.availableFormats,
      formatsVideoId: s.formatsVideoId,
      isLoadingFormats: s.isLoadingFormats,
      getAvailableFormats: s.getAvailableFormats,
      downloadSong: s.downloadSong,
      clearAvailableFormats: s.clearAvailableFormats,
    }))
  );

  useEffect(() => {
    if (currentVideoId !== videoId) {
      clearAvailableFormats();
      setCurrentVideoId(videoId);
      setShouldAutoOpen(false);
    }
  }, [videoId, currentVideoId, clearAvailableFormats]);

  // Solo abrir cuando se completa la carga Y se había solicitado
  useEffect(() => {
    if (
      shouldAutoOpen &&
      availableFormats &&
      !isLoadingFormats &&
      contentType !== 'songs'
    ) {
      setIsOpen(true);
      setShouldAutoOpen(false);
    }
  }, [shouldAutoOpen, availableFormats, isLoadingFormats, contentType]);

  const handleDirectDownload = async () => {
    setIsDirectDownloading(true);
    try {
      const options: { format: string; quality: string; artist?: string } = {
        format: 'audioonly',
        quality: 'highest',
      };
      if (artist) options.artist = artist;
      await downloadSong(videoId, title, options);
    } catch (error) {
      console.error('Direct download failed:', error);
    } finally {
      setIsDirectDownloading(false);
    }
  };

  const handleOpenChange = async (open: boolean) => {
    if (open && contentType === 'songs') {
      await handleDirectDownload();
      return;
    }

    if (open) {
      // Only use cached formats if they belong to THIS video
      if (availableFormats && formatsVideoId === videoId) {
        setIsOpen(true);
      } else {
        clearAvailableFormats();
        setShouldAutoOpen(true);
        await getAvailableFormats(videoId);
      }
    } else {
      setIsOpen(false);
      setShouldAutoOpen(false);
    }
  };

  const handleDownload = async (format: FormatOption) => {
    try {
      const options: {
        format: string;
        quality: string;
        formatId?: string;
        artist?: string;
        fileSize?: string;
      } = format.formatId
        ? { format: format.format, quality: format.quality, formatId: format.formatId }
        : { format: format.format, quality: format.quality };

      if (artist) options.artist = artist;
      if (format.filesizeMB) options.fileSize = format.filesizeMB || undefined;

      if (onDownload) {
        onDownload(format.format, format.quality);
      } else {
        await downloadSong(videoId, title, options);
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const showSpinner =
    isDirectDownloading || (isLoadingFormats && contentType !== 'songs');
  const iconClass = size === 'icon' ? 'size-3 lg:size-4' : 'h-4 w-4';

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={showSpinner}
          className={`${className || ''} ${
            size === 'icon'
              ? 'w-8 h-8 lg:w-10 lg:h-10 border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500 bg-zinc-800/80 hover:bg-zinc-700/80'
              : ''
          }`}>
          {children ||
            (showSpinner ? (
              <Loader className={`${iconClass} animate-spin`} />
            ) : (
              <Download className={iconClass} />
            ))}
        </Button>
      </DropdownMenuTrigger>

      {contentType !== 'songs' && (
        <DropdownMenuContent align="end" className="w-96 p-0">
          {availableFormats && (
            <div className="p-3">
              {contentType === 'both' ? (
                <Tabs defaultValue="audio" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="audio" className="text-xs">
                      🎵 Audio ({availableFormats.audioFormats.length})
                    </TabsTrigger>
                    <TabsTrigger value="video" className="text-xs">
                      📺 Video (
                      {availableFormats.simpleVideoFormats?.length ||
                        availableFormats.videoFormats.length}
                      )
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="audio"
                    className="mt-3 max-h-80 overflow-y-auto">
                    <FormatList
                      formats={availableFormats.audioFormats}
                      onDownload={handleDownload}
                      type="audio"
                    />
                  </TabsContent>

                  <TabsContent
                    value="video"
                    className="mt-3 max-h-80 overflow-y-auto">
                    <FormatList
                      formats={availableFormats.videoFormats}
                      onDownload={handleDownload}
                      type="video"
                    />
                  </TabsContent>
                </Tabs>
              ) : contentType === 'videos' ? (
                <Tabs defaultValue="simple" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="simple" className="text-xs">
                      📱 Simple (
                      {availableFormats.simpleVideoFormats?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className="text-xs">
                      ⚙️ Advanced ({availableFormats.videoFormats?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="simple"
                    className="mt-0 max-h-80 overflow-y-auto">
                    <FormatList
                      formats={availableFormats.simpleVideoFormats || []}
                      onDownload={handleDownload}
                      type="simple"
                    />
                  </TabsContent>

                  <TabsContent
                    value="advanced"
                    className="mt-0 max-h-80 overflow-y-auto">
                    <FormatList
                      formats={availableFormats.videoFormats}
                      onDownload={handleDownload}
                      type="video"
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="w-full">
                  <div className="mb-3">
                    <h3 className="text-sm font-medium text-zinc-300">
                      🎵 Audio Formats ({availableFormats.audioFormats.length})
                    </h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <FormatList
                      formats={availableFormats.audioFormats}
                      onDownload={handleDownload}
                      type="audio"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
