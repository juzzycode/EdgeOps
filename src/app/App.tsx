import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoadingState } from '@/components/common/States';
import { AppShell } from '@/components/layout/AppShell';
import { AlertsPage } from '@/features/alerts/AlertsPage';
import { ApDetailPage } from '@/features/aps/ApDetailPage';
import { ApsPage } from '@/features/aps/ApsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { FirmwarePage } from '@/features/firmware/FirmwarePage';
import { ProfilesPage } from '@/features/profiles/ProfilesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { SiteDetailPage } from '@/features/sites/SiteDetailPage';
import { SitesPage } from '@/features/sites/SitesPage';
import { SwitchDetailPage } from '@/features/switches/SwitchDetailPage';
import { SwitchesPage } from '@/features/switches/SwitchesPage';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

export const App = () => {
  const theme = useAppStore((state) => state.theme);
  const authStatus = useAppStore((state) => state.authStatus);
  const bumpLiveTick = useAppStore((state) => state.bumpLiveTick);
  const setAuthStatus = useAppStore((state) => state.setAuthStatus);
  const setSessionUser = useAppStore((state) => state.setSessionUser);
  const clearSession = useAppStore((state) => state.clearSession);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    setAuthStatus('loading');
    api
      .getSession()
      .then((session) => setSessionUser(session.user))
      .catch(() => clearSession());
  }, [clearSession, setAuthStatus, setSessionUser]);

  useEffect(() => {
    const handleAuthRequired = () => clearSession();
    window.addEventListener(api.authRequiredEventName, handleAuthRequired);
    return () => window.removeEventListener(api.authRequiredEventName, handleAuthRequired);
  }, [clearSession]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined;
    const timer = window.setInterval(() => bumpLiveTick(), 12000);
    return () => window.clearInterval(timer);
  }, [authStatus, bumpLiveTick]);

  if (authStatus === 'loading') {
    return <LoadingState label="Checking operator session..." />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
};

const ProtectedRoutes = () => {
  const location = useLocation();
  const authStatus = useAppStore((state) => state.authStatus);

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/sites/:id" element={<SiteDetailPage />} />
        <Route path="/switches" element={<SwitchesPage />} />
        <Route path="/switches/:id" element={<SwitchDetailPage />} />
        <Route path="/aps" element={<ApsPage />} />
        <Route path="/aps/:id" element={<ApDetailPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/firmware" element={<FirmwarePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
};
