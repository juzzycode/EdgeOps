import type { ReactNode } from 'react';
import { Cable, Download, FileClock, Fingerprint, GitCompareArrows, Globe2, KeyRound, LoaderCircle, MapPinned, RefreshCcw, ShieldCheck, TimerReset, Waypoints } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { api } from '@/services/api';
import type { Site, SiteConfigDiff, SiteConfigSnapshot } from '@/types/models';

export const SiteDetailPage = () => {
  const { id = '' } = useParams();
  const [site, setSite] = useState<Site | null>();
  const [snapshots, setSnapshots] = useState<SiteConfigSnapshot[]>([]);
  const [diff, setDiff] = useState<SiteConfigDiff | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [syncingSnapshot, setSyncingSnapshot] = useState(false);
  const [selectedToSnapshotId, setSelectedToSnapshotId] = useState<string>('');
  const [selectedFromSnapshotId, setSelectedFromSnapshotId] = useState<string>('');

  useEffect(() => {
    api.getSiteById(id).then(setSite).catch(() => setSite(null));
  }, [id]);

  const refreshConfigArchive = async (preferredToSnapshotId?: string, preferredFromSnapshotId?: string) => {
    setLoadingSnapshots(true);
    setConfigError(null);

    try {
      const snapshotRows = await api.getSiteConfigSnapshots(id);
      setSnapshots(snapshotRows);

      const successfulSnapshots = snapshotRows.filter((snapshot) => snapshot.status === 'success');
      const toSnapshotId = preferredToSnapshotId || successfulSnapshots[0]?.id || '';
      const fromSnapshotId =
        preferredFromSnapshotId ||
        successfulSnapshots.find((snapshot) => snapshot.id !== toSnapshotId)?.id ||
        '';

      setSelectedToSnapshotId(toSnapshotId);
      setSelectedFromSnapshotId(fromSnapshotId);

      if (toSnapshotId && fromSnapshotId) {
        setDiff(await api.getSiteConfigDiff(id, { fromSnapshotId, toSnapshotId }));
      } else {
        setDiff(null);
      }
    } catch (requestError) {
      setSnapshots([]);
      setDiff(null);
      setConfigError(requestError instanceof Error ? requestError.message : 'Unable to load site config archive');
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    void refreshConfigArchive();
  }, [id]);

  const successfulSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.status === 'success'),
    [snapshots],
  );

  const handleSyncSnapshot = async () => {
    setSyncingSnapshot(true);
    setConfigError(null);

    try {
      const snapshot = await api.syncSiteConfigSnapshot(id, true);
      await refreshConfigArchive(snapshot.id, successfulSnapshots[0]?.id);
    } catch (requestError) {
      setConfigError(requestError instanceof Error ? requestError.message : 'Unable to refresh today\'s snapshot');
    } finally {
      setSyncingSnapshot(false);
    }
  };

  const handleDiffSelectionChange = async (nextFromSnapshotId: string, nextToSnapshotId: string) => {
    setSelectedFromSnapshotId(nextFromSnapshotId);
    setSelectedToSnapshotId(nextToSnapshotId);
    setConfigError(null);

    if (!nextFromSnapshotId || !nextToSnapshotId) {
      setDiff(null);
      return;
    }

    try {
      setDiff(await api.getSiteConfigDiff(id, { fromSnapshotId: nextFromSnapshotId, toSnapshotId: nextToSnapshotId }));
    } catch (requestError) {
      setDiff(null);
      setConfigError(requestError instanceof Error ? requestError.message : 'Unable to load config diff');
    }
  };

  if (site === undefined) return <LoadingState label="Loading site detail..." />;
  if (site === null) return <ErrorState title="Site not found" description="The requested site does not exist or the backend could not return it." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Site Detail"
        title={site.name}
        description={`${site.address} - ${site.timezone}. This view is now driven by live FortiGate summary calls instead of the earlier placeholder layout.`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Site Summary" subtitle="Core location metadata and generated shorthand id.">
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryItem label="Health" value={<StatusBadge value={site.status} />} />
            <SummaryItem label="Site ID" value={site.shorthandId ?? 'Pending'} />
            <SummaryItem label="WAN Status" value={site.wanStatus} />
            <SummaryItem label="Source" value={site.source ?? 'live'} />
            <SummaryItem label="Region" value={site.region} />
            <SummaryItem label="Timezone" value={site.timezone} />
          </div>
        </Panel>

        <Panel title="Address" subtitle="Location metadata stored with the site record.">
          <div className="flex min-h-56 flex-col justify-between rounded-[28px] bg-soft p-5">
            <div>
              <div className="inline-flex rounded-2xl bg-accent/10 p-3 text-accent">
                <MapPinned className="h-5 w-5" />
              </div>
              <p className="mt-4 text-lg font-semibold text-text">{site.address}</p>
              <p className="mt-2 text-sm text-muted">Use this panel later for geo lookups, map overlays, and circuit annotations without changing the site contract.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniTile icon={Cable} label="Switches" value={String(site.switchCount)} />
              <MiniTile icon={Waypoints} label="APs" value={String(site.apCount)} />
              <MiniTile icon={Globe2} label="Clients" value={String(site.clientCount)} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="FortiGate Connection" subtitle="Live summary pulled from the FortiGate REST API.">
          <div className="space-y-3">
            <DetailRow label="FortiGate Name" value={site.fortigateName || 'Not configured'} />
            <DetailRow label="FortiGate IP" value={site.fortigateIp || 'Not configured'} />
            <DetailRow label="WAN IP" value={site.wanIp || 'Unavailable'} />
            <DetailRow label="API Reachable" value={site.apiReachable ? 'Yes' : 'No'} />
            <DetailRow label="Config Archive" value={site.configArchiveEnabled ? 'Enabled' : 'Disabled'} />
            <DetailRow label="Address Objects" value={String(site.addressObjectCount ?? 0)} />
          </div>
        </Panel>

        <Panel title="Firmware and Identity" subtitle="Returned from the monitor system status call when available.">
          <div className="space-y-3">
            <DetailRow icon={ShieldCheck} label="Version" value={site.fortigateVersion || 'Unavailable'} />
            <DetailRow icon={Fingerprint} label="Serial" value={site.fortigateSerial || 'Unavailable'} />
            <DetailRow icon={KeyRound} label="Polling State" value={site.apiReachable ? 'Authenticated' : 'Needs attention'} />
          </div>
        </Panel>

        <Panel title="Connection Health" subtitle="Cached ping results plus FortiGate API outcome.">
          <div className="mb-4 space-y-3">
            <DetailRow icon={TimerReset} label="Average Latency" value={formatLatency(site.latencyAvgMs)} />
            <DetailRow label="Latency Range" value={formatRange(site.latencyMinMs, site.latencyMaxMs)} />
            <DetailRow label="Packet Loss" value={formatPacketLoss(site.latencyPacketLoss)} />
            <DetailRow label="Ping Cache" value={site.latencyCheckedAt ? new Date(site.latencyCheckedAt).toLocaleString() : 'Not measured yet'} />
          </div>

          {site.latencyError ? (
            <div className="mb-4 rounded-3xl border border-warning/20 bg-warning/10 p-4">
              <p className="text-sm font-semibold text-warning">Ping check warning</p>
              <p className="mt-2 text-sm text-warning/90">{site.latencyError}</p>
            </div>
          ) : null}

          {site.lastSyncError ? (
            <div className="rounded-3xl border border-danger/20 bg-danger/10 p-4">
              <p className="text-sm font-semibold text-danger">Last sync error</p>
              <p className="mt-2 text-sm text-danger/90">{site.lastSyncError}</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-300">FortiGate summary is current</p>
              <p className="mt-2 text-sm text-emerald-100/80">The API call returned successfully and the site is using live summary data.</p>
            </div>
          )}
          <div className="mt-4 rounded-3xl bg-soft p-4 text-sm text-muted">
            The backend currently queries FortiGate system status and firewall address objects. That gives us a reliable live foothold before we expand into interface, DHCP, VPN, and policy inventory calls.
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel
          title="Site Config Archive"
          subtitle="Daily FortiGate configuration snapshots, downloadable backups, and one-click refresh for today's archive."
          action={
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              disabled={syncingSnapshot || !site.configArchiveEnabled}
              onClick={() => void handleSyncSnapshot()}
              type="button"
            >
              {syncingSnapshot ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh Today's Snapshot
            </button>
          }
        >
          {!site.configArchiveEnabled ? (
            <ErrorState title="Config archive disabled" description="Enable daily config archiving in the site settings if you want scheduled FortiGate backups, downloads, and day-to-day diffs for this location." />
          ) : loadingSnapshots ? (
            <LoadingState label="Loading site config archive..." />
          ) : configError ? (
            <ErrorState title="Config archive unavailable" description={configError} />
          ) : snapshots.length ? (
            <div className="space-y-3">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-3xl border border-border bg-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileClock className="h-4 w-4 text-accent" />
                        <p className="font-semibold text-text">{snapshot.snapshotDate}</p>
                        <StatusBadge value={snapshot.status === 'success' ? 'healthy' : 'warning'} />
                      </div>
                      <p className="mt-2 text-sm text-muted">Fetched {new Date(snapshot.fetchedAt).toLocaleString()}</p>
                      {snapshot.changeSummary ? (
                        <p className="mt-2 text-sm text-muted">
                          {snapshot.changeSummary.comparedToDate
                            ? `Compared to ${snapshot.changeSummary.comparedToDate}: +${snapshot.changeSummary.addedLines} / -${snapshot.changeSummary.removedLines}`
                            : 'First successful archived config for this site.'}
                        </p>
                      ) : null}
                      {snapshot.errorText ? <p className="mt-2 text-sm text-danger">{snapshot.errorText}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {snapshot.status === 'success' ? (
                        <a
                          className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-canvas"
                          href={api.getDownloadUrl(`/api/sites/${encodeURIComponent(id)}/config-snapshots/${encodeURIComponent(snapshot.id)}/download`)}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ErrorState title="No config snapshots yet" description="Create the first FortiGate config backup for this site to start a daily archive and diff history." />
          )}
        </Panel>

        <Panel title="Daily Config Diffs" subtitle="Compare archived snapshots to see what changed between days.">
          {successfulSnapshots.length >= 2 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Compare From</span>
                  <select
                    className={inputClassName}
                    onChange={(event) => void handleDiffSelectionChange(event.target.value, selectedToSnapshotId)}
                    value={selectedFromSnapshotId}
                  >
                    <option value="">Select older snapshot</option>
                    {successfulSnapshots
                      .filter((snapshot) => snapshot.id !== selectedToSnapshotId)
                      .map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.snapshotDate}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Compare To</span>
                  <select
                    className={inputClassName}
                    onChange={(event) => void handleDiffSelectionChange(selectedFromSnapshotId, event.target.value)}
                    value={selectedToSnapshotId}
                  >
                    <option value="">Select newer snapshot</option>
                    {successfulSnapshots
                      .filter((snapshot) => snapshot.id !== selectedFromSnapshotId)
                      .map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.snapshotDate}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {diff ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniTile icon={GitCompareArrows} label="Compared" value={`${diff.fromSnapshot.snapshotDate} -> ${diff.toSnapshot.snapshotDate}`} />
                    <MiniTile icon={RefreshCcw} label="Added" value={String(diff.stats.addedLines)} />
                    <MiniTile icon={Download} label="Removed" value={String(diff.stats.removedLines)} />
                  </div>
                  <pre className="mt-4 max-h-[32rem] overflow-auto rounded-3xl border border-border bg-soft p-4 text-xs leading-6 text-text">
                    {diff.diffText}
                  </pre>
                </>
              ) : (
                <ErrorState title="Select two snapshots" description="Choose two successful daily archives to render a config diff." />
              )}
            </>
          ) : (
            <ErrorState title="Not enough archived days yet" description="At least two successful daily snapshots are needed before a diff can be shown." />
          )}
        </Panel>
      </div>
    </div>
  );
};

const SummaryItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-2xl bg-soft px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <div className="mt-2 text-sm font-medium capitalize text-text">{value}</div>
  </div>
);

const formatLatency = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)} ms` : 'Unavailable');

const formatRange = (min?: number | null, max?: number | null) =>
  typeof min === 'number' && typeof max === 'number' ? `${min.toFixed(1)}-${max.toFixed(1)} ms` : 'Unavailable';

const formatPacketLoss = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(0)}%` : 'Unavailable');

const MiniTile = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cable;
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl bg-surface px-4 py-3">
    <div className="flex items-center gap-2 text-muted">
      <Icon className="h-4 w-4" />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-2 text-xl font-semibold text-text">{value}</p>
  </div>
);

const inputClassName =
  'focus-ring w-full rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text';

const DetailRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof ShieldCheck;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-soft px-4 py-3">
    <div className="flex items-center gap-3">
      {Icon ? <Icon className="h-4 w-4 text-accent" /> : null}
      <span className="text-sm text-muted">{label}</span>
    </div>
    <span className="text-right text-sm font-medium text-text">{value}</span>
  </div>
);
