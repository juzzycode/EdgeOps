import { accessPoints, alerts, bandwidthUsage, clients, deviceProfiles, eventLogs, firmwareStatuses, portProfiles, sites, switches, vlanProfiles } from '@/mocks/data';
import type { SetupStatus } from '@/types/models';

const delay = async <T,>(data: T, timeout = 280) => new Promise<T>((resolve) => setTimeout(() => resolve(data), timeout));
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
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

  return (await response.json()) as T;
};

export const api = {
  getDashboard: async () => delay({ sites, switches, accessPoints, clients, alerts, firmwareStatuses, bandwidthUsage }),
  getSites: async () => delay(sites),
  getSiteById: async (id: string) => delay(sites.find((site) => site.id === id) ?? null),
  getSwitches: async () => delay(switches),
  getSwitchById: async (id: string) => delay(switches.find((device) => device.id === id) ?? null),
  getAps: async () => delay(accessPoints),
  getApById: async (id: string) => delay(accessPoints.find((device) => device.id === id) ?? null),
  getClients: async () => delay(clients),
  getAlerts: async () => delay(alerts),
  getFirmwareStatuses: async () => delay(firmwareStatuses),
  getProfiles: async () => delay({ deviceProfiles, vlanProfiles, portProfiles }),
  getEventLogsByTarget: async (targetId: string) => delay(eventLogs.filter((entry) => entry.targetId === targetId)),
  getSetupStatus: async () => jsonRequest<SetupStatus>('/api/setup/status'),
  saveSetupWizard: async (payload: {
    username: string;
    password: string;
    fortigateIp: string;
    fortigateApiKey: string;
  }) => jsonRequest<SetupStatus>('/api/setup/wizard', { method: 'POST', body: JSON.stringify(payload) }),
  simulateDeviceAction: async (action: string, targetId: string, payload?: Record<string, string | boolean>) =>
    delay({ success: true, action, targetId, payload, message: `${action} queued for ${targetId}` }, 450),
};
