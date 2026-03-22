import { Download, RefreshCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionButton } from '@/components/common/ActionButton';
import { LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { FortiGateDevice } from '@/types/models';

export const FortiGatesPage = () => {
  const [devices, setDevices] = useState<FortiGateDevice[] | null>(null);
  const [query, setQuery] = useState('');
  const selectedSiteId = useAppStore((state) => state.selectedSiteId);

  useEffect(() => {
    api.getFortiGates(selectedSiteId).then(setDevices).catch(() => setDevices([]));
  }, [selectedSiteId]);

  const filtered = useMemo(() => {
    if (!devices) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return devices;

    return devices.filter((device) =>
      [
        device.name,
        device.hostname,
        device.siteName,
        device.managementIp,
        device.wanIp ?? '',
        device.serial ?? '',
        device.firmware ?? '',
      ].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [devices, query]);

  if (!devices) return <LoadingState label="Loading FortiGate inventory..." />;

  const columns: Column<FortiGateDevice>[] = [
    {
      key: 'name',
      header: 'FortiGate',
      render: (item) => (
        <div>
          <Link className="font-semibold text-accent hover:underline" to={`/fortigates/${item.id}`}>
            {item.name}
          </Link>
          <p className="text-xs text-muted">{item.managementIp || 'Management IP unavailable'}</p>
        </div>
      ),
    },
    { key: 'site', header: 'Site', render: (item) => item.siteName },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge value={item.status} /> },
    { key: 'firmware', header: 'Firmware', render: (item) => item.firmware || 'Unavailable' },
    { key: 'serial', header: 'Serial', render: (item) => item.serial || 'Unavailable' },
    { key: 'wanIp', header: 'WAN IP', render: (item) => item.wanIp || 'Unavailable' },
    { key: 'interfaces', header: 'Interfaces', render: (item) => item.interfaces.length },
    { key: 'clients', header: 'Clients', render: (item) => item.clientCount },
    { key: 'switches', header: 'Switches', render: (item) => item.switchCount },
    { key: 'aps', header: 'APs', render: (item) => item.apCount },
    { key: 'lastSeen', header: 'Last Seen', render: (item) => formatRelativeTime(item.lastSeen) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gateways"
        title="FortiGate Management"
        description="Track live FortiGate health, identity, and interface posture for each onboarded site from one inventory view."
        actions={
          <>
            <ActionButton><Download className="mr-2 h-4 w-4" />Export</ActionButton>
            <ActionButton onClick={() => api.getFortiGates(selectedSiteId).then(setDevices).catch(() => setDevices([]))}>
              <RefreshCcw className="mr-2 h-4 w-4" />Refresh
            </ActionButton>
          </>
        }
      />

      <Panel title="FortiGate Inventory" subtitle={`${filtered.length} FortiGate devices shown`}>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-soft px-4 py-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full border-0 bg-transparent text-sm text-text focus:outline-none"
            placeholder="Search by site, name, IP, serial, or firmware"
          />
        </div>
        <DataTable data={filtered} columns={columns} keyExtractor={(item) => item.id} />
      </Panel>
    </div>
  );
};
