import type { ReactNode } from 'react';
import { Cable, Globe2, ShieldCheck, ShieldEllipsis, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import type { FortiGateDevice } from '@/types/models';

export const FortiGateDetailPage = () => {
  const { id = '' } = useParams();
  const [device, setDevice] = useState<FortiGateDevice | null>();

  useEffect(() => {
    api.getFortiGateById(id).then(setDevice).catch(() => setDevice(null));
  }, [id]);

  const interfaceSummary = useMemo(() => {
    const interfaces = device?.interfaces ?? [];
    return {
      up: interfaces.filter((item) => item.status === 'up').length,
      down: interfaces.filter((item) => item.status === 'down').length,
      allowAccess: Array.from(new Set(interfaces.flatMap((item) => item.allowAccess))).sort(),
    };
  }, [device]);

  if (device === undefined) return <LoadingState label="Loading FortiGate detail..." />;
  if (device === null) {
    return <ErrorState title="FortiGate not found" description="The requested FortiGate could not be found for any configured site." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FortiGate Detail"
        title={device.name}
        description={`${device.managementIp} at ${device.siteName}. This page consolidates live FortiGate identity, interface inventory, and site-wide managed inventory counts.`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Summary">
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryItem label="Status" value={<StatusBadge value={device.status} />} />
            <SummaryItem label="Site" value={<Link className="text-accent hover:underline" to={`/sites/${device.siteId}`}>{device.siteName}</Link>} />
            <SummaryItem label="Firmware" value={device.firmware || 'Unavailable'} />
            <SummaryItem label="Serial" value={device.serial || 'Unavailable'} />
            <SummaryItem label="Management IP" value={device.managementIp || 'Unavailable'} />
            <SummaryItem label="WAN IP" value={device.wanIp || 'Unavailable'} />
            <SummaryItem label="API Reachable" value={device.apiReachable ? 'Yes' : 'No'} />
            <SummaryItem label="Last Seen" value={formatRelativeTime(device.lastSeen)} />
          </div>
        </Panel>

        <Panel title="Config Summary">
          <div className="space-y-3">
            {device.configSummary.map((item) => (
              <div key={item} className="rounded-2xl bg-soft px-4 py-3 text-sm text-text">{item}</div>
            ))}
            {device.lastSyncError ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {device.lastSyncError}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-4">
        <MetricTile icon={Globe2} label="Clients" value={String(device.clientCount)} />
        <MetricTile icon={Cable} label="Switches" value={String(device.switchCount)} />
        <MetricTile icon={Waypoints} label="Access Points" value={String(device.apCount)} />
        <MetricTile icon={ShieldCheck} label="Address Objects" value={String(device.addressObjectCount)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Interfaces" subtitle="Live FortiGate interface inventory from system/interface.">
          <div className="space-y-3">
            {device.interfaces.length ? (
              device.interfaces.map((item) => (
                <div key={item.id} className="rounded-2xl border border-border bg-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{item.name}</p>
                      <p className="mt-1 text-xs text-muted">{item.alias || item.type || 'Interface'}</p>
                    </div>
                    <StatusBadge value={item.status === 'up' ? 'healthy' : item.status === 'down' ? 'offline' : 'warning'} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <DetailRow label="Role" value={item.role || 'None'} />
                    <DetailRow label="Type" value={item.type || 'Unknown'} />
                    <DetailRow label="IP" value={item.ip || 'Unassigned'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.allowAccess.length ? (
                      item.allowAccess.map((access) => (
                        <span key={access} className="rounded-full bg-canvas px-2 py-1 text-xs text-muted">
                          {access}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted">No explicit management access exposed</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No interface inventory was returned by the FortiGate API for this site.</div>
            )}
          </div>
        </Panel>

        <Panel title="Interface Signals" subtitle="A quick rollup of interface state and management access.">
          <div className="space-y-3">
            <SignalRow label="Interfaces Up" value={String(interfaceSummary.up)} />
            <SignalRow label="Interfaces Down" value={String(interfaceSummary.down)} />
            <SignalRow label="Average Latency" value={device.latencyAvgMs !== null ? `${device.latencyAvgMs.toFixed(1)} ms` : 'Unavailable'} />
            <SignalRow label="Config Archive" value={device.configArchiveEnabled ? 'Enabled' : 'Disabled'} />
            <SignalRow label="Mgmt Access" value={interfaceSummary.allowAccess.join(', ') || 'Unavailable'} />
          </div>
          <div className="mt-4 rounded-3xl bg-soft p-4 text-sm text-muted">
            This section is ready to expand with FortiGate-only signals like HA posture, VPN inventory, policy counts, and interface error telemetry.
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="HA Status" subtitle="Live HA posture when FortiGate exposes HA config and monitor data.">
          <div className="space-y-3">
            <SignalRow label="Mode" value={device.haStatus.mode || 'Unavailable'} />
            <SignalRow label="Role" value={device.haStatus.role || 'Unavailable'} />
            <SignalRow label="State" value={device.haStatus.state || 'Unavailable'} />
            <SignalRow label="Cluster" value={device.haStatus.clusterName || 'Standalone'} />
            <SignalRow label="Peers" value={String(device.haStatus.peerCount)} />
            <SignalRow label="Sync" value={device.haStatus.syncStatus || 'Unavailable'} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {device.haStatus.peers.length ? (
              device.haStatus.peers.map((peer) => (
                <span key={peer} className="rounded-full bg-soft px-3 py-1 text-xs text-muted">
                  {peer}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted">No HA peers reported</span>
            )}
          </div>
        </Panel>

        <Panel title="VPNs" subtitle="IPsec Phase 1 tunnels with live status when the monitor endpoint is available.">
          <div className="space-y-3">
            {device.vpns.length ? (
              device.vpns.map((vpn) => (
                <div key={vpn.id} className="rounded-2xl border border-border bg-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{vpn.name}</p>
                      <p className="mt-1 text-xs text-muted">{vpn.interface} {'->'} {vpn.remoteGateway}</p>
                    </div>
                    <StatusBadge value={vpn.status === 'up' ? 'healthy' : vpn.status === 'warning' ? 'warning' : 'offline'} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <DetailRow label="Type" value={vpn.type} />
                    <DetailRow label="Phase 2 Selectors" value={String(vpn.phase2Count)} />
                    <DetailRow label="Remote" value={vpn.remoteGateway} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No VPN tunnels were returned by the FortiGate API for this site.</div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Firewall Policies" subtitle="Top policies from the FortiGate policy table, trimmed for quick review.">
          <div className="space-y-3">
            {device.policies.length ? (
              device.policies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-border bg-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{policy.name}</p>
                      <p className="mt-1 text-xs text-muted">Policy {policy.sequence} | {policy.srcInterface} {'->'} {policy.dstInterface}</p>
                    </div>
                    <StatusBadge value={policy.status === 'enabled' ? 'healthy' : 'offline'} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <DetailRow label="Action" value={policy.action} />
                    <DetailRow label="Schedule" value={policy.schedule} />
                    <DetailRow label="NAT" value={policy.nat ? 'Enabled' : 'Disabled'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {policy.services.slice(0, 6).map((service) => (
                      <span key={service} className="rounded-full bg-canvas px-2 py-1 text-xs text-muted">
                        {service}
                      </span>
                    ))}
                    {policy.services.length > 6 ? <span className="text-xs text-muted">+{policy.services.length - 6} more</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No firewall policies were returned by the FortiGate API for this site.</div>
            )}
          </div>
        </Panel>

        <Panel title="DHCP Leases" subtitle="Current leases from the FortiGate DHCP monitor endpoint when available.">
          <div className="space-y-3">
            {device.dhcpLeases.length ? (
              device.dhcpLeases.map((lease) => (
                <div key={lease.id} className="rounded-2xl border border-border bg-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{lease.hostname}</p>
                      <p className="mt-1 text-xs text-muted">{lease.ip} | {lease.mac}</p>
                    </div>
                    <StatusBadge value={lease.status === 'leased' || lease.status === 'active' ? 'healthy' : 'warning'} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <DetailRow label="Interface" value={lease.interface} />
                    <DetailRow label="Expires" value={lease.expiresAt ? formatRelativeTime(lease.expiresAt) : 'Unknown'} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No DHCP lease data was returned by the FortiGate API for this site.</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
};

const SummaryItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-2xl bg-soft px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <div className="mt-2 text-sm font-medium text-text">{value}</div>
  </div>
);

const MetricTile = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
}) => (
  <div className="rounded-3xl border border-border bg-soft p-4">
    <div className="flex items-center gap-2 text-muted">
      <Icon className="h-4 w-4" />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-3 text-2xl font-semibold text-text">{value}</p>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-canvas px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
    <p className="mt-1 text-sm font-medium text-text">{value}</p>
  </div>
);

const SignalRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-soft px-4 py-3">
    <div className="flex items-center gap-3">
      <ShieldEllipsis className="h-4 w-4 text-accent" />
      <span className="text-sm text-muted">{label}</span>
    </div>
    <span className="text-right text-sm font-medium text-text">{value}</span>
  </div>
);
