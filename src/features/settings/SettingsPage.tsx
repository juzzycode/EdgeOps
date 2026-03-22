import type { ReactNode } from 'react';
import { BellRing, Command, Database, Globe2, LifeBuoy, MoonStar, RefreshCcw, ShieldCheck, SlidersHorizontal, SunMedium, UserCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '@/components/common/ActionButton';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Alert, Client, RogueAccessPoint, Site } from '@/types/models';

const settingsStorageKey = 'edgeops-local-settings';

interface LocalSettings {
  desktopNotifications: boolean;
  compactTables: boolean;
  healthWarnings: boolean;
  telemetryCadence: '12s' | '30s' | '60s';
}

const defaultSettings: LocalSettings = {
  desktopNotifications: true,
  compactTables: false,
  healthWarnings: true,
  telemetryCadence: '12s',
};

export const SettingsPage = () => {
  const {
    role,
    theme,
    selectedSiteId,
    commandPaletteOpen,
    setRole,
    setTheme,
    setSelectedSiteId,
    setCommandPaletteOpen,
  } = useAppStore();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [rogueAccessPoints, setRogueAccessPoints] = useState<RogueAccessPoint[]>([]);
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

  const refreshSnapshot = async () => {
    setError(null);

    try {
      const [siteRows, alertRows, clientRows, rogueRows] = await Promise.all([
        api.getSites(),
        api.getAlerts({ siteId: selectedSiteId, hours: 24 }),
        api.getClients(selectedSiteId),
        api.getRogueAps(selectedSiteId),
      ]);

      setSites(siteRows);
      setAlerts(alertRows);
      setClients(clientRows);
      setRogueAccessPoints(rogueRows);
    } catch (requestError) {
      setSites([]);
      setAlerts([]);
      setClients([]);
      setRogueAccessPoints([]);
      setError(requestError instanceof Error ? requestError.message : 'Unable to load settings snapshot');
    }
  };

  useEffect(() => {
    refreshSnapshot();
  }, [selectedSiteId]);

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
    const averageLatency =
      scopedSites.filter((site) => typeof site.latencyAvgMs === 'number').reduce((sum, site) => sum + (site.latencyAvgMs ?? 0), 0) /
      Math.max(1, scopedSites.filter((site) => typeof site.latencyAvgMs === 'number').length);

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

  if (!sites) return <LoadingState label="Loading settings workspace..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Workspace controls, local operator preferences, telemetry posture, and platform health in one place."
        actions={
          <>
            <ActionButton onClick={() => setCommandPaletteOpen(!commandPaletteOpen)}>
              <Command className="mr-2 h-4 w-4" />
              {commandPaletteOpen ? 'Close Command Palette' : 'Open Command Palette'}
            </ActionButton>
            <ActionButton onClick={refreshSnapshot}>
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
        <Panel title="Workspace Controls" subtitle="Core operator settings that affect how the app behaves in this browser session.">
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
              icon={UserCog}
              label="Role Simulation"
              description="Use the role simulator to preview super admin, site admin, and read-only UI states."
              control={
                <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className={selectClassName}>
                  <option value="super_admin">Super Admin</option>
                  <option value="site_admin">Site Admin</option>
                  <option value="read_only">Read Only</option>
                </select>
              }
            />
            <SettingRow
              icon={Globe2}
              label="Default Site Scope"
              description="Choose which site scope the rest of the app should use by default."
              control={
                <select value={selectedSiteId} onChange={(event) => setSelectedSiteId(event.target.value as string | 'all')} className={selectClassName}>
                  <option value="all">All Sites</option>
                  {sites.map((site) => (
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
              control={<StatusBadge value={commandPaletteOpen ? 'healthy' : 'inactive'} />}
            />
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
            <div className="rounded-3xl border border-border bg-soft p-4 text-sm text-muted">
              These preferences are stored in local browser storage and do not affect backend polling or other operators.
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Telemetry Posture" subtitle="Current health of the selected scope and backend-connected sites.">
          <div className="space-y-3">
            <InfoRow label="API Base URL" value={import.meta.env.VITE_API_BASE_URL || 'Same origin'} />
            <InfoRow label="Average WAN latency" value={Number.isFinite(platformSummary.averageLatency) ? `${platformSummary.averageLatency.toFixed(1)} ms` : 'Unavailable'} />
            <InfoRow label="Reachable FortiGates" value={`${platformSummary.reachableSites}/${platformSummary.sites}`} />
            <InfoRow label="Telemetry cadence" value={settings.telemetryCadence} />
          </div>
        </Panel>

        <Panel title="Security and Access" subtitle="What matters most when this grows into a multi-admin platform.">
          <div className="space-y-3">
            <InfoRow label="Active role" value={role.replace('_', ' ')} />
            <InfoRow label="Command palette" value={commandPaletteOpen ? 'Enabled' : 'Closed'} />
            <InfoRow label="Credential handling" value="FortiGate API keys remain backend-side" />
            <InfoRow label="Operator note" value="Optional site admin credentials are reserved for future CLI collection flows" />
          </div>
        </Panel>

        <Panel title="Platform Notes" subtitle="Useful implementation seams and future feature hooks.">
          <div className="space-y-3 text-sm text-muted">
            <InfoBullet icon={Database}>SQLite-backed site and gateway cache stores are already in place behind the backend API.</InfoBullet>
            <InfoBullet icon={ShieldCheck}>Role-aware UI is simulated now and ready for route guards and permission checks later.</InfoBullet>
            <InfoBullet icon={LifeBuoy}>Settings is a natural home for backup exports, alert routing, webhook delivery, and audit history next.</InfoBullet>
          </div>
        </Panel>
      </div>

      <Panel title="Quick Actions" subtitle="Low-friction controls that help operators recover or reset their local workspace.">
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <SunMedium className="mr-2 h-4 w-4" /> : <MoonStar className="mr-2 h-4 w-4" />}
            Toggle Theme
          </ActionButton>
          <ActionButton
            onClick={() => {
              setSettings(defaultSettings);
              setCommandPaletteOpen(false);
              setSelectedSiteId('all');
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Reset Local Workspace
          </ActionButton>
        </div>
      </Panel>
    </div>
  );
};

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
