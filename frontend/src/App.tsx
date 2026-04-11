import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/home/HomePage';
import { AuthCallbackPage } from './pages/auth-callback/AuthCallbackPage';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { MainLayout } from './layout/MainLayout';
import { ChatPage } from './pages/chat/ChatPage';
import { AlbumPage } from './pages/album/AlbumPage';
import { YouTubeAlbumPage } from './pages/album/YouTubeAlbumPage';
import { AdminPage } from './pages/admin/AdminPage';

import { Toaster } from 'react-hot-toast';
import { NotFoundPage } from './pages/404/NotFoundPage';
import { SearchPage } from './pages/search/SearchPage';
import { FavoritesPage } from './pages/favorites/FavoritesPage';
import { PlaylistsPage } from './pages/playlist/PlaylistsPage';
import { PlaylistPage } from './pages/playlist/PlaylistPage';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppCrashFallback = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
    <div className="flex flex-col items-center gap-4 text-center px-4">
      <p className="text-lg font-semibold">The app encountered an error</p>
      <p className="text-sm text-zinc-400">Please refresh the page to continue.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md bg-zinc-700 hover:bg-zinc-600 px-6 py-2 text-sm font-medium transition-colors">
        Refresh
      </button>
    </div>
  </div>
);

function App() {
  return (
    <ErrorBoundary fallback={<AppCrashFallback />}>
      <Routes>
        <Route
          path="/sso-callback"
          element={
            <AuthenticateWithRedirectCallback
              signUpForceRedirectUrl={'/auth-callback'}
            />
          }
        />
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/admin" element={<AdminPage />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/albums/:albumId" element={<AlbumPage />} />
          <Route
            path="/youtube-albums/:albumId"
            element={<YouTubeAlbumPage />}
          />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/playlists/:id" element={<PlaylistPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </ErrorBoundary>
  );
}

export default App;
