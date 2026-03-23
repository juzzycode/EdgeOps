import type { ReactNode } from 'react';
import { Cable, Globe2, ScanSearch, ShieldCheck, ShieldEllipsis, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SideDrawer } from '@/components/drawers/SideDrawer';
import { formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import type { FortiGateDevice, FortiGateDhcpLease, FortiGatePolicy, HostScanResult } from '@/types/models';

export const FortiGateDetailPage = () => {
  const { id = '' } = useParams();
  const [device, setDevice] = useState<FortiGateDevice | null>();
  const [interfacePage, setInterfacePage] = useState(1);
  const [vpnPage, setVpnPage] = useState(1);
  const [policyPage, setPolicyPage] = useState(1);
  const [leasePage, setLeasePage] = useState(1);
  const [interfaceQuery, setInterfaceQuery] = useState('');
  const [vpnQuery, setVpnQuery] = useState('');
  const [policyQuery, setPolicyQuery] = useState('');
  const [leaseQuery, setLeaseQuery] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<FortiGatePolicy | null>(null);
  const [selectedLease, setSelectedLease] = useState<FortiGateDhcpLease | null>(null);
  const [scanResult, setScanResult] = useState<HostScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [deepScanEnabled, setDeepScanEnabled] = useState(false);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [scanElapsedMs, setScanElapsedMs] = useState(0);

  useEffect(() => {
    api.getFortiGateById(id).then(setDevice).catch(() => setDevice(null));
  }, [id]);

  useEffect(() => {
    setInterfacePage(1);
    setVpnPage(1);
    setPolicyPage(1);
    setLeasePage(1);
    setInterfaceQuery('');
    setVpnQuery('');
    setPolicyQuery('');
    setLeaseQuery('');
    setSelectedPolicy(null);
    setSelectedLease(null);
    setScanResult(null);
    setScanError('');
    setDeepScanEnabled(false);
    setScanStartedAt(null);
    setScanElapsedMs(0);
  }, [id]);

  const interfaceSummary = useMemo(() => {
    const interfaces = device?.interfaces ?? [];
    return {
      up: interfaces.filter((item) => item.status === 'up').length,
      down: interfaces.filter((item) => item.status === 'down').length,
      allowAccess: Array.from(new Set(interfaces.flatMap((item) => item.allowAccess))).sort(),
    };
  }, [device]);

  const filteredInterfaces = useMemo(
    () =>
      (device?.interfaces ?? []).filter((item) =>
        matchesQuery(interfaceQuery, [item.name, item.alias, item.role, item.type, item.ip, item.allowAccess.join(' ')]),
      ),
    [device?.interfaces, interfaceQuery],
  );
  const filteredVpns = useMemo(
    () =>
      (device?.vpns ?? []).filter((item) =>
        matchesQuery(vpnQuery, [item.name, item.type, item.interface, item.remoteGateway, item.status]),
      ),
    [device?.vpns, vpnQuery],
  );
  const filteredPolicies = useMemo(
    () =>
      (device?.policies ?? []).filter((item) =>
        matchesQuery(policyQuery, [
          item.name,
          item.action,
          item.srcInterface,
          item.dstInterface,
          item.schedule,
          item.status,
          item.services.join(' '),
          String(item.sequence),
        ]),
      ),
    [device?.policies, policyQuery],
  );
  const filteredLeases = useMemo(
    () =>
      (device?.dhcpLeases ?? []).filter((item) =>
        matchesQuery(leaseQuery, [item.hostname, item.ip, item.mac, item.interface, item.status]),
      ),
    [device?.dhcpLeases, leaseQuery],
  );

  const pagedInterfaces = useMemo(() => paginateItems(filteredInterfaces, interfacePage), [filteredInterfaces, interfacePage]);
  const pagedVpns = useMemo(() => paginateItems(filteredVpns, vpnPage), [filteredVpns, vpnPage]);
  const pagedPolicies = useMemo(() => paginateItems(filteredPolicies, policyPage), [filteredPolicies, policyPage]);
  const pagedLeases = useMemo(() => paginateItems(filteredLeases, leasePage), [filteredLeases, leasePage]);

  useEffect(() => setInterfacePage(1), [interfaceQuery]);
  useEffect(() => setVpnPage(1), [vpnQuery]);
  useEffect(() => setPolicyPage(1), [policyQuery]);
  useEffect(() => setLeasePage(1), [leaseQuery]);

  useEffect(() => {
    if (!device?.id || !selectedLease?.ip) return;

    api
      .getCachedFortiGateHostScan(device.id, selectedLease.ip, { deep: deepScanEnabled, mac: selectedLease.mac })
      .then((cachedScan) => {
        setScanResult(cachedScan);
        setScanError(cachedScan?.status === 'failed' && cachedScan.error ? cachedScan.error : '');
      })
      .catch(() => {
        setScanResult(null);
        setScanError('');
      });
  }, [device?.id, selectedLease?.ip, deepScanEnabled]);

  useEffect(() => {
    if (!scanLoading || scanStartedAt === null) return undefined;

    const timer = window.setInterval(() => {
      setScanElapsedMs(Date.now() - scanStartedAt);
    }, 250);

    return () => window.clearInterval(timer);
  }, [scanLoading, scanStartedAt]);

  if (device === undefined) return <LoadingState label="Loading FortiGate detail..." />;
  if (device === null) {
    return <ErrorState title="FortiGate not found" description="The requested FortiGate could not be found for any configured site." />;
  }

  const runLeaseScan = async () => {
    if (!selectedLease?.ip) return;
    setScanLoading(true);
    setScanStartedAt(Date.now());
    setScanElapsedMs(0);
    setScanError('');
    try {
      const result = await api.scanFortiGateHost(device.id, selectedLease.ip, {
        deep: deepScanEnabled,
        mac: selectedLease.mac,
      });
      setScanResult(result);
      if (result.status === 'failed' && result.error) {
        setScanError(result.error);
      }
    } catch (error) {
      setScanResult(null);
      setScanError(error instanceof Error ? error.message : 'Unable to scan the selected host');
    } finally {
      setScanLoading(false);
      setScanStartedAt(null);
    }
  };

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
        <Panel
          title="Interfaces"
          subtitle="Live FortiGate interface inventory from system/interface."
          action={<PanelFilter value={interfaceQuery} onChange={setInterfaceQuery} placeholder="Filter interfaces" />}
        >
          <div className="space-y-3">
            {filteredInterfaces.length ? (
              pagedInterfaces.items.map((item) => (
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
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">
                {interfaceQuery ? 'No interfaces match the current filter.' : 'No interface inventory was returned by the FortiGate API for this site.'}
              </div>
            )}
            <PaginationControls
              currentPage={interfacePage}
              totalPages={pagedInterfaces.totalPages}
              totalItems={filteredInterfaces.length}
              onPageChange={setInterfacePage}
            />
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

        <Panel
          title="VPNs"
          subtitle="IPsec Phase 1 tunnels with live status when the monitor endpoint is available."
          action={<PanelFilter value={vpnQuery} onChange={setVpnQuery} placeholder="Filter VPNs" />}
        >
          <div className="space-y-3">
            {filteredVpns.length ? (
              pagedVpns.items.map((vpn) => (
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
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">
                {vpnQuery ? 'No VPNs match the current filter.' : 'No VPN tunnels were returned by the FortiGate API for this site.'}
              </div>
            )}
            <PaginationControls
              currentPage={vpnPage}
              totalPages={pagedVpns.totalPages}
              totalItems={filteredVpns.length}
              onPageChange={setVpnPage}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Firewall Policies"
          subtitle="Top policies from the FortiGate policy table, trimmed for quick review."
          action={<PanelFilter value={policyQuery} onChange={setPolicyQuery} placeholder="Filter policies" />}
        >
          <div className="space-y-3">
            {filteredPolicies.length ? (
              pagedPolicies.items.map((policy) => (
                <button key={policy.id} className="w-full rounded-2xl border border-border bg-soft p-4 text-left transition hover:border-accent/30" onClick={() => setSelectedPolicy(policy)} type="button">
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
                </button>
              ))
            ) : (
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">
                {policyQuery ? 'No policies match the current filter.' : 'No firewall policies were returned by the FortiGate API for this site.'}
              </div>
            )}
            <PaginationControls
              currentPage={policyPage}
              totalPages={pagedPolicies.totalPages}
              totalItems={filteredPolicies.length}
              onPageChange={setPolicyPage}
            />
          </div>
        </Panel>

        <Panel
          title="DHCP Leases"
          subtitle="Current leases from the FortiGate DHCP monitor endpoint when available."
          action={<PanelFilter value={leaseQuery} onChange={setLeaseQuery} placeholder="Filter leases" />}
        >
          <div className="space-y-3">
            {filteredLeases.length ? (
              pagedLeases.items.map((lease) => (
                <div key={lease.id} className="rounded-2xl border border-border bg-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">{lease.hostname}</p>
                      <p className="mt-1 text-xs text-muted">
                        <button className="font-medium text-accent hover:underline" onClick={() => {
                          setSelectedLease(lease);
                          setScanResult(null);
                          setScanError('');
                          setScanStartedAt(null);
                          setScanElapsedMs(0);
                        }} type="button">
                          {lease.ip}
                        </button>{' '}
                        | {lease.mac}
                      </p>
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
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">
                {leaseQuery ? 'No DHCP leases match the current filter.' : 'No DHCP lease data was returned by the FortiGate API for this site.'}
              </div>
            )}
            <PaginationControls
              currentPage={leasePage}
              totalPages={pagedLeases.totalPages}
              totalItems={filteredLeases.length}
              onPageChange={setLeasePage}
            />
          </div>
        </Panel>
      </div>

      <SideDrawer open={Boolean(selectedPolicy)} title={selectedPolicy?.name ?? ''} subtitle="Firewall policy detail" onClose={() => setSelectedPolicy(null)}>
        {selectedPolicy ? (
          <div className="space-y-3">
            <DrawerItem label="Policy ID" value={String(selectedPolicy.sequence)} />
            <DrawerItem label="Action" value={selectedPolicy.action} />
            <DrawerItem label="Status" value={selectedPolicy.status} />
            <DrawerItem label="Source Interface" value={selectedPolicy.srcInterface} />
            <DrawerItem label="Destination Interface" value={selectedPolicy.dstInterface} />
            <DrawerItem label="Source Addresses" value={selectedPolicy.srcAddresses.join(', ') || 'All'} />
            <DrawerItem label="Destination Addresses" value={selectedPolicy.dstAddresses.join(', ') || 'All'} />
            <DrawerItem label="Protocol / Services" value={selectedPolicy.services.join(', ') || 'ALL'} />
            <DrawerItem label="Schedule" value={selectedPolicy.schedule} />
            <DrawerItem label="NAT" value={selectedPolicy.nat ? 'Enabled' : 'Disabled'} />
            <DrawerItem label="Log Traffic" value={selectedPolicy.logTraffic} />
            <DrawerItem label="Comments" value={selectedPolicy.comments || 'No comments'} />
          </div>
        ) : null}
      </SideDrawer>

      <SideDrawer
        open={Boolean(selectedLease)}
        title={selectedLease?.hostname || selectedLease?.ip || ''}
        subtitle={selectedLease ? `DHCP lease on ${selectedLease.interface}` : ''}
        onClose={() => {
          setSelectedLease(null);
          setScanResult(null);
          setScanError('');
          setScanLoading(false);
          setScanStartedAt(null);
          setScanElapsedMs(0);
        }}
        actions={(
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
            disabled={scanLoading || !selectedLease?.ip}
            onClick={() => void runLeaseScan()}
            type="button"
          >
            <ScanSearch className="h-4 w-4" />
            {scanLoading ? `Scanning... ${formatScanElapsed(scanElapsedMs)}` : 'Scan Host'}
          </button>
        )}
      >
        {selectedLease ? (
          <div className="space-y-3">
            <DrawerItem label="IP" value={selectedLease.ip} />
            <DrawerItem label="MAC" value={selectedLease.mac} />
            <DrawerItem label="Interface" value={selectedLease.interface} />
            <DrawerItem label="Status" value={selectedLease.status} />
            <DrawerItem label="Expires" value={selectedLease.expiresAt ? formatRelativeTime(selectedLease.expiresAt) : 'Unknown'} />
            <DrawerItem label="Displayed Scan" value={deepScanEnabled ? 'Deep cached/live result' : 'Basic cached/live result'} />
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-soft px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Deep Scan</p>
                <p className="mt-1 text-sm text-text">Fingerprint services, scan all ports, and capture richer banners.</p>
              </div>
              <button
                className={`focus-ring relative inline-flex h-7 w-12 items-center rounded-full transition ${deepScanEnabled ? 'bg-accent' : 'bg-slate-600/70'}`}
                onClick={() => setDeepScanEnabled((current) => !current)}
                type="button"
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white transition ${deepScanEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>

            {scanError ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{scanError}</div>
            ) : null}

            {scanResult ? (
              <div className="space-y-3">
                <DrawerItem label="Scan Time" value={formatRelativeTime(scanResult.scannedAt)} />
                <DrawerItem label="Cached Identity" value={scanResult.targetMac || selectedLease.mac} />
                <DrawerItem label="Host State" value={scanResult.hostState} />
                <DrawerItem label="Summary" value={scanResult.summary} />
                {scanResult.openPorts.length ? (
                  <div className="rounded-2xl bg-soft p-4">
                    <p className="text-xs uppercase tracking-wide text-muted">Open Ports</p>
                    <div className="mt-3 space-y-2">
                      {scanResult.openPorts.map((port) => (
                        <div key={`${port.port}-${port.protocol}`} className="rounded-2xl border border-border bg-canvas px-4 py-3">
                          <p className="text-sm font-medium text-text">{port.port}/{port.protocol} - {port.service}</p>
                          <p className="mt-1 text-xs text-muted">{port.state}{port.version ? ` | ${port.version}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-2xl bg-soft p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Raw nmap Output</p>
                  <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-text">{scanResult.rawOutput || 'No raw output returned.'}</pre>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No cached scan yet for this host and scan mode. Run a scan to inspect the leased host and store the result here.</div>
            )}
          </div>
        ) : null}
      </SideDrawer>
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

const DrawerItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-soft px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <p className="mt-2 text-sm font-medium text-text">{value}</p>
  </div>
);

const formatScanElapsed = (valueMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const pageSize = 10;

const matchesQuery = (query: string, values: Array<string | null | undefined>) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(needle));
};

const paginateItems = <T,>(items: T[], page: number) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    totalPages,
  };
};

const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalItems <= pageSize) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-canvas px-4 py-3">
      <p className="text-xs text-muted">
        Showing page {currentPage} of {totalPages} for {totalItems} items
      </p>
      <div className="flex items-center gap-2">
        <button
          className="focus-ring rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="focus-ring rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-text disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const PanelFilter = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => (
  <input
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="focus-ring w-40 rounded-xl border border-border bg-soft px-3 py-2 text-xs text-text placeholder:text-muted"
    placeholder={placeholder}
  />
);
