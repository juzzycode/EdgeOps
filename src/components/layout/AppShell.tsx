import type { PropsWithChildren } from 'react';
import { Bell, ChevronDown, Command, KeyRound, LogOut, MoonStar, Search, Settings2, SunMedium, UserCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Site } from '@/types/models';

const navItems = [
  ['Dashboard', '/dashboard'],
  ['Sites', '/sites'],
  ['Switches', '/switches'],
  ['Access Points', '/aps'],
  ['Clients', '/clients'],
  ['Alerts', '/alerts'],
  ['Profiles', '/profiles'],
  ['Firmware', '/firmware'],
  ['Settings', '/settings'],
];

export const AppShell = ({ children }: PropsWithChildren) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const { role, theme, selectedSiteId, setRole, setSelectedSiteId, toggleTheme, commandPaletteOpen, setCommandPaletteOpen } = useAppStore();

  useEffect(() => {
    api.getSites().then(setSites).catch(() => setSites([]));
  }, [location.pathname]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!profileMessage) return undefined;
    const timeout = window.setTimeout(() => setProfileMessage(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [profileMessage]);

  const selectedSiteName =
    selectedSiteId === 'all' ? 'All sites' : sites.find((site) => site.id === selectedSiteId)?.name ?? 'Scoped site';

  const goToSettings = () => {
    setProfileMenuOpen(false);
    navigate('/settings');
  };

  const handleChangePassword = () => {
    setProfileMenuOpen(false);
    navigate('/settings');
    setProfileMessage('Password management will live under Settings once authentication is wired.');
  };

  const handleNotificationSettings = () => {
    setProfileMenuOpen(false);
    navigate('/settings');
    setProfileMessage('Notification preferences are available under Settings.');
  };

  const handleSignOut = () => {
    setProfileMenuOpen(false);
    setRole('read_only');
    setSelectedSiteId('all');
    setCommandPaletteOpen(false);
    navigate('/dashboard');
    setProfileMessage('Signed out of the local workspace simulation.');
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1800px] gap-6 p-4 lg:p-6">
        <aside className="panel hidden w-72 shrink-0 flex-col p-4 lg:flex">
          <div className="rounded-[28px] bg-gradient-to-br from-accent/15 via-accent-muted to-sky-400/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">EdgeOps Cloud</p>
            <h1 className="mt-3 text-2xl font-semibold text-text">Network operations, simplified.</h1>
            <p className="mt-2 text-sm text-muted">Original monitoring UI built for distributed switching and wireless visibility.</p>
          </div>
          <nav className="mt-6 space-y-1">
            {navItems.map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => cn('flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition', isActive ? 'bg-accent text-white' : 'text-muted hover:bg-soft hover:text-text')}
              >
                <span>{label}</span>
                {location.pathname.startsWith(to) ? <ChevronDown className="h-4 w-4" /> : null}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-3xl border border-border bg-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Live update simulation</p>
            <p className="mt-2 text-sm text-text">Telemetry refreshes every 12 seconds so widgets feel closer to real operations tooling.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {profileMessage ? (
            <div className="mb-4 rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3 text-sm font-medium text-accent">
              {profileMessage}
            </div>
          ) : null}
          <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-2xl border px-4 py-2 text-sm font-medium transition',
                    isActive ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-muted',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          <header className="panel relative z-50 mb-6 overflow-visible p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="flex min-w-[260px] flex-1 items-center gap-3 rounded-2xl border border-border bg-soft px-4 py-3">
                  <Search className="h-4 w-4 text-muted" />
                  <input className="w-full border-0 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none" placeholder="Search sites, devices, clients, profiles..." />
                  <button className="rounded-xl border border-border px-2 py-1 text-xs text-muted" onClick={() => setCommandPaletteOpen(!commandPaletteOpen)}>
                    <span className="inline-flex items-center gap-1">
                      <Command className="h-3 w-3" />
                      K
                    </span>
                  </button>
                </div>

                <select value={selectedSiteId} onChange={(event) => setSelectedSiteId(event.target.value as string | 'all')} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text">
                  <option value="all">All sites</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>

                <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-3 text-sm capitalize text-text">
                  <option value="super_admin">Super Admin</option>
                  <option value="site_admin">Site Admin</option>
                  <option value="read_only">Read Only</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button className="focus-ring rounded-2xl border border-border bg-soft p-3 text-muted hover:text-text" onClick={toggleTheme}>
                  {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                </button>
                <button className="focus-ring rounded-2xl border border-border bg-soft p-3 text-muted hover:text-text">
                  <Bell className="h-4 w-4" />
                </button>
                <div className="relative" ref={profileMenuRef}>
                  <button
                    className="focus-ring flex items-center gap-3 rounded-2xl border border-border bg-soft px-4 py-3 text-left transition hover:border-accent/30"
                    onClick={() => setProfileMenuOpen((current) => !current)}
                    type="button"
                  >
                    <UserCircle2 className="h-5 w-5 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-text">Network Admin</p>
                      <p className="text-xs capitalize text-muted">{role.replace('_', ' ')}</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted transition', profileMenuOpen && 'rotate-180')} />
                  </button>

                  {profileMenuOpen ? (
                    <div className="absolute right-0 z-40 mt-3 w-80 rounded-3xl border border-border bg-surface p-3 shadow-2xl">
                      <div className="rounded-2xl bg-soft px-4 py-3">
                        <p className="text-sm font-semibold text-text">Network Admin</p>
                        <p className="mt-1 text-xs capitalize text-muted">{role.replace('_', ' ')}</p>
                        <p className="mt-2 text-xs text-muted">Current scope: {selectedSiteName}</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        <MenuAction
                          icon={UserCircle2}
                          label="Profile and Preferences"
                          description="Open Settings for workspace, profile, and platform controls."
                          onClick={goToSettings}
                        />
                        <MenuAction
                          icon={KeyRound}
                          label="Change Password"
                          description="Jump to the future credential management area."
                          onClick={handleChangePassword}
                        />
                        <MenuAction
                          icon={Bell}
                          label="Notification Settings"
                          description="Review alert delivery and local preference controls."
                          onClick={handleNotificationSettings}
                        />
                        <MenuAction
                          icon={Settings2}
                          label="Operator Settings"
                          description="Tune role simulation, site scope, and telemetry preferences."
                          onClick={goToSettings}
                        />
                        <MenuAction
                          icon={LogOut}
                          label="Logout"
                          description="Exit the local workspace simulation and return to read-only mode."
                          onClick={handleSignOut}
                          tone="danger"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
};

const MenuAction = ({
  icon: Icon,
  label,
  description,
  onClick,
  tone = 'default',
}: {
  icon: typeof UserCircle2;
  label: string;
  description: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) => (
  <button
    className={cn(
      'focus-ring flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition',
      tone === 'danger' ? 'hover:bg-danger/10' : 'hover:bg-soft',
    )}
    onClick={onClick}
    type="button"
  >
    <div className={cn('rounded-2xl p-2', tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent-muted text-accent')}>
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className={cn('text-sm font-medium', tone === 'danger' ? 'text-danger' : 'text-text')}>{label}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  </button>
);
