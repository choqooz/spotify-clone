import { axiosInstance } from '@/lib/axios';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { useFavoriteStore } from '@/stores/useFavoriteStore';
import { useDownloadStore } from '@/stores/useDownloadStore';
import { useAuth } from '@clerk/clerk-react';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

const updateApiToken = (token: string | null) => {
  if (token)
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete axiosInstance.defaults.headers.common['Authorization'];
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { getToken, userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const { checkAdminStatus } = useAuthStore(useShallow((s) => ({ checkAdminStatus: s.checkAdminStatus })));
  const { initSocket, disconnectSocket } = useChatStore(useShallow((s) => ({ initSocket: s.initSocket, disconnectSocket: s.disconnectSocket })));
  const { fetchFavorites } = useFavoriteStore(useShallow((s) => ({ fetchFavorites: s.fetchFavorites })));
  const { initializeSocket: initDownloadSocket, disconnectSocket: disconnectDownloadSocket } = useDownloadStore(
    useShallow((s) => ({ initializeSocket: s.initializeSocket, disconnectSocket: s.disconnectSocket }))
  );

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = await getToken();
        updateApiToken(token);
        if (token && userId) {
          await checkAdminStatus();
          await fetchFavorites();
          initSocket(userId, token);
          initDownloadSocket(token); // dedicated authenticated socket for download events
        }
      } catch {
        updateApiToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      disconnectSocket();
      disconnectDownloadSocket();
    };
  }, [getToken, userId, checkAdminStatus, fetchFavorites, initSocket, disconnectSocket, initDownloadSocket, disconnectDownloadSocket]);

  if (loading)
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader className="size-8 text-emerald-500 animate-spin" />
      </div>
    );

  return <>{children}</>;
};

