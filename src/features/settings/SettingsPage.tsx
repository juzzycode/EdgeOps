import type { ReactNode } from 'react';
import { BellRing, Command, Database, Globe2, KeyRound, LifeBuoy, MoonStar, RefreshCcw, ShieldCheck, SlidersHorizontal, SunMedium, UserCog, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Alert, Client, ManagedUser, Role, RogueAccessPoint, Site } from '@/types/models';

const settingsStorageKey = 'edgeops-local-settings';

interface LocalSettings {
  desktopNotifications: boolean;
  compactTables: boolean;
  healthWarnings: boolean;
  telemetryCadence: '12s' | '30s' | '60s';
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UserFormState {
  username: string;
  password: string;
  role: Role;
  siteId: string;
}

const defaultSettings: LocalSettings = {
  desktopNotifications: true,
  compactTables: false,
  healthWarnings: true,
  telemetryCadence: '12s',
};

const defaultPasswordForm: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const defaultUserForm: UserFormState = {
  username: '',
  password: '',
  role: 'read_only',
  siteId: '',
};

export const SettingsPage = () => {
  const {
    role,
    sessionUser,
    theme,
    selectedSiteId,
    commandPaletteOpen,
    setTheme,
    setSelectedSiteId,
    setCommandPaletteOpen,
    clearSession,
  } = useAppStore();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [rogueAccessPoints, setRogueAccessPoints] = useState<RogueAccessPoint[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<LocalSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;

    try {
      const saved = window.localStorage.getItem(settingsStorageKey);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(defaultPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(defaultUserForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const refreshSnapshot = async () => {
    setError(null);

    try {
      const [siteRows, alertRows, clientRows, rogueRows, userRows] = await Promise.all([
        api.getSites(),
        api.getAlerts({ siteId: selectedSiteId, hours: 24 }),
        api.getClients(selectedSiteId),
        api.getRogueAps(selectedSiteId),
        role === 'super_admin' ? api.getUsers() : Promise.resolve([]),
      ]);

      setSites(siteRows);
      setAlerts(alertRows);
      setClients(clientRows);
      setRogueAccessPoints(rogueRows);
      setUsers(userRows);
    } catch (requestError) {
      setSites([]);
      setAlerts([]);
      setClients([]);
      setRogueAccessPoints([]);
      setUsers([]);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load settings snapshot');
    }
  };

  useEffect(() => {
    void refreshSnapshot();
  }, [selectedSiteId, role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings]);

  const scopedSites = useMemo(
    () => (selectedSiteId === 'all' ? sites ?? [] : (sites ?? []).filter((site) => site.id === selectedSiteId)),
    [selectedSiteId, sites],
  );

  const platformSummary = useMemo(() => {
    const reachableSites = scopedSites.filter((site) => site.apiReachable).length;
    const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical').length;
    const latencySamples = scopedSites.filter((site) => typeof site.latencyAvgMs === 'number');
    const averageLatency =
      latencySamples.reduce((sum, site) => sum + (site.latencyAvgMs ?? 0), 0) / Math.max(1, latencySamples.length);

    return {
      sites: scopedSites.length,
      reachableSites,
      alerts: alerts.length,
      criticalAlerts,
      clients: clients.length,
      rogueAccessPoints: rogueAccessPoints.length,
      averageLatency,
    };
  }, [alerts, clients, rogueAccessPoints, scopedSites]);

  const canManageUsers = role === 'super_admin';
  const visibleSites = sessionUser?.siteId ? (sites ?? []).filter((site) => site.id === sessionUser.siteId) : sites ?? [];
  const scopedRoleSelected = userForm.role !== 'super_admin';

  if (!sites) return <LoadingState label="Loading settings workspace..." />;

  const handleUserFormChange = (field: keyof UserFormState, value: string) => {
    setUserForm((current) => {
      if (field === 'role') {
        const nextRole = value as Role;
        return {
          ...current,
          role: nextRole,
          siteId: nextRole === 'super_admin' ? '' : current.siteId,
        };
      }

      return { ...current, [field]: value };
    });
  };

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserForm(defaultUserForm);
  };

  const handleCreateOrUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingUser(true);
    setUserMessage(null);
    setUserError(null);

    try {
      const payload = {
        username: userForm.username,
        role: userForm.role,
        siteId: userForm.siteId || null,
        ...(userForm.password.trim() ? { password: userForm.password } : {}),
      };

      if (editingUserId) {
        await api.updateUser(editingUserId, payload);
        setUserMessage('User updated.');
      } else {
        if (!userForm.password.trim()) {
          throw new Error('A password is required when creating a user');
        }
        await api.createUser({
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          siteId: userForm.siteId || null,
        });
        setUserMessage('User created.');
      }

      resetUserForm();
      await refreshSnapshot();
    } catch (requestError) {
      setUserError(requestError instanceof Error ? requestError.message : 'Unable to save user');
    } finally {
      setSavingUser(false);
    }
  };

  const beginEditUser = (user: ManagedUser) => {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username,
      password: '',
      role: user.role,
      siteId: user.siteId ?? '',
    });
    setUserMessage(null);
    setUserError(null);
  };

  const handleDeleteUser = async (user: ManagedUser) => {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    setDeletingUserId(user.id);
    setUserMessage(null);
    setUserError(null);

    try {
      await api.deleteUser(user.id);
      if (editingUserId === user.id) resetUserForm();
      await refreshSnapshot();
      setUserMessage('User deleted.');
    } catch (requestError) {
      setUserError(requestError instanceof Error ? requestError.message : 'Unable to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error('New password and confirmation do not match');
      }

      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(defaultPasswordForm);
      clearSession();
      setPasswordMessage('Password changed. Please sign in again with the new password.');
    } catch (requestError) {
      setPasswordError(requestError instanceof Error ? requestError.message : 'Unable to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Workspace controls, profile security, operator management, and platform posture in one place."
        actions={
          <>
            <ActionButton onClick={() => setCommandPaletteOpen(!commandPaletteOpen)}>
              <Command className="mr-2 h-4 w-4" />
              {commandPaletteOpen ? 'Close Command Palette' : 'Open Command Palette'}
            </ActionButton>
            <ActionButton onClick={() => void refreshSnapshot()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh Snapshot
            </ActionButton>
          </>
        }
      />

      {error ? <ErrorState title="Settings snapshot unavailable" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard label="Scoped Sites" value={String(platformSummary.sites)} hint={`${platformSummary.reachableSites} reachable`} icon={Globe2} />
        <SnapshotCard label="Critical Alerts" value={String(platformSummary.criticalAlerts)} hint={`${platformSummary.alerts} total in 24h`} icon={BellRing} />
        <SnapshotCard label="Clients" value={String(platformSummary.clients)} hint="Current selected scope" icon={UserCog} />
        <SnapshotCard label="Rogue APs" value={String(platformSummary.rogueAccessPoints)} hint="Detected by controller" icon={ShieldCheck} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Workspace Controls" subtitle="Browser-local controls that shape how this operator experiences the app.">
          <div className="space-y-4">
            <SettingRow
              icon={theme === 'dark' ? MoonStar : SunMedium}
              label="Theme"
              description="Switch between the dark NOC-style canvas and the light workspace theme."
              control={
                <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)} className={selectClassName}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              }
            />
            <SettingRow
              icon={Users}
              label="Signed-in role"
              description="Derived from the current session and enforced by the backend."
              control={<div className="rounded-2xl bg-soft px-4 py-2 text-sm font-medium capitalize text-text">{role.replace('_', ' ')}</div>}
            />
            <SettingRow
              icon={Globe2}
              label="Current Site Scope"
              description="Choose which visible site the rest of the app should use by default."
              control={
                <select
                  value={selectedSiteId}
                  onChange={(event) => setSelectedSiteId(event.target.value as string | 'all')}
                  disabled={Boolean(sessionUser?.siteId)}
                  className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  <option value="all">All Sites</option>
                  {visibleSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              }
            />
            <SettingRow
              icon={Command}
              label="Command Palette"
              description="Quickly open or close the palette state used by the top-bar shortcut."
              control={
                <button className="focus-ring rounded-2xl border border-border bg-soft px-4 py-2 text-sm text-text" onClick={() => setCommandPaletteOpen(!commandPaletteOpen)} type="button">
                  {commandPaletteOpen ? 'Open' : 'Closed'}
                </button>
              }
            />
          </div>
        </Panel>

        <Panel title="Profile Security" subtitle="Manage your own credentials and session posture.">
          <form className="space-y-4" onSubmit={handleChangePassword}>
            <InfoRow label="Signed-in user" value={sessionUser?.username ?? 'Unknown'} />
            <InfoRow label="Password last changed" value={sessionUser?.passwordChangedAt ? new Date(sessionUser.passwordChangedAt).toLocaleString() : 'Unknown'} />

            {passwordError ? <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{passwordError}</div> : null}
            {passwordMessage ? <div className="rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3 text-sm text-accent">{passwordMessage}</div> : null}

            <Field label="Current Password">
              <input className={inputClassName} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} type="password" value={passwordForm.currentPassword} />
            </Field>
            <Field label="New Password">
              <input className={inputClassName} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} type="password" value={passwordForm.newPassword} />
            </Field>
            <Field label="Confirm New Password">
              <input className={inputClassName} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} type="password" value={passwordForm.confirmPassword} />
            </Field>

            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70" disabled={changingPassword} type="submit">
              <KeyRound className="h-4 w-4" />
              {changingPassword ? 'Updating Password...' : 'Change Password'}
            </button>
          </form>
        </Panel>
      </div>

      {canManageUsers ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="User Directory" subtitle="Create and manage operators with super admin, site admin, and read-only access.">
            {userError ? <div className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{userError}</div> : null}
            {userMessage ? <div className="mb-4 rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3 text-sm text-accent">{userMessage}</div> : null}

            {users.length ? (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="rounded-3xl border border-border bg-soft p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-text">{user.username}</p>
                        <p className="mt-1 text-sm capitalize text-muted">{user.role.replace('_', ' ')}</p>
                        <p className="mt-2 text-sm text-muted">
                          Scope: {user.role === 'super_admin' ? 'All sites (global access)' : user.siteName ?? user.siteId ?? 'All sites'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="focus-ring rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-canvas" onClick={() => beginEditUser(user)} type="button">
                          Edit
                        </button>
                        <button className="focus-ring rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger hover:bg-danger/15 disabled:opacity-70" disabled={deletingUserId === user.id} onClick={() => void handleDeleteUser(user)} type="button">
                          {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No operators found" description="Create the first managed user account for this EdgeOps workspace." />
            )}
          </Panel>

          <Panel title={editingUserId ? 'Edit User' : 'Create User'} subtitle="Assign a role and optional site scope. Site-scoped users are restricted by the backend, not just the UI.">
            <form className="space-y-4" onSubmit={handleCreateOrUpdateUser}>
              <Field label="Username">
                <input className={inputClassName} onChange={(event) => handleUserFormChange('username', event.target.value)} value={userForm.username} />
              </Field>
              <Field label={editingUserId ? 'New Password' : 'Password'}>
                <input className={inputClassName} onChange={(event) => handleUserFormChange('password', event.target.value)} placeholder={editingUserId ? 'Leave blank to keep the current password' : ''} type="password" value={userForm.password} />
              </Field>
              <Field label="Role">
                <select className={inputClassName} onChange={(event) => handleUserFormChange('role', event.target.value)} value={userForm.role}>
                  <option value="super_admin">Super Admin</option>
                  <option value="site_admin">Site Admin</option>
                  <option value="read_only">Read Only</option>
                </select>
              </Field>
              <Field label="Assigned Site">
                <select
                  className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-70`}
                  disabled={!scopedRoleSelected}
                  onChange={(event) => handleUserFormChange('siteId', event.target.value)}
                  value={scopedRoleSelected ? userForm.siteId : ''}
                >
                  <option value="">{scopedRoleSelected ? 'All visible sites' : 'Not used for super admins'}</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="rounded-2xl bg-soft px-4 py-3 text-sm text-muted">
                {scopedRoleSelected
                  ? 'Assign a site to lock this user to a single location. If left blank, this scoped role can still see all available sites.'
                  : 'Super admins are always global, so assigned site is not stored for that role.'}
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70" disabled={savingUser} type="submit">
                  <UserPlus className="h-4 w-4" />
                  {savingUser ? 'Saving...' : editingUserId ? 'Save User' : 'Create User'}
                </button>
                {editingUserId ? (
                  <button className="focus-ring rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text hover:bg-soft" onClick={resetUserForm} type="button">
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </Panel>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Telemetry Posture" subtitle="Current health of the selected scope and backend-connected sites.">
          <div className="space-y-3">
            <InfoRow label="API Base URL" value={import.meta.env.VITE_API_BASE_URL || 'Same origin'} />
            <InfoRow label="Average WAN latency" value={Number.isFinite(platformSummary.averageLatency) ? `${platformSummary.averageLatency.toFixed(1)} ms` : 'Unavailable'} />
            <InfoRow label="Reachable FortiGates" value={`${platformSummary.reachableSites}/${platformSummary.sites}`} />
            <InfoRow label="Telemetry cadence" value={settings.telemetryCadence} />
          </div>
        </Panel>

        <Panel title="Local Preferences" subtitle="Saved to this browser so each operator can tune their own workflow.">
          <div className="space-y-4">
            <ToggleRow
              label="Desktop notifications"
              description="Reserve alert banners and browser notifications for future incident delivery."
              checked={settings.desktopNotifications}
              onChange={(checked) => setSettings((current) => ({ ...current, desktopNotifications: checked }))}
            />
            <ToggleRow
              label="Compact tables"
              description="Keep a denser visual layout for inventory-heavy workflows."
              checked={settings.compactTables}
              onChange={(checked) => setSettings((current) => ({ ...current, compactTables: checked }))}
            />
            <ToggleRow
              label="Health warning emphasis"
              description="Highlight degraded health states more aggressively in future UI refinements."
              checked={settings.healthWarnings}
              onChange={(checked) => setSettings((current) => ({ ...current, healthWarnings: checked }))}
            />
            <SettingRow
              icon={SlidersHorizontal}
              label="Telemetry cadence"
              description="Sets the intended refresh cadence for future live polling controls."
              control={
                <select value={settings.telemetryCadence} onChange={(event) => setSettings((current) => ({ ...current, telemetryCadence: event.target.value as LocalSettings['telemetryCadence'] }))} className={selectClassName}>
                  <option value="12s">12 seconds</option>
                  <option value="30s">30 seconds</option>
                  <option value="60s">60 seconds</option>
                </select>
              }
            />
          </div>
        </Panel>

        <Panel title="Platform Notes" subtitle="Useful implementation seams and next-step hooks.">
          <div className="space-y-3 text-sm text-muted">
            <InfoBullet icon={Database}>Session-backed users now live in a dedicated SQLite auth store with server-side role enforcement.</InfoBullet>
            <InfoBullet icon={ShieldCheck}>Site-scoped users are filtered server-side so API calls cannot hop across locations just by editing the UI.</InfoBullet>
            <InfoBullet icon={LifeBuoy}>Settings is now the home for password changes, operator management, and future audit or notification routing.</InfoBullet>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const inputClassName =
  'focus-ring w-full rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text placeholder:text-muted';

const selectClassName =
  'focus-ring rounded-2xl border border-border bg-soft px-4 py-2 text-sm text-text';

const SnapshotCard = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  hint: string;
}) => (
  <div className="panel p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-text">{value}</p>
        <p className="mt-2 text-sm text-muted">{hint}</p>
      </div>
      <div className="rounded-2xl bg-accent-muted p-3 text-accent">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const SettingRow = ({
  icon: Icon,
  label,
  description,
  control,
}: {
  icon: typeof UserCog;
  label: string;
  description: string;
  control: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-soft p-4">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-accent-muted p-2 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-medium text-text">{label}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

const ToggleRow = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-3xl border border-border bg-soft p-4">
    <div>
      <p className="font-medium text-text">{label}</p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-5 w-5 rounded border-border bg-soft text-accent focus:ring-accent"
    />
  </label>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-soft px-4 py-3">
    <span className="text-sm text-muted">{label}</span>
    <span className="text-right text-sm font-medium text-text">{value}</span>
  </div>
);

const InfoBullet = ({
  icon: Icon,
  children,
}: {
  icon: typeof Database;
  children: ReactNode;
}) => (
  <div className="flex items-start gap-3 rounded-2xl bg-soft px-4 py-3">
    <div className="rounded-2xl bg-accent-muted p-2 text-accent">
      <Icon className="h-4 w-4" />
    </div>
    <p>{children}</p>
  </div>
);

const Field = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
    {children}
  </label>
);
