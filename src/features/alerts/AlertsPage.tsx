import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SideDrawer } from '@/components/drawers/SideDrawer';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Alert } from '@/types/models';
import { formatRelativeTime } from '@/lib/utils';

const hoursByRange = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
} as const;

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [timeRange, setTimeRange] = useState<keyof typeof hoursByRange>('24h');
  const [deviceType, setDeviceType] = useState<'all' | 'site' | 'switch' | 'ap'>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const { selectedSiteId } = useAppStore();

  useEffect(() => {
    setError(null);
    api
      .getAlerts({
        siteId: selectedSiteId,
        severity,
        hours: hoursByRange[timeRange],
      })
      .then(setAlerts)
      .catch((requestError) => {
        setAlerts([]);
        setError(requestError instanceof Error ? requestError.message : 'Unable to load alerts');
      });
  }, [selectedSiteId, severity, timeRange]);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((alert) => (deviceType === 'all' ? true : alert.deviceType === deviceType));
  }, [alerts, deviceType]);

  if (!alerts) return <LoadingState label="Loading alerts..." />;

  return (
    <>
      <div className="space-y-6">
        <PageHeader eyebrow="Health" title="Alert Center" description="Live alerts synthesized from site reachability, managed switch state, and wireless health signals reported through the FortiGate." />
        {error ? <ErrorState title="Alert API unavailable" description={error} /> : null}
        <Panel
          title="Alerts"
          subtitle={`${filtered.length} alerts shown${selectedSiteId !== 'all' ? ' for the selected site' : ''}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-2 text-sm text-text">
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <select value={deviceType} onChange={(event) => setDeviceType(event.target.value as typeof deviceType)} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-2 text-sm text-text">
                <option value="all">All device types</option>
                <option value="site">Sites</option>
                <option value="switch">Switches</option>
                <option value="ap">Access points</option>
              </select>
              <select value={timeRange} onChange={(event) => setTimeRange(event.target.value as keyof typeof hoursByRange)} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-2 text-sm text-text">
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
          }
        >
          {filtered.length ? (
            <div className="space-y-3">
              {filtered.map((alert) => (
                <button key={alert.id} onClick={() => setSelectedAlert(alert)} className="w-full rounded-3xl border border-border bg-soft p-4 text-left transition hover:border-accent/30">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge value={alert.severity} type="severity" />
                    <span className="text-xs text-muted">{formatRelativeTime(alert.timestamp)}</span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-text">{alert.title}</p>
                  <p className="mt-2 text-sm text-muted">{alert.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>{alert.type}</span>
                    <span>{alert.siteName ?? alert.siteId}</span>
                    <span>{alert.deviceName ?? alert.deviceId ?? 'No specific device'}</span>
                    <span>{alert.source === 'demo' ? 'Demo' : 'Live'}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No alerts in this scope" description="Try widening the time window or switching to all device types." />
          )}
        </Panel>
      </div>
      <SideDrawer open={Boolean(selectedAlert)} title={selectedAlert?.title ?? ''} subtitle={selectedAlert?.type} onClose={() => setSelectedAlert(null)}>
        {selectedAlert ? (
          <div className="space-y-3">
            <DrawerItem label="Severity" value={selectedAlert.severity} />
            <DrawerItem label="Site" value={selectedAlert.siteName ?? selectedAlert.siteId} />
            <DrawerItem label="Device" value={selectedAlert.deviceName ?? selectedAlert.deviceId ?? 'N/A'} />
            <DrawerItem label="Source" value={selectedAlert.source ?? 'live'} />
            <DrawerItem label="Timestamp" value={formatRelativeTime(selectedAlert.timestamp)} />
            <DrawerItem label="Description" value={selectedAlert.description} />
            {selectedAlert.context?.map((entry) => (
              <DrawerItem key={`${entry.label}-${entry.value}`} label={entry.label} value={entry.value} />
            ))}
          </div>
        ) : null}
      </SideDrawer>
    </>
  );
};

const DrawerItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-soft px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <p className="mt-2 text-sm font-medium capitalize text-text">{value}</p>
  </div>
);
