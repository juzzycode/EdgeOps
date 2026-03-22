import { Download, RefreshCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionButton } from '@/components/common/ActionButton';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { LoadingState } from '@/components/common/States';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { AccessPoint, Site } from '@/types/models';

export const ApsPage = () => {
  const [aps, setAps] = useState<AccessPoint[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const role = useAppStore((state) => state.role);
  const selectedSiteId = useAppStore((state) => state.selectedSiteId);
  const canOperate = role !== 'read_only';

  useEffect(() => {
    api.getAps(selectedSiteId).then(setAps).catch(() => setAps([]));
  }, [selectedSiteId]);

  useEffect(() => {
    api.getSites().then(setSites).catch(() => setSites([]));
  }, []);

  const filtered = useMemo(() => {
    if (!aps) return [];
    return aps.filter((ap) => [ap.name, ap.model, ap.serial, ap.ip].some((value) => value.toLowerCase().includes(query.toLowerCase())));
  }, [aps, query]);

  if (!aps) return <LoadingState label="Loading AP inventory..." />;

  const columns: Column<AccessPoint>[] = [
    { key: 'name', header: 'Name', render: (item) => <div><Link className="font-semibold text-accent hover:underline" to={`/aps/${item.id}`}>{item.name}</Link><p className="text-xs text-muted">{item.ip || 'IP unavailable'}</p></div> },
    { key: 'model', header: 'Model', render: (item) => item.model },
    { key: 'serial', header: 'Serial', render: (item) => item.serial },
    { key: 'site', header: 'Site', render: (item) => sites.find((site) => site.id === item.siteId)?.name ?? item.siteId },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge value={item.status} /> },
    { key: 'firmware', header: 'Firmware', render: (item) => `${item.firmware} / ${item.targetFirmware}` },
    { key: 'clients', header: 'Clients', render: (item) => item.clients },
    { key: 'radios', header: 'Radios', render: (item) => item.radios.length },
    { key: 'channel', header: 'Channel', render: (item) => item.radios.map((radio) => radio.channel || 'Auto').join(', ') },
    { key: 'power', header: 'Tx Power', render: (item) => item.radios.map((radio) => radio.txPower).join(', ') },
    { key: 'lastSeen', header: 'Last Seen', render: (item) => formatRelativeTime(item.lastSeen) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Wireless" title="Access Point Management" description="Monitor FortiAP inventory, inspect live client load, and stage future RF actions across the selected site." actions={<><ActionButton><Download className="mr-2 h-4 w-4" />Export</ActionButton><ActionButton onClick={() => api.getAps(selectedSiteId).then(setAps).catch(() => setAps([]))}><RefreshCcw className="mr-2 h-4 w-4" />Refresh</ActionButton></>} />
      <Panel title="AP Inventory" subtitle={`${filtered.length} access points shown`}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-soft px-4 py-3">
            <Search className="h-4 w-4 text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-sm text-text focus:outline-none" placeholder="Search by name, model, serial, or IP" />
          </div>
          <ActionButton className="min-w-36 justify-center" disabled={!canOperate}>Bulk Reboot ({selected.length})</ActionButton>
        </div>
        <DataTable data={filtered} columns={columns} keyExtractor={(item) => item.id} selectable selected={selected} onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))} />
      </Panel>
    </div>
  );
};
