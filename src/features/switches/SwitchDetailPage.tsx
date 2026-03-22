import type { ReactNode } from 'react';
import { BellRing, Lightbulb, Power, RotateCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionButton } from '@/components/common/ActionButton';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PortMap } from '@/components/data-display/PortMap';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { EventLog, SwitchDevice } from '@/types/models';
import { formatRelativeTime } from '@/lib/utils';

export const SwitchDetailPage = () => {
  const { id = '' } = useParams();
  const [device, setDevice] = useState<SwitchDevice | null>();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [message, setMessage] = useState('');
  const role = useAppStore((state) => state.role);
  const canOperate = role !== 'read_only';

  useEffect(() => {
    api.getSwitchById(id).then(setDevice);
    api.getEventLogsByTarget(id).then(setEvents);
  }, [id]);

  const poeUsedPercent = useMemo(() => {
    if (!device) return 0;
    return (device.poeUsageWatts / Math.max(device.poeBudgetWatts, 1)) * 100;
  }, [device]);

  if (device === undefined) return <LoadingState label="Loading switch detail..." />;
  if (device === null) return <ErrorState title="Switch not found" description="The requested device ID does not exist in the live switch inventory." />;

  const runAction = async (action: string, payload?: Record<string, string | boolean>) => {
    const result = await api.simulateDeviceAction(action, device.id, payload);
    setMessage(result.message);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Switch Detail" title={device.hostname} description={`${device.model}${device.managementIp ? ` at ${device.managementIp}` : ''}. Inventory and port state now come from the FortiGate switch controller API; actions are still simulated for now.`} actions={<><ActionButton onClick={() => runAction('reboot')} disabled={!canOperate}><RotateCw className="mr-2 h-4 w-4" />Reboot</ActionButton><ActionButton onClick={() => runAction('blink-led')} disabled={!canOperate}><Lightbulb className="mr-2 h-4 w-4" />Blink LED</ActionButton><ActionButton onClick={() => runAction('sync-config')} disabled={!canOperate}><Save className="mr-2 h-4 w-4" />Sync Config</ActionButton></>} />
      {message ? <div className="rounded-2xl border border-accent/25 bg-accent-muted px-4 py-3 text-sm font-medium text-accent">{message}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Summary">
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryItem label="Status" value={<StatusBadge value={device.status} />} />
            <SummaryItem label="Firmware" value={`${device.firmware} target ${device.targetFirmware}`} />
            <SummaryItem label="Ports Used" value={`${device.portsUsed} of ${device.totalPorts}`} />
            <SummaryItem label="Uplink" value={device.uplinkStatus} />
            <SummaryItem label="PoE Budget" value={`${device.poeUsageWatts}W / ${device.poeBudgetWatts}W`} />
            <SummaryItem label="Last Seen" value={formatRelativeTime(device.lastSeen)} />
          </div>
          <div className="mt-4 rounded-2xl bg-soft p-4">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="text-muted">PoE consumption</span><span className="font-semibold text-text">{Math.round(poeUsedPercent)}%</span></div>
            <div className="h-3 rounded-full bg-slate-200/10"><div className="h-3 rounded-full bg-accent" style={{ width: `${Math.min(poeUsedPercent, 100)}%` }} /></div>
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
      <Panel title="Port Map" subtitle="Visual summary of port status, VLAN, and PoE draw.">
        <PortMap ports={device.ports} />
      </Panel>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Port Status List">
          <div className="space-y-3">
            {device.ports.slice(0, 8).map((port) => (
              <div key={port.id} className="rounded-2xl bg-soft px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="font-medium text-text">{formatPortLabel(port.portNumber)}</p><p className="text-xs text-muted">{port.description}</p></div>
                  <StatusBadge value={port.status === 'up' ? 'healthy' : port.status === 'warning' ? 'warning' : 'inactive'} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{port.vlan}</span><span>{port.poeWatts}W PoE</span></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="VLAN / Neighbor View">
          <div className="space-y-3">
            {device.ports.filter((port) => port.neighbor || port.vlan).slice(0, 8).map((port) => (
              <div key={port.id} className="rounded-2xl bg-soft px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-text">{formatPortLabel(port.portNumber)}</p>
                  {port.tags?.length ? <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">{port.tags.join(' / ')}</span> : null}
                </div>
                <p className="mt-1 text-xs text-muted">VLAN: {port.vlan}</p>
                <p className="mt-1 text-xs text-muted">Neighbor: {port.neighbor ?? 'Endpoint / no LLDP data'}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Event History" action={<BellRing className="h-4 w-4 text-muted" />}>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-border bg-soft p-4">
                <p className="text-sm font-semibold text-text">{event.message}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{event.actor}</span><span>{formatRelativeTime(event.timestamp)}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Simulated Port Actions" subtitle="UI-only actions structured so they can later call device command APIs.">
        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={() => runAction('change-port-description', { port: '1', description: 'Reception desk' })} disabled={!canOperate}><Save className="mr-2 h-4 w-4" />Change Port Description</ActionButton>
          <ActionButton onClick={() => runAction('toggle-port', { port: '4', enabled: false })} disabled={!canOperate}><Power className="mr-2 h-4 w-4" />Disable Port 4</ActionButton>
          <ActionButton onClick={() => runAction('assign-vlan-profile', { port: '7', profile: 'Voice-Edge' })} disabled={!canOperate}><Save className="mr-2 h-4 w-4" />Assign VLAN Profile</ActionButton>
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

const formatPortLabel = (value: string) => (value.toLowerCase().startsWith('port') ? value : `Port ${value}`);
