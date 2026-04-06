import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Outlet } from 'react-router-dom';
import { LeftSidebar } from './components/LeftSidebar';
import { FriendsActivity } from './components/FriendsActivity';
import { AudioPlayer } from './components/AudioPlayer';
import { PlaybackControls } from './components/PlaybackControls';
import { LyricsPanel } from '@/components/LyricsPanel';
import { DownloadPanel } from '@/components/DownloadPanel';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

export const MainLayout = () => {
  const isMobile = useIsMobile();
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);

  if (isMobile) {
    // Layout móvil: contenido principal → player → bottom navigation
    return (
      <div className="h-dvh bg-black text-white flex flex-col">
        <AudioPlayer />

        {/* Contenido principal - ocupa todo el espacio disponible */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>

        {/* Player arriba del bottom nav */}
        <PlaybackControls />

        <div className="bg-zinc-900 border-t border-zinc-800">
          <LeftSidebar onOpenDownloadPanel={() => setShowDownloadPanel(true)} />
        </div>

        <LyricsPanel />
        <DownloadPanel
          isOpen={showDownloadPanel}
          onClose={() => setShowDownloadPanel(false)}
        />
      </div>
    );
  }

  // Layout desktop: mantener diseño actual
  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 flex h-full overflow-hidden p-2">
        <AudioPlayer />

        {/* left sidebar */}
        <ResizablePanel defaultSize={20} minSize={10} maxSize={30}>
          <LeftSidebar onOpenDownloadPanel={() => setShowDownloadPanel(true)} />
        </ResizablePanel>

        <ResizableHandle className="w-2 bg-black rounded-lg transition-colors" />

        {/* Main content */}
        <ResizablePanel defaultSize={60}>
          <Outlet />
        </ResizablePanel>

        <ResizableHandle className="w-2 bg-black rounded-lg transition-colors" />

        {/* right sidebar */}
        <ResizablePanel
          defaultSize={20}
          minSize={0}
          maxSize={25}
          collapsedSize={0}>
          <FriendsActivity />
        </ResizablePanel>
      </ResizablePanelGroup>

      <PlaybackControls />

      <LyricsPanel />
      <DownloadPanel
        isOpen={showDownloadPanel}
        onClose={() => setShowDownloadPanel(false)}
      />
    </div>
  );
};

