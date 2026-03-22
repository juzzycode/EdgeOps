import { cn, formatBytes } from '@/lib/utils';
import type { SwitchPort } from '@/types/models';

export const PortBandwidthChart = ({ ports }: { ports: SwitchPort[] }) => {
  const activePorts = ports.filter((port) => port.stats);
  const maxTotal = Math.max(
    1,
    ...activePorts.map((port) => (port.stats?.rxBytes ?? 0) + (port.stats?.txBytes ?? 0)),
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-end gap-2 rounded-3xl bg-soft p-4">
        {ports.map((port) => {
          const rxValue = port.stats?.rxBytes ?? 0;
          const txValue = port.stats?.txBytes ?? 0;
          const totalValue = rxValue + txValue;
          const totalHeight = totalValue > 0 ? Math.max(16, (totalValue / maxTotal) * 112) : 0;
          const rxRatio = totalValue > 0 ? rxValue / totalValue : 0;
          const txRatio = totalValue > 0 ? txValue / totalValue : 0;
          const rxHeight = totalHeight > 0 ? Math.max(4, totalHeight * rxRatio) : 0;
          const txHeight = totalHeight > 0 ? Math.max(4, totalHeight * txRatio) : 0;
          const inactive = totalValue === 0;
          const isDisabled = port.status === 'disabled' || port.status === 'down';

          return (
            <div key={port.id} className="group flex w-10 shrink-0 flex-col items-center gap-2">
              <div className="relative flex h-36 items-end">
                <div className="flex h-32 w-8 items-end justify-center gap-1 rounded-2xl border border-border/70 bg-canvas/60 px-1.5 pb-1">
                  {!inactive ? (
                    <>
                      <div
                        className={cn(
                          'w-2.5 rounded-t-md transition-all',
                          isDisabled ? 'bg-slate-500/55' : 'bg-sky-400/85',
                        )}
                        style={{ height: `${rxHeight}px` }}
                        title={`RX ${formatBytes(rxValue)}`}
                      />
                      <div
                        className={cn(
                          'w-2.5 rounded-t-md transition-all',
                          isDisabled ? 'bg-slate-400/45' : 'bg-rose-500',
                        )}
                        style={{ height: `${txHeight}px` }}
                        title={`TX ${formatBytes(txValue)}`}
                      />
                    </>
                  ) : (
                    <div className="h-px w-full rounded-full bg-slate-500/40" />
                  )}
                </div>

                <div className="pointer-events-none absolute left-1/2 top-0 z-30 hidden w-48 -translate-x-1/2 -translate-y-[calc(100%+0.15rem)] group-hover:block">
                  <div className="rounded-2xl border border-border bg-canvas px-3 py-2 text-xs text-muted shadow-xl">
                    <p className="font-semibold text-text">{formatPortLabel(port.portNumber)}</p>
                    <p className="mt-1">RX: {formatBytes(rxValue)}</p>
                    <p>TX: {formatBytes(txValue)}</p>
                    <p>Total: {formatBytes(totalValue)}</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text">{compactPortLabel(port.portNumber)}</p>
                <p className="mt-1 text-[10px] text-muted">{formatBytes(totalValue)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-sky-400/80" />
          RX bytes
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-500" />
          TX bytes
        </div>
        <span>Each port is scaled against the busiest total-traffic port on this switch.</span>
      </div>
    </div>
  );
};

const formatPortLabel = (value: string) => (value.toLowerCase().startsWith('port') ? value : `Port ${value}`);
const compactPortLabel = (value: string) => value.replace(/^port/i, 'p');
