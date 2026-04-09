import { Activity, AlertTriangle, Building2, Network, RadioTower, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '@/components/common/Panel';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LoadingState } from '@/components/common/States';
import { HealthDonut } from '@/components/charts/HealthDonut';
import { SitePingHistoryChart } from '@/components/charts/SitePingHistoryChart';
import { TopologyCanvas } from '@/components/data-display/TopologyCanvas';
import { StatusBadge } from '@/components/common/StatusBadge';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { formatNumber, formatPercent, formatRelativeTime, formatWatts } from '@/lib/utils';
import type { DeviceStatus, SitePingSeries, TopologyGraph } from '@/types/models';

const siteReachabilityStatus = (site: SitePingSeries): DeviceStatus =>
  site.wanStatus === 'offline' ? 'offline' : site.wanStatus === 'degraded' || site.downSampleCount > 0 ? 'warning' : 'healthy';

export const DashboardPage = () => {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getDashboard>> | null>(null);
  const [topology, setTopology] = useState<TopologyGraph | null>(null);
  const [selectedHealth, setSelectedHealth] = useState<DeviceStatus | null>(null);
  const { selectedSiteId } = useAppStore();

  useEffect(() => {
    Promise.all([api.getDashboard(selectedSiteId), api.getTopology(selectedSiteId)])
      .then(([dashboard, topologyGraph]) => {
        setData(dashboard);
        setTopology(topologyGraph);
      });
  }, [selectedSiteId]);

  const healthBreakdown = useMemo(() => {
    if (!data) return [];
    const pool = [...data.switches, ...data.accessPoints];
    return ['healthy', 'warning', 'critical', 'offline'].map((status) => ({
      name: status,
      value: pool.filter((device) => device.status === status).length,
    }));
  }, [data]);

  const siteNameById = useMemo(() => Object.fromEntries((data?.sites ?? []).map((site) => [site.id, site.name])), [data]);

  const filteredHealthDevices = useMemo(() => {
    if (!data || !selectedHealth) return [];

    return [
      ...data.switches.map((device) => ({
        id: device.id,
        name: device.hostname,
        status: device.status,
        type: 'switch' as const,
        subtitle: `${device.model} - ${siteNameById[device.siteId] ?? device.siteId}`,
        href: `/switches/${device.id}`,
      })),
      ...data.accessPoints.map((device) => ({
        id: device.id,
        name: device.name,
        status: device.status,
        type: 'ap' as const,
        subtitle: `${device.model} - ${siteNameById[device.siteId] ?? device.siteId}`,
        href: `/aps/${device.id}`,
      })),
    ]
      .filter((device) => device.status === selectedHealth)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [data, selectedHealth, siteNameById]);

  if (!data || !topology) return <LoadingState label="Loading dashboard telemetry..." />;

  const offlineCount = [...data.switches, ...data.accessPoints].filter((device) => device.status === 'offline').length;
  const compliant = data.firmwareStatuses.filter((row) => row.compliance === 'compliant').length;
  const totalPoeBudget = data.switches.reduce((sum, device) => sum + device.poeBudgetWatts, 0);
  const totalPoeDraw = data.switches.reduce((sum, device) => sum + device.poeUsageWatts, 0);
  const averageLatency =
    data.sites.filter((site) => typeof site.latencyAvgMs === 'number').reduce((sum, site) => sum + (site.latencyAvgMs ?? 0), 0) /
    Math.max(1, data.sites.filter((site) => typeof site.latencyAvgMs === 'number').length);
  const reachableSites = data.sites.filter((site) => site.apiReachable).length;
  const ssidDistribution = [...data.accessPoints.flatMap((accessPoint) => accessPoint.clientDevices ?? [])]
    .reduce<Record<string, number>>((accumulator, client) => {
      accumulator[client.ssid] = (accumulator[client.ssid] ?? 0) + 1;
      return accumulator;
    }, {});
  const topSsids = Object.entries(ssidDistribution)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} ${count}`);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overview" title="Operations Dashboard" description="Fast visibility into device health, client load, firmware readiness, and site activity across your distributed edge." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Sites" value={String(data.sites.length)} delta="+1 this quarter" icon={Building2} />
        <StatCard title="Total Switches" value={String(data.switches.length)} delta="92% healthy" icon={Network} />
        <StatCard title="Wireless APs" value={String(data.accessPoints.length)} delta="3 with elevated RF" icon={RadioTower} />
        <StatCard title="Connected Clients" value={formatNumber(data.clients.length)} delta="Steady today" icon={Users} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title="Site Ping Responses" subtitle="Last 24 hours of site latency, rolled up into 30-minute averages. Down samples show as gaps, with reachability summarized below.">
          <SitePingHistoryChart series={data.sitePingSeries} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {data.sitePingSeries.map((site) => {
              const reachabilityStatus = siteReachabilityStatus(site);
              return (
                <div key={site.siteId} className="rounded-2xl border border-border bg-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text">{site.siteName}</p>
                      <p className="text-xs text-muted">
                        {site.downSampleCount
                          ? `${site.downSampleCount} down samples in the last 24 hours`
                          : 'No down samples in the last 24 hours'}
                      </p>
                    </div>
                    <StatusBadge
                      value={reachabilityStatus}
                      title={
                        reachabilityStatus === 'offline'
                          ? 'Site is currently down or not replying to ping/API checks.'
                          : reachabilityStatus === 'warning'
                            ? 'Site had degraded latency, packet loss, or down samples in the last 24 hours.'
                            : undefined
                      }
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Current</p>
                      <p className="mt-1 font-medium text-text capitalize">{site.wanStatus}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Last Reply</p>
                      <p className="mt-1 font-medium text-text">{site.lastReplyAt ? formatRelativeTime(site.lastReplyAt) : 'No reply'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Avg Loss</p>
                      <p className="mt-1 font-medium text-text">{site.packetLossAverage === null ? 'N/A' : formatPercent(site.packetLossAverage)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Device Health Summary" subtitle="Combined switch and AP health status.">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="grid gap-3">
              {healthBreakdown.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedHealth((current) => (current === item.name ? null : (item.name as DeviceStatus)))}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
                    selectedHealth === item.name
                      ? 'border-accent bg-accent/10'
                      : 'border-transparent bg-soft hover:border-border',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge value={item.name} />
                    <span className="text-sm font-medium capitalize text-text">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-text">{item.value}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted">
                      {selectedHealth === item.name ? 'Clear filter' : 'View devices'}
                    </p>
                  </div>
                </button>
              ))}

              <div className="rounded-2xl border border-border bg-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text capitalize">{selectedHealth ? `${selectedHealth} devices` : 'Devices in focus'}</p>
                    <p className="text-xs text-muted">
                      {selectedHealth
                        ? 'Linked switch and AP results for the selected health state.'
                        : 'Choose a health state above to filter devices and jump directly into remediation.'}
                    </p>
                  </div>
                  {selectedHealth ? (
                    <button className="text-xs font-semibold text-accent hover:underline" onClick={() => setSelectedHealth(null)} type="button">
                      Clear
                    </button>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {selectedHealth ? (
                    filteredHealthDevices.length ? (
                      filteredHealthDevices.slice(0, 8).map((device) => (
                        <Link
                          key={device.id}
                          className="flex items-center justify-between rounded-2xl border border-transparent bg-canvas px-3 py-3 transition hover:border-border hover:bg-surface"
                          to={device.href}
                        >
                          <div>
                            <p className="text-sm font-medium text-text">{device.name}</p>
                            <p className="text-xs text-muted">{device.subtitle}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-muted">{device.type}</p>
                            <StatusBadge value={device.status} />
                          </div>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-muted">No devices match this health state in the current scope.</p>
                    )
                  ) : (
                    <p className="text-sm text-muted">Healthy is useful for audits, while warning, critical, and offline help you triage issues fast.</p>
                  )}
                  {selectedHealth && filteredHealthDevices.length > 8 ? (
                    <p className="pt-1 text-xs text-muted">{filteredHealthDevices.length - 8} more devices match this filter in the current scope.</p>
                  ) : null}
                </div>
              </div>
            </div>
            <HealthDonut data={healthBreakdown} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Top Sites by Clients" subtitle="Sorted by active endpoint count.">
          <div className="space-y-3">
            {[...data.sites].sort((a, b) => b.clientCount - a.clientCount).map((site) => (
              <div key={site.id} className="rounded-2xl bg-soft px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-text">{site.name}</p>
                    <p className="text-xs text-muted">{site.region} region</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text">{site.clientCount}</p>
                    <p className="text-xs text-muted">clients</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Alerts" subtitle="Latest unresolved events across the estate.">
          <div className="space-y-3">
            {data.alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-border bg-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge value={alert.severity} type="severity" />
                  <span className="text-xs text-muted">{formatRelativeTime(alert.timestamp)}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-text">{alert.title}</p>
                <p className="mt-2 text-sm text-muted">{alert.description}</p>
                <p className="mt-2 text-xs text-muted">{alert.siteName ?? alert.siteId}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Fleet Signals" subtitle="Rollup metrics that operations teams watch most often.">
          <div className="space-y-3">
            <SignalRow label="Offline devices" value={String(offlineCount)} icon={AlertTriangle} />
            <SignalRow label="Firmware compliant" value={`${compliant}/${data.firmwareStatuses.length}`} icon={Activity} />
            <SignalRow label="Reachable sites" value={`${reachableSites}/${data.sites.length}`} icon={Building2} />
            <SignalRow label="Average WAN latency" value={Number.isFinite(averageLatency) ? `${averageLatency.toFixed(1)} ms` : 'Unavailable'} icon={Network} />
            <SignalRow label="PoE budget" value={`${formatWatts(totalPoeDraw)} / ${formatWatts(totalPoeBudget)}`} icon={Network} />
            <SignalRow label="Top SSIDs" value={topSsids.join(', ') || 'No active SSIDs'} icon={RadioTower} />
          </div>
        </Panel>
      </div>

      <TopologyCanvas
        topology={topology}
        title={selectedSiteId && selectedSiteId !== 'all' ? 'Site Network Map' : 'Network Web'}
        subtitle={
          selectedSiteId && selectedSiteId !== 'all'
            ? 'Live map for the selected site, including WAN latency, managed switches, APs, and client aggregates.'
            : 'Live multi-site web graph across the selected estate scope, with WAN latency shown on the graph.'
        }
      />
    </div>
  );
};

const SignalRow = ({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Activity }) => (
  <div className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3">
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-accent-muted p-2 text-accent">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-text">{label}</span>
    </div>
    <span className="text-sm font-semibold text-text">{value}</span>
  </div>
);
