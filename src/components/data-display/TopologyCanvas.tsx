import { Globe2, Network, RadioTower, Server, Users } from 'lucide-react';
import { Panel } from '@/components/common/Panel';
import { cn, extendedStatusTone, formatNumber } from '@/lib/utils';
import type { TopologyGraph, TopologyNode } from '@/types/models';

const nodeSizes = {
  wan: { width: 220, height: 104 },
  site: { width: 220, height: 104 },
  switch: { width: 220, height: 120 },
  ap: { width: 220, height: 148 },
  'client-group': { width: 220, height: 104 },
} as const;

const iconByType = {
  wan: Globe2,
  site: Network,
  switch: Server,
  ap: RadioTower,
  'client-group': Users,
} as const;

export const TopologyCanvas = ({
  topology,
  title = 'Topology Overview',
  subtitle = 'Live site, switch, AP, and client relationships derived from the current FortiGate inventory.',
}: {
  topology: TopologyGraph;
  title?: string;
  subtitle?: string;
}) => {
  const width = Math.max(980, ...topology.nodes.map((node) => node.x + nodeSizes[node.type].width + 80));
  const height = Math.max(320, ...topology.nodes.map((node) => node.y + nodeSizes[node.type].height + 80));
  const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));

  return (
    <Panel title={title} subtitle={subtitle} className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="relative rounded-[28px] border border-border bg-grid bg-[size:26px_26px]" style={{ width, height }}>
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} fill="none">
            {topology.edges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;

              const fromSize = nodeSizes[from.type];
              const toSize = nodeSizes[to.type];
              const x1 = from.x + fromSize.width;
              const y1 = from.y + fromSize.height / 2;
              const x2 = to.x;
              const y2 = to.y + toSize.height / 2;
              const midX = (x1 + x2) / 2;
              const isOffline = edge.status === 'offline';
              const stroke =
                edge.status === 'critical'
                  ? '#ef4444'
                  : edge.status === 'warning'
                    ? '#f59e0b'
                    : edge.status === 'offline'
                      ? '#64748b'
                      : 'var(--color-accent)';

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    stroke={stroke}
                    strokeDasharray={isOffline ? '8 10' : undefined}
                    strokeWidth={isOffline ? '2' : '3'}
                    strokeLinecap="round"
                    opacity={isOffline ? '0.45' : '0.88'}
                  />
                  <text x={midX} y={(y1 + y2) / 2 - 8} textAnchor="middle" fill="var(--color-muted)" fontSize="11" opacity={isOffline ? '0.7' : '1'}>
                    {edge.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {topology.nodes.map((node) => (
            <TopologyNodeCard key={node.id} node={node} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        <span>{formatNumber(topology.summary.siteCount)} sites</span>
        <span>{formatNumber(topology.summary.switchCount)} switches</span>
        <span>{formatNumber(topology.summary.apCount)} APs</span>
        <span>{formatNumber(topology.summary.clientGroupCount)} client groups</span>
      </div>
    </Panel>
  );
};

const TopologyNodeCard = ({ node }: { node: TopologyNode }) => {
  const Icon = iconByType[node.type];
  const size = nodeSizes[node.type];
  const metaEntries = Object.entries(node.meta ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <div
      className="absolute rounded-[24px] border border-border bg-canvas/95 p-4 shadow-panel backdrop-blur-sm"
      style={{ left: node.x, top: node.y, width: size.width, minHeight: size.height }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-accent-muted p-2 text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="break-words text-sm font-semibold leading-5 text-text">{node.label}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{node.type.replace('-', ' ')}</p>
          </div>
        </div>
        <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold capitalize', extendedStatusTone[node.status] || extendedStatusTone.warning)}>
          {node.status}
        </span>
      </div>
      <div className="mt-4 space-y-1.5 text-xs text-muted">
        {metaEntries.slice(0, 3).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="capitalize">{key}</span>
            <span className="text-right text-text">{formatMetaValue(key, value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatMetaValue = (key: string, value: string | number | null) => {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  if (key.toLowerCase().includes('latency') && typeof value === 'number') {
    return `${value.toFixed(1)} ms`;
  }
  return String(value);
};
