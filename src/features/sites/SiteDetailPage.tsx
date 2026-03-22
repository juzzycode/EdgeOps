import type { ReactNode } from 'react';
import { Cable, Fingerprint, Globe2, KeyRound, MapPinned, ShieldCheck, TimerReset, Waypoints } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { api } from '@/services/api';
import type { Site } from '@/types/models';

export const SiteDetailPage = () => {
  const { id = '' } = useParams();
  const [site, setSite] = useState<Site | null>();

  useEffect(() => {
    api.getSiteById(id).then(setSite).catch(() => setSite(null));
  }, [id]);

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
