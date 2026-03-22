import { accessPoints, alerts, bandwidthUsage, clients, deviceProfiles, eventLogs, firmwareStatuses, portProfiles, switches as demoSwitches, vlanProfiles } from '@/mocks/data';
import type { AccessPoint, Alert, Client, Site, SwitchDevice } from '@/types/models';

const delay = async <T,>(data: T, timeout = 280) => new Promise<T>((resolve) => setTimeout(() => resolve(data), timeout));
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

const apiBaseUrl = resolveApiBaseUrl();
const withApiBase = (input: string) => `${apiBaseUrl}${input}`;

const jsonRequest = async <T,>(input: string, init?: RequestInit) => {
  let response: Response;

  try {
    response = await fetch(withApiBase(input), {
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
    throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const api = {
  getDashboard: async (siteId?: string | 'all') => {
    const siteQuery = siteId && siteId !== 'all' ? `?siteId=${encodeURIComponent(siteId)}` : '';
    const sites = await jsonRequest<{ sites: Site[] }>('/api/sites').then((payload) => payload.sites).catch(() => []);
    const filteredSites = siteId && siteId !== 'all' ? sites.filter((site) => site.id === siteId) : sites;
    const switches = await jsonRequest<{ switches: SwitchDevice[] }>(`/api/switches${siteQuery}`).then((payload) => payload.switches).catch(() => demoSwitches);
    const liveAccessPoints = await jsonRequest<{ accessPoints: AccessPoint[] }>(`/api/aps${siteQuery}`).then((payload) => payload.accessPoints).catch(() => accessPoints);
    const liveClients = await jsonRequest<{ clients: Client[] }>(`/api/clients${siteQuery}`).then((payload) => payload.clients).catch(() => clients);
    const liveAlerts = await jsonRequest<{ alerts: Alert[] }>(`/api/alerts${siteQuery}`).then((payload) => payload.alerts).catch(() => alerts);
    return delay({ sites: filteredSites, switches, accessPoints: liveAccessPoints, clients: liveClients, alerts: liveAlerts, firmwareStatuses, bandwidthUsage });
  },
  getSites: async () => jsonRequest<{ sites: Site[] }>('/api/sites').then((payload) => payload.sites),
  getSiteById: async (id: string) => jsonRequest<{ site: Site }>(`/api/sites/${id}`).then((payload) => payload.site),
  createSite: async (payload: {
    name: string;
    address: string;
    timezone: string;
    region: string;
    fortigateName: string;
    fortigateIp: string;
    fortigateApiKey: string;
    adminUsername?: string;
    adminPassword?: string;
  }) => jsonRequest<{ site: Site }>('/api/sites', { method: 'POST', body: JSON.stringify(payload) }).then((payload) => payload.site),
  updateSite: async (id: string, payload: Partial<{
    name: string;
    address: string;
    timezone: string;
    region: string;
    fortigateName: string;
    fortigateIp: string;
    fortigateApiKey: string;
    adminUsername: string;
    adminPassword: string;
  }>) => jsonRequest<{ site: Site }>(`/api/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((payload) => payload.site),
  deleteSite: async (id: string) => {
    await jsonRequest<unknown>(`/api/sites/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  loadDemoSites: async () => jsonRequest<{ sites: Site[] }>('/api/sites/load-demo', { method: 'POST' }).then((payload) => payload.sites),
  getSwitches: async (siteId?: string | 'all') =>
    jsonRequest<{ switches: SwitchDevice[] }>(
      siteId && siteId !== 'all' ? `/api/switches?siteId=${encodeURIComponent(siteId)}` : '/api/switches',
    ).then((payload) => payload.switches),
  getSwitchById: async (id: string) => jsonRequest<{ switch: SwitchDevice }>(`/api/switches/${encodeURIComponent(id)}`).then((payload) => payload.switch),
  getAps: async (siteId?: string | 'all') =>
    jsonRequest<{ accessPoints: AccessPoint[] }>(
      siteId && siteId !== 'all' ? `/api/aps?siteId=${encodeURIComponent(siteId)}` : '/api/aps',
    ).then((payload) => payload.accessPoints),
  getApById: async (id: string) =>
    jsonRequest<{ accessPoint: AccessPoint }>(`/api/aps/${encodeURIComponent(id)}`).then((payload) => payload.accessPoint),
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
      .then((payload) => payload.alerts)
      .catch(() => delay(alerts));
  },
  getFirmwareStatuses: async () => delay(firmwareStatuses),
  getProfiles: async () => delay({ deviceProfiles, vlanProfiles, portProfiles }),
  getEventLogsByTarget: async (targetId: string) => delay(eventLogs.filter((entry) => entry.targetId === targetId)),
  simulateDeviceAction: async (action: string, targetId: string, payload?: Record<string, string | boolean>) =>
    delay({ success: true, action, targetId, payload, message: `${action} queued for ${targetId}` }, 450),
};
