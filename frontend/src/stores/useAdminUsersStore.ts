import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';
import { getApiError } from '@/lib/apiError';
import { User } from '@/types';

interface Pagination { page: number; limit: number; total: number; pages: number; }

interface AdminUsersStore {
  users: User[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  fetchUsers: (page?: number) => Promise<void>;
  toggleAdmin: (id: string) => Promise<void>;
}

export const useAdminUsersStore = create<AdminUsersStore>((set) => ({
  users: [],
  pagination: null,
  isLoading: false,
  error: null,

  fetchUsers: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get(`/admin/users?page=${page}&limit=20`);
      set({ users: res.data.users, pagination: res.data.pagination });
    } catch (error) {
      set({ error: getApiError(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleAdmin: async (id) => {
    try {
      const res = await axiosInstance.patch(`/admin/users/${id}/toggle-admin`);
      set((state) => ({
        users: state.users.map((u) => (u._id === id ? res.data.user : u)),
      }));
    } catch (error) {
      set({ error: getApiError(error) });
    }
  },
}));
