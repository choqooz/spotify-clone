import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';
import { Message, User } from '@/types';
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface ChatStore {
  users: User[];
  isLoading: boolean;
  error: string | null;
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  userActivities: Map<string, string>;
  messages: Message[];
  selectedUser: User | null;

  fetchUsers: () => Promise<void>;
  initSocket: (userId: string, token: string) => void;
  disconnectSocket: () => void;
  sendMessage: (receiverId: string, content: string) => void;
  fetchMessages: (userId: string) => Promise<void>;
  setSelectedUser: (user: User | null) => void;
}

const getBaseURL = () => {
  if (import.meta.env.MODE === 'development') {
    const host = window.location.hostname;
    const port = import.meta.env.VITE_API_PORT ?? '5000';
    return `http://${host}:${port}`;
  }
  return '/';
};

const socket = io(getBaseURL(), {
  autoConnect: false,
  withCredentials: true,
});

export const useChatStore = create<ChatStore>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,
  socket: socket,
  isConnected: false,
  onlineUsers: new Set(),
  userActivities: new Map(),
  messages: [],
  selectedUser: null,

  setSelectedUser: (user) => set({ selectedUser: user }),

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get('/users');
      set({ users: response.data });
    } catch (error) {
      set({ error: getApiError(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  initSocket: (_userId, token) => {
    if (get().isConnected) return;

    socket.auth = { token }; // server verifies this, extracts userId
    socket.connect();

    socket.on('users_online', (users: string[]) => {
      set({ onlineUsers: new Set(users) });
    });

    socket.on('activities', (activities: [string, string][]) => {
      set({ userActivities: new Map(activities) });
    });

    socket.on('user_connected', (uid: string) => {
      set((state) => ({
        onlineUsers: new Set([...state.onlineUsers, uid]),
      }));
    });

    socket.on('user_disconnected', (uid: string) => {
      set((state) => {
        const updated = new Set(state.onlineUsers);
        updated.delete(uid);
        return { onlineUsers: updated };
      });
    });

    socket.on('receive_message', (message: Message) => {
      set((state) => ({ messages: [...state.messages, message] }));
    });

    socket.on('message_sent', (message: Message) => {
      set((state) => ({ messages: [...state.messages, message] }));
    });

    socket.on('activity_updated', ({ userId: uid, activity }: { userId: string; activity: string }) => {
      set((state) => {
        const updated = new Map(state.userActivities);
        updated.set(uid, activity);
        return { userActivities: updated };
      });
    });

    set({ isConnected: true });
  },

  disconnectSocket: () => {
    if (get().isConnected) {
      socket.disconnect();
      set({ isConnected: false });
    }
  },

  sendMessage: (receiverId, content) => {
    const sock = get().socket;
    if (!sock) return;
    sock.emit('send_message', { receiverId, content });
  },

  fetchMessages: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get(`/users/messages/${userId}`);
      set({ messages: response.data });
    } catch (error) {
      set({ error: getApiError(error) });
    } finally {
      set({ isLoading: false });
    }
  },
}));
