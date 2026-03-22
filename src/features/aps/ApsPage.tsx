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
import type { AccessPoint, RogueAccessPoint, Site } from '@/types/models';

export const ApsPage = () => {
  const [aps, setAps] = useState<AccessPoint[] | null>(null);
  const [rogueAps, setRogueAps] = useState<RogueAccessPoint[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const role = useAppStore((state) => state.role);
  const selectedSiteId = useAppStore((state) => state.selectedSiteId);
  const canOperate = role !== 'read_only';

  useEffect(() => {
    api.getAps(selectedSiteId).then(setAps).catch(() => setAps([]));
    api.getRogueAps(selectedSiteId).then(setRogueAps).catch(() => setRogueAps([]));
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

      <Panel title="Rogue / Interfering APs" subtitle={`${rogueAps.length} entries reported by FortiGate rogue AP status when available`}>
        {rogueAps.length ? (
          <div className="overflow-hidden rounded-3xl border border-border">
            <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr_1fr] gap-3 bg-soft px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
              <span>SSID</span>
              <span>BSSID</span>
              <span>Status</span>
              <span>Detected By</span>
              <span>Site</span>
            </div>
            <div className="divide-y divide-border/70">
              {rogueAps.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[1.2fr_1.2fr_0.8fr_1fr_1fr] gap-3 px-4 py-3 text-sm text-text">
                  <span>{entry.ssid}</span>
                  <span className="text-muted">{entry.bssid}</span>
                  <span><StatusBadge value={entry.status === 'rogue' ? 'critical' : entry.status === 'accepted' ? 'healthy' : entry.status === 'suppressed' ? 'warning' : 'inactive'} /></span>
                  <span>{entry.detectedBy || entry.vendor || 'Unknown'}</span>
                  <span>{sites.find((site) => site.id === entry.siteId)?.name ?? entry.siteId}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No rogue or interfering AP entries were returned for the current site scope.</div>
        )}
      </Panel>
    </div>
  );
};
