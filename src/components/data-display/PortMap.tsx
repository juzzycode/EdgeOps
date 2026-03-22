import { cn } from '@/lib/utils';
import type { SwitchPort } from '@/types/models';

const tone: Record<SwitchPort['status'], string> = {
  up: 'bg-success/20 text-success border-success/20',
  down: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  disabled: 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  warning: 'bg-warning/20 text-warning border-warning/20',
};

export const PortMap = ({ ports }: { ports: SwitchPort[] }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    {ports.map((port) => (
      <div key={port.id} className={cn('group relative rounded-2xl border p-3', tone[port.status])}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{formatPortLabel(port.portNumber)}</span>
          <span className="text-[11px] uppercase">{port.speed}</span>
        </div>
        <p className="mt-3 truncate text-xs">{port.description}</p>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span>{port.vlan}</span>
          <span>{port.poeWatts}W</span>
        </div>
        {port.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {port.tags.map((tag) => (
              <span key={tag} className={cn('rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', tag === 'Uplink' ? 'bg-accent/15 text-accent' : '')}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {port.stats ? (
          <div className="pointer-events-none absolute bottom-full left-1/2 z-[80] hidden w-72 -translate-x-1/2 pb-3 group-hover:block">
            <div className="rounded-3xl border border-slate-900/10 bg-canvas p-4 text-left shadow-2xl shadow-black/35 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-text">{formatPortLabel(port.portNumber)}</p>
                {port.isUplink ? <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">Uplink</span> : null}
              </div>
              <p className="mt-1 text-xs text-muted">{port.description || 'No description set'}</p>
              <div className="mt-4 grid gap-2 text-xs text-muted">
                <HoverRow label="RX Bytes" value={formatBytes(port.stats.rxBytes)} />
                <HoverRow label="TX Bytes" value={formatBytes(port.stats.txBytes)} />
                <HoverRow label="RX Packets" value={formatCount(port.stats.rxPackets)} />
                <HoverRow label="TX Packets" value={formatCount(port.stats.txPackets)} />
                <HoverRow label="RX Errors" value={formatCount(port.stats.rxErrors)} />
                <HoverRow label="CRC Align" value={formatCount(port.stats.crcAlignments)} />
                <HoverRow label="L3 Packets" value={formatCount(port.stats.l3Packets)} />
                <HoverRow label="Drops" value={`${formatCount(port.stats.rxDrops)} RX / ${formatCount(port.stats.txDrops)} TX`} />
              </div>
              {port.uplinkReasons?.length ? (
                <div className="mt-4 rounded-2xl bg-soft px-3 py-2.5 text-[11px] text-muted">
                  <p className="font-semibold uppercase tracking-wide text-text">Uplink Heuristics</p>
                  <div className="mt-2 space-y-1">
                    {port.uplinkReasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    ))}
  </div>
);

const formatPortLabel = (value: string) => (value.toLowerCase().startsWith('port') ? value : `Port ${value}`);

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let size = value;
  let unitIndex = -1;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 ? 0 : 2)} ${units[unitIndex]}`;
};

const formatCount = (value: number) => value.toLocaleString();

const HoverRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span>{label}</span>
    <span className="text-right font-medium text-text">{value}</span>
  </div>
);
