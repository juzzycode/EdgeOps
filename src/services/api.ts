import type { AccessPoint, Alert, AuthSession, Client, DeviceActionRecord, DeviceProfile, EventLog, FirmwareStatus, FortiGateDevice, HostScanResult, ManagedUser, PortProfile, RogueAccessPoint, Site, SiteConfigDiff, SiteConfigSnapshot, SiteHistoryPoint, SitePingSeries, SwitchDevice, SwitchVlanOption, TopologyGraph, VLANProfile } from '@/types/models';

const delay = async <T,>(data: T, timeout = 280) => new Promise<T>((resolve) => setTimeout(() => resolve(data), timeout));
const authRequiredEventName = 'edgeops:auth-required';
const resolveApiBaseUrl = () => {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
  if (!configured || typeof window === 'undefined') return configured;

  try {
    const url = new URL(configured);
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const browserHost = window.location.hostname;
    const browserIsRemote = !['localhost', '127.0.0.1'].includes(browserHost);

    if (isLocalhost && browserIsRemote) {
      url.hostname = browserHost;
      return url.toString().replace(/\/$/, '');
    }

    return configured;
  } catch {
    return configured;
  }
};

const normalizeApiPrefix = (value?: string) => {
  const trimmed = (value || '/api').trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');

  return normalized || '/api';
};

const apiBaseUrl = resolveApiBaseUrl();
const apiPrefix = normalizeApiPrefix(import.meta.env.VITE_API_PREFIX);
const withApiPrefix = (input: string) => {
  if (apiPrefix === '/api') return input;
  if (input === '/api') return apiPrefix;
  if (input.startsWith('/api/')) return `${apiPrefix}${input.slice('/api'.length)}`;

  return input;
};
const withApiBase = (input: string) => `${apiBaseUrl}${withApiPrefix(input)}`;
let sessionRequest: Promise<AuthSession | null> | null = null;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const buildThirtyMinuteBuckets = (metrics: SiteHistoryPoint[]) => {
  const buckets = new Map<string, SiteHistoryPoint[]>();
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  for (const metric of metrics) {
    const timestamp = new Date(metric.observedAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp < cutoff) continue;

    const bucketDate = new Date(timestamp);
    bucketDate.setMinutes(bucketDate.getMinutes() < 30 ? 0 : 30, 0, 0);
    const bucketKey = bucketDate.toISOString();
    const existing = buckets.get(bucketKey) ?? [];
    existing.push(metric);
    buckets.set(bucketKey, existing);
  }

  const rows = [];
  const firstBucket = new Date(cutoff);
  firstBucket.setMinutes(firstBucket.getMinutes() < 30 ? 0 : 30, 0, 0);

  for (let bucketTime = firstBucket.getTime(); bucketTime <= now; bucketTime += 30 * 60 * 1000) {
    const observedAt = new Date(bucketTime).toISOString();
    const bucketMetrics = buckets.get(observedAt) ?? [];
    const latencyValues = bucketMetrics
      .map((metric) => metric.latencyAvgMs)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const packetLossValues = bucketMetrics
      .map((metric) => metric.latencyPacketLoss)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    rows.push({
      observedAt,
      latencyAvgMs: latencyValues.length ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length : null,
      latencyPacketLoss: packetLossValues.length ? packetLossValues.reduce((sum, value) => sum + value, 0) / packetLossValues.length : null,
      isDown: bucketMetrics.some(
        (metric) => metric.wanStatus === 'offline' || !metric.apiReachable || metric.status === 'offline' || metric.latencyPacketLoss === 100,
      ),
    });
  }

  return rows;
};

const jsonRequest = async <T,>(input: string, init?: RequestInit) => {
  let response: Response;

  try {
    response = await fetch(withApiBase(input), {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    throw new Error(
      `Unable to reach the backend API at ${withApiBase(input)}. If the frontend is not sharing the same origin, set VITE_API_BASE_URL in your frontend environment.`,
    );
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new ApiError(payload?.error ?? `Request failed with status ${response.status}`, response.status);
    if (response.status === 401 && input !== '/api/auth/login' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(authRequiredEventName));
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const api = {
  authRequiredEventName,
  getDownloadUrl: (input: string) => withApiBase(input),
  login: async (payload: { username: string; password: string }) =>
    jsonRequest<{ session: AuthSession }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }).then((result) => result.session),
  getSession: async () => {
    if (!sessionRequest) {
      sessionRequest = jsonRequest<{ session: AuthSession | null }>('/api/auth/session')
        .then((result) => result.session)
        .finally(() => {
          sessionRequest = null;
        });
    }

    return sessionRequest;
  },
  logout: async () => {
    await jsonRequest<unknown>('/api/auth/logout', { method: 'POST' });
  },
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    await jsonRequest<unknown>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(payload) });
  },
  getUsers: async () => jsonRequest<{ users: ManagedUser[] }>('/api/users').then((payload) => payload.users),
  createUser: async (payload: { username: string; password: string; role: 'super_admin' | 'site_admin' | 'read_only'; siteId?: string | null }) =>
    jsonRequest<{ user: ManagedUser }>('/api/users', { method: 'POST', body: JSON.stringify(payload) }).then((result) => result.user),
  updateUser: async (
    id: string,
    payload: Partial<{ username: string; password: string; role: 'super_admin' | 'site_admin' | 'read_only'; siteId: string | null }>,
  ) => jsonRequest<{ user: ManagedUser }>(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((result) => result.user),
  deleteUser: async (id: string) => {
    await jsonRequest<unknown>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  getDashboard: async (siteId?: string | 'all') => {
    const siteQuery = siteId && siteId !== 'all' ? `?siteId=${encodeURIComponent(siteId)}` : '';
    const sites = await jsonRequest<{ sites: Site[] }>('/api/sites').then((payload) => payload.sites);
    const filteredSites = siteId && siteId !== 'all' ? sites.filter((site) => site.id === siteId) : sites;
    const [switches, liveAccessPoints, liveClients, liveAlerts, liveFirmwareStatuses, siteHistoryResults] = await Promise.all([
      jsonRequest<{ switches: SwitchDevice[] }>(`/api/switches${siteQuery}`).then((payload) => payload.switches),
      jsonRequest<{ accessPoints: AccessPoint[] }>(`/api/aps${siteQuery}`).then((payload) => payload.accessPoints),
      jsonRequest<{ clients: Client[] }>(`/api/clients${siteQuery}`).then((payload) => payload.clients),
      jsonRequest<{ alerts: Alert[] }>(`/api/alerts${siteQuery}`).then((payload) => payload.alerts),
      jsonRequest<{ firmware: FirmwareStatus[] }>(`/api/firmware${siteQuery}`).then((payload) => payload.firmware),
      Promise.all(
        filteredSites.map(async (site) => ({
          site,
          history: await jsonRequest<{ metrics: SiteHistoryPoint[]; alerts: Alert[] }>(`/api/sites/${encodeURIComponent(site.id)}/history?limit=96`).catch(() => ({
            metrics: [],
            alerts: [],
          })),
        })),
      ),
    ]);
    const sitePingSeries: SitePingSeries[] = siteHistoryResults.map(({ site, history }) => {
      const points = buildThirtyMinuteBuckets(history.metrics);
      const packetLossValues = points
        .map((point) => {
          if (typeof point.latencyPacketLoss === 'number' && Number.isFinite(point.latencyPacketLoss)) {
            return point.latencyPacketLoss;
          }

          return point.isDown ? 100 : null;
        })
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const lastReplyAt = [...points]
        .reverse()
        .find((point) => typeof point.latencyAvgMs === 'number' && !point.isDown)?.observedAt ?? null;

      return {
        siteId: site.id,
        siteName: site.name,
        status: site.status,
        wanStatus: site.wanStatus,
        lastReplyAt,
        downSampleCount: points.filter((point) => point.isDown).length,
        packetLossAverage: packetLossValues.length ? packetLossValues.reduce((sum, value) => sum + value, 0) / packetLossValues.length : null,
        points,
      };
    });
    return delay({ sites: filteredSites, switches, accessPoints: liveAccessPoints, clients: liveClients, alerts: liveAlerts, firmwareStatuses: liveFirmwareStatuses, sitePingSeries });
  },
  getSites: async () => jsonRequest<{ sites: Site[] }>('/api/sites').then((payload) => payload.sites),
  getSiteById: async (id: string) => jsonRequest<{ site: Site }>(`/api/sites/${id}`).then((payload) => payload.site),
  getSiteHistory: async (id: string, options?: { limit?: number; refresh?: boolean }) => {
    const search = new URLSearchParams();
    if (options?.limit) search.set('limit', String(options.limit));
    if (options?.refresh) search.set('refresh', 'true');
    return jsonRequest<{ metrics: SiteHistoryPoint[]; alerts: Alert[] }>(
      `/api/sites/${encodeURIComponent(id)}/history${search.toString() ? `?${search.toString()}` : ''}`,
    );
  },
  getSiteTopology: async (id: string) =>
    jsonRequest<{ topology: TopologyGraph }>(`/api/sites/${encodeURIComponent(id)}/topology`).then((payload) => payload.topology),
  getSiteConfigSnapshots: async (siteId: string) =>
    jsonRequest<{ snapshots: SiteConfigSnapshot[] }>(`/api/sites/${encodeURIComponent(siteId)}/config-snapshots`).then((payload) => payload.snapshots),
  syncSiteConfigSnapshot: async (siteId: string, force = true) =>
    jsonRequest<{ snapshot: SiteConfigSnapshot }>(`/api/sites/${encodeURIComponent(siteId)}/config-snapshots/sync`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }).then((payload) => payload.snapshot),
  getSiteConfigDiff: async (siteId: string, options?: { fromSnapshotId?: string; toSnapshotId?: string; filterRollingKeys?: boolean }) => {
    const search = new URLSearchParams();
    if (options?.fromSnapshotId) search.set('fromSnapshotId', options.fromSnapshotId);
    if (options?.toSnapshotId) search.set('toSnapshotId', options.toSnapshotId);
    if (options?.filterRollingKeys) search.set('filterRollingKeys', 'true');
    const query = search.toString();
    return jsonRequest<{ diff: SiteConfigDiff }>(`/api/sites/${encodeURIComponent(siteId)}/config-diffs${query ? `?${query}` : ''}`).then((payload) => payload.diff);
  },
  createSite: async (payload: {
    name: string;
    address: string;
    timezone: string;
    region: string;
    fortigateName: string;
    fortigateIp: string;
    fortigateApiKey: string;
    fortigateVdom?: string;
    adminUsername?: string;
    adminPassword?: string;
    configBackupsToKeep?: number | null;
  }) => jsonRequest<{ site: Site }>('/api/sites', { method: 'POST', body: JSON.stringify(payload) }).then((payload) => payload.site),
  updateSite: async (id: string, payload: Partial<{
    name: string;
    address: string;
    timezone: string;
    region: string;
    fortigateName: string;
    fortigateIp: string;
    fortigateApiKey: string;
    fortigateVdom: string;
    adminUsername: string;
    adminPassword: string;
    configBackupsToKeep: number | null;
  }>) => jsonRequest<{ site: Site }>(`/api/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((payload) => payload.site),
  deleteSite: async (id: string) => {
    await jsonRequest<unknown>(`/api/sites/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  getSwitches: async (siteId?: string | 'all') =>
    jsonRequest<{ switches: SwitchDevice[] }>(
      siteId && siteId !== 'all' ? `/api/switches?siteId=${encodeURIComponent(siteId)}` : '/api/switches',
    ).then((payload) => payload.switches),
  getSwitchById: async (id: string) => jsonRequest<{ switch: SwitchDevice }>(`/api/switches/${encodeURIComponent(id)}`).then((payload) => payload.switch),
  getSwitchVlans: async (id: string) =>
    jsonRequest<{ vlans: SwitchVlanOption[] }>(`/api/switches/${encodeURIComponent(id)}/vlans`).then((payload) => payload.vlans),
  saveSwitchPortOverride: async (
    id: string,
    portNumber: string,
    payload: { description: string; vlan: string; enabled: boolean; poeEnabled: boolean },
  ) =>
    jsonRequest<{ action: DeviceActionRecord }>(`/api/switches/${encodeURIComponent(id)}/ports/${encodeURIComponent(portNumber)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then((result) => result.action),
  resetSwitchPortOverride: async (id: string, portNumber: string) =>
    jsonRequest<{ action: DeviceActionRecord }>(`/api/switches/${encodeURIComponent(id)}/ports/${encodeURIComponent(portNumber)}`, {
      method: 'DELETE',
    }).then((result) => result.action),
  runSwitchAction: async (id: string, action: string, payload?: Record<string, string | boolean>) =>
    jsonRequest<{ action: DeviceActionRecord }>(`/api/switches/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
    }).then((result) => result.action),
  getFortiGates: async (siteId?: string | 'all') =>
    jsonRequest<{ fortiGates: FortiGateDevice[] }>(
      siteId && siteId !== 'all' ? `/api/fortigates?siteId=${encodeURIComponent(siteId)}` : '/api/fortigates',
    ).then((payload) => payload.fortiGates),
  getFortiGateById: async (id: string) =>
    jsonRequest<{ fortiGate: FortiGateDevice }>(`/api/fortigates/${encodeURIComponent(id)}`).then((payload) => payload.fortiGate),
  scanFortiGateHost: async (id: string, ip: string, options?: { deep?: boolean; mac?: string }) =>
    jsonRequest<{ scan: HostScanResult }>(`/api/fortigates/${encodeURIComponent(id)}/scan-host`, {
      method: 'POST',
      body: JSON.stringify({ ip, mac: options?.mac ?? '', deep: Boolean(options?.deep) }),
    }).then((payload) => payload.scan),
  getCachedFortiGateHostScan: async (id: string, ip: string, options?: { deep?: boolean; mac?: string }) => {
    const search = new URLSearchParams();
    if (ip) search.set('ip', ip);
    if (options?.mac) search.set('mac', options.mac);
    if (options?.deep) search.set('deep', 'true');
    return jsonRequest<{ scan: HostScanResult | null }>(`/api/fortigates/${encodeURIComponent(id)}/scan-host?${search.toString()}`).then((payload) => payload.scan);
  },
  getAps: async (siteId?: string | 'all') =>
    jsonRequest<{ accessPoints: AccessPoint[] }>(
      siteId && siteId !== 'all' ? `/api/aps?siteId=${encodeURIComponent(siteId)}` : '/api/aps',
    ).then((payload) => payload.accessPoints),
  getRogueAps: async (siteId?: string | 'all') =>
    jsonRequest<{ rogueAccessPoints: RogueAccessPoint[] }>(
      siteId && siteId !== 'all' ? `/api/aps/rogues?siteId=${encodeURIComponent(siteId)}` : '/api/aps/rogues',
    ).then((payload) => payload.rogueAccessPoints),
  getApById: async (id: string) =>
    jsonRequest<{ accessPoint: AccessPoint }>(`/api/aps/${encodeURIComponent(id)}`).then((payload) => payload.accessPoint),
  runApAction: async (id: string, action: string, payload?: Record<string, string | boolean>) =>
    jsonRequest<{ action: DeviceActionRecord }>(`/api/aps/${encodeURIComponent(id)}/actions`, {
      method: 'POST',
      body: JSON.stringify({ action, payload }),
    }).then((result) => result.action),
  getClients: async (siteId?: string | 'all') =>
    jsonRequest<{ clients: Client[] }>(
      siteId && siteId !== 'all' ? `/api/clients?siteId=${encodeURIComponent(siteId)}` : '/api/clients',
    ).then((payload) => payload.clients),
  getAlerts: async (options?: {
    siteId?: string | 'all';
    severity?: 'all' | 'critical' | 'warning' | 'info';
    hours?: number;
  }) => {
    const search = new URLSearchParams();
    if (options?.siteId && options.siteId !== 'all') search.set('siteId', options.siteId);
    if (options?.severity && options.severity !== 'all') search.set('severity', options.severity);
    if (options?.hours) search.set('hours', String(options.hours));

    const query = search.toString();
    return jsonRequest<{ alerts: Alert[] }>(`/api/alerts${query ? `?${query}` : ''}`)
      .then((payload) => payload.alerts);
  },
  getFirmwareStatuses: async (siteId?: string | 'all') =>
    jsonRequest<{ firmware: FirmwareStatus[] }>(
      siteId && siteId !== 'all' ? `/api/firmware?siteId=${encodeURIComponent(siteId)}` : '/api/firmware',
    )
      .then((payload) => payload.firmware),
  getProfiles: async (siteId?: string | 'all') =>
    jsonRequest<{ deviceProfiles: DeviceProfile[]; vlanProfiles: VLANProfile[]; portProfiles: PortProfile[] }>(
      siteId && siteId !== 'all' ? `/api/profiles?siteId=${encodeURIComponent(siteId)}` : '/api/profiles',
    ),
  getTopology: async (siteId?: string | 'all') =>
    jsonRequest<{ topology: TopologyGraph }>(
      siteId && siteId !== 'all' ? `/api/topology?siteId=${encodeURIComponent(siteId)}` : '/api/topology',
    ).then((payload) => payload.topology),
  getEventLogsByTarget: async (targetId: string) =>
    jsonRequest<{ events: EventLog[] }>(`/api/events?targetId=${encodeURIComponent(targetId)}`).then((payload) => payload.events),
};

export { ApiError };
