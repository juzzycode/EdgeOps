import { clsx } from 'clsx';
import type { DeviceStatus, Severity } from '@/types/models';

export const cn = (...values: Array<string | false | null | undefined>) => clsx(values);

export const statusTone: Record<DeviceStatus, string> = {
  healthy: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  critical: 'bg-danger/15 text-danger',
  offline: 'bg-slate-500/15 text-offline',
};

export const extendedStatusTone: Record<string, string> = {
  ...statusTone,
  inactive: 'bg-slate-500/15 text-slate-400',
  compliant: 'bg-success/15 text-success',
  pending: 'bg-warning/15 text-warning',
  blocked: 'bg-danger/15 text-danger',
};

export const severityTone: Record<Severity, string> = {
  critical: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-sky-500/15 text-sky-500',
};

export const formatRelativeTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

export const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
export const formatPercent = (value: number) => `${Math.round(value)}%`;
export const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${Math.round(value)} B`;

  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let size = value;
  let unitIndex = -1;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};
export const formatWatts = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0.0W';
  return `${value.toFixed(1)}W`;
};
export const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
};
