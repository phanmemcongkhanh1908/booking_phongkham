import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: any | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('admin_token'),
  user: JSON.parse(localStorage.getItem('admin_user') || 'null'),
  setAuth: (token, user) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    const currentUser = JSON.parse(localStorage.getItem('admin_user') || 'null');
    if (currentUser?.slug) {
      localStorage.setItem('last_clinic_slug', currentUser.slug);
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    set({ token: null, user: null });
  },
}));
