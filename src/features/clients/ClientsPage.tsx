import { Network, Search, Wifi } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingState } from '@/components/common/States';
import { SideDrawer } from '@/components/drawers/SideDrawer';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatDuration, formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Client, Site } from '@/types/models';

const getClientStatusPresentation = (client: Client) => {
  if (client.status === 'blocked') {
    return {
      badge: 'critical' as const,
      label: 'Client is blocked or quarantined by the upstream policy.',
    };
  }

  if (client.status === 'idle') {
    return {
      badge: 'warning' as const,
      label: `Client is idle and has not been seen recently by the FortiGate${client.connectedAt ? ` since ${formatRelativeTime(client.connectedAt)}` : ''}.`,
    };
  }

  return {
    badge: 'healthy' as const,
    label: 'Client is active in the latest FortiGate inventory.',
  };
};

export const ClientsPage = () => {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const selectedSiteId = useAppStore((state) => state.selectedSiteId);

  useEffect(() => {
    api.getClients(selectedSiteId).then(setClients).catch(() => setClients([]));
  }, [selectedSiteId]);

  useEffect(() => {
    api.getSites().then(setSites).catch(() => setSites([]));
  }, []);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const lowered = query.toLowerCase();
    return clients.filter((client) =>
      [
        client.name,
        client.hostname ?? '',
        client.mac,
        client.ip,
        client.username,
        client.vendor ?? '',
        client.network,
        client.connectedPort ?? '',
        client.connectedApName ?? '',
      ].some((value) => value.toLowerCase().includes(lowered)),
    );
  }, [clients, query]);

  if (!clients) return <LoadingState label="Loading client inventory..." />;

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client Name',
      render: (item) => (
        <button className="text-left font-semibold text-accent hover:underline" onClick={() => setSelectedClient(item)}>
          {item.name}
        </button>
      ),
    },
    {
      key: 'type',
      header: 'Connection',
      render: (item) => (
        <span className="inline-flex items-center gap-2">
          {item.connectionType === 'wired' ? <Network className="h-4 w-4 text-muted" /> : <Wifi className="h-4 w-4 text-muted" />}
          {item.connectionType}
        </span>
      ),
    },
    { key: 'ip', header: 'IP', render: (item) => item.ip || 'Unavailable' },
    { key: 'mac', header: 'MAC', render: (item) => item.mac || 'Unavailable' },
    { key: 'network', header: 'VLAN / SSID', render: (item) => item.network },
    {
      key: 'device',
      header: 'Connected Device',
      render: (item) => item.connectionType === 'wired' ? `${item.connectedDeviceId}${item.connectedPort ? ` / ${item.connectedPort}` : ''}` : item.connectedApName || item.connectedDeviceId,
    },
    { key: 'site', header: 'Site', render: (item) => sites.find((site) => site.id === item.siteId)?.name ?? item.siteId },
    { key: 'usage', header: 'Usage', render: () => 'N/A' },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const status = getClientStatusPresentation(item);
        return <StatusBadge value={status.badge} title={status.badge === 'warning' ? status.label : undefined} />;
      },
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <PageHeader eyebrow="Endpoints" title="Clients & Endpoints" description="Track live FortiGate-discovered wired and wireless endpoints, search by identity attributes, and inspect switch port or AP attachment details." />
        <Panel title="Client Inventory" subtitle={`${filtered.length} clients shown`}>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-soft px-4 py-3">
            <Search className="h-4 w-4 text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-sm text-text focus:outline-none" placeholder="Search hostname, MAC, IP, username, vendor, SSID, or port" />
          </div>
          <DataTable data={filtered} columns={columns} keyExtractor={(item) => item.id} />
        </Panel>
      </div>
      <SideDrawer open={Boolean(selectedClient)} title={selectedClient?.name ?? ''} subtitle="Live endpoint detail" onClose={() => setSelectedClient(null)}>
        {selectedClient ? (
          <div className="space-y-3">
            <DrawerItem label="Hostname" value={selectedClient.hostname || selectedClient.name} />
            <DrawerItem label="Connection" value={selectedClient.connectionType} />
            <DrawerItem label="IP / MAC" value={`${selectedClient.ip || 'Unavailable'} | ${selectedClient.mac || 'Unavailable'}`} />
            <DrawerItem label="Network" value={selectedClient.network} />
            <DrawerItem label="Vendor / OS" value={[selectedClient.vendor, selectedClient.osName, selectedClient.osVersion].filter(Boolean).join(' | ') || 'Unknown'} />
            <DrawerItem label="Connected Device" value={selectedClient.connectionType === 'wired' ? `${selectedClient.connectedDeviceId}${selectedClient.connectedPort ? ` | ${selectedClient.connectedPort}` : ''}` : selectedClient.connectedApName || selectedClient.connectedDeviceId} />
            <DrawerItem label="Detected Interface" value={selectedClient.detectedInterface || 'Unknown'} />
            <DrawerItem label="VLAN / Lease" value={[selectedClient.vlanId ? `VLAN ${selectedClient.vlanId}` : null, selectedClient.dhcpLeaseStatus].filter(Boolean).join(' | ') || 'Unavailable'} />
            <DrawerItem label="Status" value={selectedClient.status} />
            <DrawerItem label="Last Seen" value={formatRelativeTime(selectedClient.lastSeen)} />
            <DrawerItem label="Connected Since" value={selectedClient.connectedAt ? formatRelativeTime(selectedClient.connectedAt) : 'Unavailable'} />
            <DrawerItem label="Historical Connection" value="Live device inventory is wired in. Roaming history and session trails can layer on later from telemetry or session logs." />
          </div>
        ) : null}
      </SideDrawer>
    </>
  );
};

const DrawerItem = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-soft px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <p className="mt-2 text-sm font-medium text-text">{value}</p>
  </div>
);
