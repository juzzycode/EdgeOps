import type { ReactNode } from 'react';
import { Lightbulb, Radio, RotateCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionButton } from '@/components/common/ActionButton';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatPercent, formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { AccessPoint, EventLog } from '@/types/models';

export const ApDetailPage = () => {
  const { id = '' } = useParams();
  const [device, setDevice] = useState<AccessPoint | null>();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [message, setMessage] = useState('');
  const role = useAppStore((state) => state.role);
  const canOperate = role !== 'read_only';

  useEffect(() => {
    api.getApById(id).then(setDevice);
    api.getEventLogsByTarget(id).then(setEvents);
  }, [id]);

  if (device === undefined) return <LoadingState label="Loading AP detail..." />;
  if (device === null) return <ErrorState title="Access point not found" description="The requested device ID could not be found for any configured site." />;

  const runAction = async (action: string, payload?: Record<string, string | boolean>) => {
    const result = await api.simulateDeviceAction(action, device.id, payload);
    setMessage(result.message);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AP Detail"
        title={device.name}
        description={`${device.model} at ${device.ip || 'management IP unavailable'}. Inventory, radios, SSIDs, and client counts are live from the FortiGate API.`}
        actions={
          <>
            <ActionButton onClick={() => runAction('reboot-ap')} disabled={!canOperate}><RotateCw className="mr-2 h-4 w-4" />Reboot AP</ActionButton>
            <ActionButton onClick={() => runAction('blink-led')} disabled={!canOperate}><Lightbulb className="mr-2 h-4 w-4" />Blink LED</ActionButton>
            <ActionButton onClick={() => runAction('assign-profile', { profile: 'ap-office-standard' })} disabled={!canOperate}><Save className="mr-2 h-4 w-4" />Assign Profile</ActionButton>
          </>
        }
      />
      {message ? <div className="rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3 text-sm font-medium text-accent">{message}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Summary">
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryItem label="Status" value={<StatusBadge value={device.status} />} />
            <SummaryItem label="Firmware" value={`${device.firmware} target ${device.targetFirmware}`} />
            <SummaryItem label="Clients" value={device.clients} />
            <SummaryItem label="Profile" value={device.profileId} />
            <SummaryItem label="Management IP" value={device.ip || 'Unavailable'} />
            <SummaryItem label="Last Seen" value={formatRelativeTime(device.lastSeen)} />
            <SummaryItem label="Neighbor APs" value={device.neighborAps.length || 'None'} />
          </div>
        </Panel>
        <Panel title="Config Summary">
          <div className="space-y-3">
            {device.configSummary.map((item) => (
              <div key={item} className="rounded-2xl bg-soft px-4 py-3 text-sm text-text">{item}</div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Radio Status">
          <div className="space-y-3">
            {device.radios.map((radio) => (
              <div key={radio.id} className="rounded-2xl bg-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-accent-muted p-2 text-accent"><Radio className="h-4 w-4" /></div>
                    <div>
                      <p className="font-semibold text-text">{radio.band}</p>
                      <p className="text-xs text-muted">Channel {radio.channel || 'Auto'} | {radio.txPower}</p>
                    </div>
                  </div>
                  <StatusBadge value={radio.status === 'up' ? 'healthy' : 'offline'} />
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted"><span>Load Proxy</span><span>{formatPercent(radio.utilization)}</span></div>
                  <div className="h-2 rounded-full bg-slate-200/10"><div className="h-2 rounded-full bg-accent" style={{ width: `${radio.utilization}%` }} /></div></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="SSIDs Broadcast">
          <div className="space-y-3">
            {device.ssids.map((ssid) => (
              <div key={ssid.id} className="rounded-2xl bg-soft p-4">
                <p className="font-semibold text-text">{ssid.name}</p>
                <p className="mt-1 text-xs text-muted">{ssid.authMode} | {ssid.vlan}</p>
                <p className="mt-2 text-sm text-text">{ssid.clientCount} clients</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Neighbors / Events">
          <div className="space-y-3">
            {device.neighborAps.map((neighbor) => (
              <div key={neighbor} className="rounded-2xl bg-soft px-4 py-3 text-sm text-text">Neighbor AP: {neighbor}</div>
            ))}
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-border bg-soft p-4">
                <p className="text-sm font-semibold text-text">{event.message}</p>
                <p className="mt-2 text-xs text-muted">{formatRelativeTime(event.timestamp)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Connected Clients">
        <div className="grid gap-3 md:grid-cols-2">
          {(device.clientDevices ?? []).length ? (
            device.clientDevices?.map((client) => (
              <div key={client.id} className="rounded-2xl border border-border bg-soft p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{client.name}</p>
                    <p className="mt-1 text-xs text-muted">{client.ip || client.mac}</p>
                  </div>
                  <StatusBadge value={client.health === 'poor' || client.health === 'fair' ? 'warning' : 'healthy'} />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted">
                  <div>SSID: {client.ssid}</div>
                  <div>Radio: {client.radioType || client.radioId}</div>
                  <div>Signal: {client.signal ?? 'N/A'} dBm</div>
                  <div>SNR: {client.snr ?? 'N/A'} dB</div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-soft px-4 py-6 text-sm text-muted">No live wireless clients are currently associated with this access point.</div>
          )}
        </div>
      </Panel>
      <Panel title="Simulated Wireless Actions">
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => runAction('change-ap-name', { name: 'Conference AP East' })} disabled={!canOperate}>Change AP Name</ActionButton>
          <ActionButton onClick={() => runAction('toggle-radio', { radio: '5 GHz', enabled: false })} disabled={!canOperate}>Disable 5 GHz Radio</ActionButton>
          <ActionButton onClick={() => runAction('assign-profile', { profile: 'ap-lab-high-density' })} disabled={!canOperate}>Assign AP Profile</ActionButton>
        </div>
      </Panel>
    </div>
  );
};

const SummaryItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-2xl bg-soft px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <div className="mt-2 text-sm font-medium text-text">{value}</div>
  </div>
);
