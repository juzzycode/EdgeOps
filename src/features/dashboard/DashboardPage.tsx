import { Activity, AlertTriangle, Building2, Network, RadioTower, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { LoadingState } from '@/components/common/States';
import { UsageAreaChart } from '@/components/charts/UsageAreaChart';
import { HealthDonut } from '@/components/charts/HealthDonut';
import { TopologyCanvas } from '@/components/data-display/TopologyCanvas';
import { StatusBadge } from '@/components/common/StatusBadge';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { formatNumber, formatRelativeTime, formatWatts } from '@/lib/utils';
import type { TopologyGraph } from '@/types/models';

export const DashboardPage = () => {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getDashboard>> | null>(null);
  const [topology, setTopology] = useState<TopologyGraph | null>(null);
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
        <Panel title="Observed Throughput" subtitle="Current inbound and outbound Mbps derived from live AP client telemetry in the selected site scope.">
          <UsageAreaChart data={data.bandwidthUsage} />
        </Panel>

        <Panel title="Device Health Summary" subtitle="Combined switch and AP health status.">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-3">
              {healthBreakdown.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl bg-soft px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge value={item.name} />
                    <span className="text-sm font-medium capitalize text-text">{item.name}</span>
                  </div>
                  <span className="text-lg font-semibold text-text">{item.value}</span>
                </div>
              ))}
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
        subtitle="Live path map for the currently selected scope, including site edge, managed switches, APs, and client aggregates."
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
