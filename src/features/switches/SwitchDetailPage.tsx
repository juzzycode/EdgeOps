import type { ReactNode } from 'react';
import { BellRing, Lightbulb, RotateCw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionButton } from '@/components/common/ActionButton';
import { ErrorState, LoadingState } from '@/components/common/States';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SideDrawer } from '@/components/drawers/SideDrawer';
import { PortBandwidthChart } from '@/components/data-display/PortBandwidthChart';
import { PortMap } from '@/components/data-display/PortMap';
import { api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { EventLog, SwitchDevice, SwitchPort, SwitchVlanOption } from '@/types/models';
import { formatBytes, formatRelativeTime } from '@/lib/utils';

export const SwitchDetailPage = () => {
  const { id = '' } = useParams();
  const [device, setDevice] = useState<SwitchDevice | null>();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [message, setMessage] = useState('');
  const [selectedPort, setSelectedPort] = useState<SwitchPort | null>(null);
  const [switchVlans, setSwitchVlans] = useState<SwitchVlanOption[]>([]);
  const [portForm, setPortForm] = useState({ description: '', vlan: '', enabled: true });
  const [savingPort, setSavingPort] = useState(false);
  const role = useAppStore((state) => state.role);
  const canOperate = role !== 'read_only';

  const refresh = async () => {
    const [switchRow, eventRows, vlanRows] = await Promise.all([
      api.getSwitchById(id),
      api.getEventLogsByTarget(id),
      api.getSwitchVlans(id).catch(() => []),
    ]);
    setDevice(switchRow);
    setEvents(eventRows);
    setSwitchVlans(vlanRows);
  };

  useEffect(() => {
    void refresh();
  }, [id]);

  const poeUsedPercent = useMemo(() => {
    if (!device) return 0;
    return (device.poeUsageWatts / Math.max(device.poeBudgetWatts, 1)) * 100;
  }, [device]);

  if (device === undefined) return <LoadingState label="Loading switch detail..." />;
  if (device === null) return <ErrorState title="Switch not found" description="The requested device ID does not exist in the live switch inventory." />;

  const runAction = async (action: string, payload?: Record<string, string | boolean>) => {
    const result = await api.runSwitchAction(device.id, action, payload);
    setMessage(result.message);
    await refresh();
  };

  const openPortEditor = (port: SwitchPort) => {
    const normalizedVlan = port.vlan?.trim();
    if (normalizedVlan && !switchVlans.some((item) => item.name === normalizedVlan)) {
      setSwitchVlans((current) =>
        [{ name: normalizedVlan, vlanId: null, interfaceName: null }, ...current].filter(
          (item, index, items) => items.findIndex((candidate) => candidate.name === item.name) === index,
        ),
      );
    }
    setSelectedPort(port);
    setPortForm({
      description: port.description,
      vlan: port.vlan,
      enabled: port.status !== 'disabled',
    });
  };

  const handleSavePort = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPort) return;

    setSavingPort(true);
    try {
      const result = await api.saveSwitchPortOverride(device.id, selectedPort.portNumber, portForm);
      setMessage(result.message);
      setSelectedPort(null);
      await refresh();
    } finally {
      setSavingPort(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Switch Detail" title={device.hostname} description={`${device.model}${device.managementIp ? ` at ${device.managementIp}` : ''}. Inventory and port state come from the FortiGate switch controller API, and operator actions now flow through the backend action log with role checks and audit history.`} actions={<><ActionButton onClick={() => runAction('reboot')} disabled={!canOperate}><RotateCw className="mr-2 h-4 w-4" />Reboot</ActionButton><ActionButton onClick={() => runAction('blink-led')} disabled={!canOperate}><Lightbulb className="mr-2 h-4 w-4" />Blink LED</ActionButton><ActionButton onClick={() => runAction('sync-config')} disabled={!canOperate}><Save className="mr-2 h-4 w-4" />Sync Config</ActionButton></>} />
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
      <Panel title="Port Map" subtitle="Click a port for a quick edit of description, VLAN, or enabled state.">
        <PortMap ports={device.ports} onPortSelect={canOperate ? openPortEditor : undefined} />
      </Panel>
      <Panel title="Port Activity Graph" subtitle="RX and TX byte totals for every port, all normalized to the same switch-wide scale.">
        <PortBandwidthChart ports={device.ports} />
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
                <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>{port.vlan}</span><span>{formatPoe(port.poeWatts)}{port.poeState ? ` • ${port.poeState}` : ' PoE'}</span></div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>RX {formatBytes(port.stats?.rxBytes ?? 0)}</span>
                  <span>TX {formatBytes(port.stats?.txBytes ?? 0)}</span>
                </div>
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
      <SideDrawer
        open={Boolean(selectedPort)}
        title={selectedPort ? `Edit ${formatPortLabel(selectedPort.portNumber)}` : ''}
        subtitle="Description, VLAN, and enabled state are persisted immediately in EdgeOps and reflected on this switch detail view."
        onClose={() => setSelectedPort(null)}
      >
        {selectedPort ? (
          <form className="space-y-4" onSubmit={handleSavePort}>
            <Field label="Description">
              <input
                className={inputClassName}
                onChange={(event) => setPortForm((current) => ({ ...current, description: event.target.value }))}
                value={portForm.description}
              />
            </Field>
            <Field label="VLAN">
              <select
                className={inputClassName}
                onChange={(event) => setPortForm((current) => ({ ...current, vlan: event.target.value }))}
                value={portForm.vlan}
              >
                {switchVlans.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.vlanId ? `VLAN ${option.vlanId} - ${option.name}` : option.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-soft px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">Enabled</p>
                <p className="mt-1 text-sm text-muted">Disable the port visually in EdgeOps until a direct controller mutation path is finalized.</p>
              </div>
              <input
                checked={portForm.enabled}
                className="h-5 w-5 rounded border-border bg-soft text-accent focus:ring-accent"
                onChange={(event) => setPortForm((current) => ({ ...current, enabled: event.target.checked }))}
                type="checkbox"
              />
            </label>
            <div className="rounded-2xl bg-soft px-4 py-3 text-sm text-muted">
              VLAN options are loaded from the FortiGate site inventory and VLAN changes are pushed back through the managed-switch API. Per-port description and enabled-state writes are still stored locally in EdgeOps until those controller mutation paths are finalized.
            </div>
            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70" disabled={savingPort} type="submit">
              <Save className="h-4 w-4" />
              {savingPort ? 'Saving...' : 'Save Port'}
            </button>
          </form>
        ) : null}
      </SideDrawer>
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
const formatPoe = (value: number) => `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)}W`;

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
    {children}
  </label>
);

const inputClassName =
  'focus-ring w-full rounded-2xl border border-border bg-soft px-4 py-3 text-sm text-text placeholder:text-muted';
