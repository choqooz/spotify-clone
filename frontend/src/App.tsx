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

function App() {
  return (
    <>
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
    </>
  );
}

export default App;
