import { BadgeCheck, Clock3, ShieldBan } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { FirmwareStatus, Site } from '@/types/models';

export const FirmwarePage = () => {
  const [rows, setRows] = useState<FirmwareStatus[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'pending' | 'blocked'>('all');
  const { selectedSiteId } = useAppStore();

  useEffect(() => {
    setError(null);
    Promise.all([api.getFirmwareStatuses(selectedSiteId), api.getSites()])
      .then(([firmwareRows, siteRows]) => {
        setRows(firmwareRows);
        setSites(siteRows);
      })
      .catch((requestError) => {
        setRows([]);
        setSites([]);
        setError(requestError instanceof Error ? requestError.message : 'Unable to load firmware posture');
      });
  }, [selectedSiteId]);

  const summary = useMemo(() => {
    if (!rows) return { compliant: 0, pending: 0, blocked: 0 };
    return rows.reduce(
      (acc, row) => {
        acc[row.compliance] += 1;
        return acc;
      },
      { compliant: 0, pending: 0, blocked: 0 },
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((row) => (complianceFilter === 'all' ? true : row.compliance === complianceFilter));
  }, [rows, complianceFilter]);

  const scopedSites = useMemo(() => {
    if (selectedSiteId && selectedSiteId !== 'all') {
      return sites.filter((site) => site.id === selectedSiteId);
    }
    return sites;
  }, [selectedSiteId, sites]);

  const sitesWithoutFirmware = useMemo(() => {
    const siteIdsWithFirmware = new Set(rows?.map((row) => row.siteId).filter(Boolean));
    return scopedSites.filter((site) => !siteIdsWithFirmware.has(site.id));
  }, [rows, scopedSites]);

  if (!rows) return <LoadingState label="Loading firmware view..." />;

  const columns: Column<FirmwareStatus>[] = [
    {
      key: 'device',
      header: 'Device',
      render: (item) => (
        <div>
          {item.deviceType === 'fortigate' ? (
            <p className="font-medium text-text">{item.deviceName ?? item.deviceId}</p>
          ) : (
            <Link className="font-medium text-accent hover:underline" to={item.deviceType === 'switch' ? `/switches/${item.deviceId}` : `/aps/${item.deviceId}`}>
              {item.deviceName ?? item.deviceId}
            </Link>
          )}
          <p className="text-xs uppercase tracking-wide text-muted">{item.deviceType}</p>
          <p className="mt-1 text-xs text-muted">Serial: {item.serial ?? 'Unavailable'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-canvas px-2 py-1 text-[11px] font-medium text-text">Current: {item.current}</span>
            <span className="rounded-full bg-canvas px-2 py-1 text-[11px] font-medium text-text">Target: {item.target}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'site',
      header: 'Site',
      render: (item) => item.siteName ?? item.siteId ?? 'Unknown',
    },
    { key: 'current', header: 'Current Version', render: (item) => item.current },
    { key: 'target', header: 'Target Version', render: (item) => item.target },
    { key: 'compliance', header: 'Compliance', render: (item) => <StatusBadge value={item.compliance} /> },
    { key: 'group', header: 'Rollout Group', render: (item) => item.rolloutGroup },
    { key: 'eligible', header: 'Eligible', render: (item) => (item.eligible ? 'Yes' : 'No') },
  ];

  const rolloutGroups = [...new Set(rows.map((row) => row.rolloutGroup))].sort();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lifecycle" title="Firmware Lifecycle" description="Live firmware compliance derived from the current switch and AP inventory, organized for staged rollout planning." />
      {error ? <ErrorState title="Firmware API unavailable" description={error} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Compliant" value={String(summary.compliant)} icon={BadgeCheck} />
        <StatCard title="Pending" value={String(summary.pending)} icon={Clock3} />
        <StatCard title="Blocked" value={String(summary.blocked)} icon={ShieldBan} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Panel
          title="Staged Rollout Queue"
          subtitle="Filtered by the global site selector and grouped with rollout hints for future orchestration."
          action={
            <select value={complianceFilter} onChange={(event) => setComplianceFilter(event.target.value as typeof complianceFilter)} className="focus-ring rounded-2xl border border-border bg-soft px-4 py-2 text-sm text-text">
              <option value="all">All states</option>
              <option value="compliant">Compliant</option>
              <option value="pending">Pending</option>
              <option value="blocked">Blocked</option>
            </select>
          }
        >
          {filteredRows.length ? (
            <DataTable data={filteredRows} columns={columns} keyExtractor={(item) => item.id} />
          ) : (
            <EmptyState title="No firmware records in scope" description="Try widening the site selector or resetting the compliance filter." />
          )}
        </Panel>

        <Panel title="Upgrade Groups" subtitle="Derived rollout cohorts based on live site scope and device eligibility.">
          {rolloutGroups.length ? (
            <div className="space-y-3">
              {rolloutGroups.map((group) => {
                const groupRows = rows.filter((row) => row.rolloutGroup === group);
                const eligible = groupRows.filter((row) => row.eligible).length;
                const pending = groupRows.filter((row) => row.compliance === 'pending').length;

                return (
                  <div key={group} className="rounded-3xl border border-border bg-soft p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-text">{group}</p>
                      <span className="text-xs text-muted">{groupRows.length} devices</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{eligible} eligible, {pending} pending upgrade target alignment.</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No rollout groups available" description="No switch or AP firmware rows were returned for the current scope." />
          )}
        </Panel>
      </div>
      {sitesWithoutFirmware.length ? (
        <Panel title="Sites Without Firmware Rows" subtitle="These sites are in scope, but no switch or AP firmware rows were returned for them.">
          <div className="space-y-3">
            {sitesWithoutFirmware.map((site) => (
              <div key={site.id} className="rounded-3xl border border-border bg-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-text">{site.name}</p>
                  <span className="text-xs text-muted">{site.region}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  No managed switch or AP firmware rows were returned for this site in the current scope.
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
};
