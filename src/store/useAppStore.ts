import { create } from 'zustand';
import type { AuthUser, Role } from '@/types/models';

interface AppState {
  theme: 'light' | 'dark';
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  sessionUser: AuthUser | null;
  role: Role;
  selectedSiteId: string | 'all';
  commandPaletteOpen: boolean;
  liveTick: number;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setAuthStatus: (status: AppState['authStatus']) => void;
  setSessionUser: (user: AuthUser) => void;
  clearSession: () => void;
  setSelectedSiteId: (siteId: string | 'all') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  bumpLiveTick: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  authStatus: 'loading',
  sessionUser: null,
  role: 'read_only',
  selectedSiteId: 'all',
  commandPaletteOpen: false,
  liveTick: 0,
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setAuthStatus: (authStatus) => set({ authStatus }),
  setSessionUser: (sessionUser) =>
    set(() => ({
      authStatus: 'authenticated',
      sessionUser,
      role: sessionUser.role,
      selectedSiteId: sessionUser.siteId ?? 'all',
    })),
  clearSession: () =>
    set({
      authStatus: 'unauthenticated',
      sessionUser: null,
      role: 'read_only',
      selectedSiteId: 'all',
      commandPaletteOpen: false,
    }),
  setSelectedSiteId: (selectedSiteId) => set({ selectedSiteId }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  bumpLiveTick: () => set((state) => ({ liveTick: state.liveTick + 1 })),
}));
