import { Download, RefreshCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionButton } from '@/components/common/ActionButton';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { ErrorState, LoadingState } from '@/components/common/States';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { cn, formatBytes, formatRelativeTime, formatWatts } from '@/lib/utils';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { Site, SwitchDevice } from '@/types/models';

export const SwitchesPage = () => {
  const [switches, setSwitches] = useState<SwitchDevice[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'healthy' | 'warning' | 'critical' | 'offline'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const role = useAppStore((state) => state.role);
  const selectedSiteId = useAppStore((state) => state.selectedSiteId);
  const canOperate = role !== 'read_only';

  useEffect(() => {
    Promise.all([api.getSwitches(selectedSiteId), api.getSites()])
      .then(([switchRows, siteRows]) => {
        setSwitches(switchRows);
        setSites(siteRows);
        setError(null);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load switch inventory.');
        setSwitches([]);
      });
  }, [selectedSiteId]);

  const filtered = useMemo(() => {
    if (!switches) return [];
    return switches.filter((device) => {
      const matchesQuery = [device.hostname, device.model, device.serial, device.profileId].some((value) => value.toLowerCase().includes(query.toLowerCase()));
      const matchesFilter = filter === 'all' ? true : device.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, switches]);

  const siteBandwidthMaxima = useMemo(() => {
    const maxima = new Map<string, number>();
    for (const device of switches ?? []) {
      const totalBytes = device.ports.reduce(
        (sum, port) => sum + (port.stats?.rxBytes ?? 0) + (port.stats?.txBytes ?? 0),
        0,
      );
      maxima.set(device.siteId, Math.max(maxima.get(device.siteId) ?? 0, totalBytes));
    }
    return maxima;
  }, [switches]);

  if (!switches) return <LoadingState label="Loading switch inventory..." />;

  const columns: Column<SwitchDevice>[] = [
    { key: 'hostname', header: 'Hostname', render: (item) => <div><Link className="font-semibold text-accent hover:underline" to={`/switches/${item.id}`}>{item.hostname}</Link><p className="text-xs text-muted">{item.managementIp}</p></div> },
    { key: 'model', header: 'Model', render: (item) => item.model },
    { key: 'serial', header: 'Serial', render: (item) => item.serial },
    { key: 'site', header: 'Site', render: (item) => sites.find((site) => site.id === item.siteId)?.name ?? item.siteId },
    { key: 'status', header: 'Status', render: (item) => <StatusBadge value={item.status} /> },
    { key: 'firmware', header: 'Firmware', render: (item) => `${item.firmware} / ${item.targetFirmware}` },
    { key: 'ports', header: 'Ports Used', render: (item) => `${item.portsUsed}/${item.totalPorts}` },
    { key: 'poe', header: 'PoE Usage', render: (item) => `${formatWatts(item.poeUsageWatts)} / ${formatWatts(item.poeBudgetWatts)}` },
    {
      key: 'bandwidth',
      header: 'Bandwidth Comparison',
      render: (item) => {
        const totalBytes = item.ports.reduce(
          (sum, port) => sum + (port.stats?.rxBytes ?? 0) + (port.stats?.txBytes ?? 0),
          0,
        );
        const maxForSite = Math.max(siteBandwidthMaxima.get(item.siteId) ?? 0, 1);
        const percent = Math.round((totalBytes / maxForSite) * 100);

        return (
          <div className="min-w-36">
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>{formatBytes(totalBytes)}</span>
              <span>{percent}% of site peak</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-soft">
              <div
                className={cn(
                  'h-2.5 rounded-full',
                  totalBytes === 0 ? 'bg-slate-500/40' : 'bg-accent',
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    { key: 'uplink', header: 'Uplink', render: (item) => <StatusBadge value={item.uplinkStatus === 'up' ? 'healthy' : item.uplinkStatus === 'degraded' ? 'warning' : 'offline'} /> },
    { key: 'lastSeen', header: 'Last Seen', render: (item) => formatRelativeTime(item.lastSeen) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Switching" title="Switch Management" description={`Showing ${selectedSiteId === 'all' ? 'all managed switches' : 'switches for the selected site'} from the live FortiGate switch controller API.`} actions={<><ActionButton><Download className="mr-2 h-4 w-4" />Export</ActionButton><ActionButton onClick={() => {
        Promise.all([api.getSwitches(selectedSiteId), api.getSites()])
          .then(([switchRows, siteRows]) => {
            setSwitches(switchRows);
            setSites(siteRows);
            setError(null);
          })
          .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to refresh switch inventory.'));
      }}><RefreshCcw className="mr-2 h-4 w-4" />Refresh</ActionButton></>} />
      {error ? <ErrorState title="Switch API unavailable" description={error} /> : null}
      <Panel title="Inventory" subtitle={`${filtered.length} devices shown`}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-soft px-4 py-3">
            <Search className="h-4 w-4 text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-sm text-text focus:outline-none" placeholder="Search by hostname, model, serial, or profile" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text">
              <option value="all">All statuses</option><option value="healthy">Healthy</option><option value="warning">Warning</option><option value="critical">Critical</option><option value="offline">Offline</option>
            </select>
            <ActionButton className="min-w-36 justify-center" disabled={!canOperate}>Bulk Reboot ({selected.length})</ActionButton>
          </div>
        </div>
        <DataTable data={filtered} columns={columns} keyExtractor={(item) => item.id} selectable selected={selected} onToggle={(id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))} />
      </Panel>
    </div>
  );
};
