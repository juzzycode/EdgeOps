import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SitePingSeries } from '@/types/models';

const palette = ['var(--color-accent)', '#38bdf8', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7'];

const buildChartRows = (series: SitePingSeries[]) => {
  const timestampSet = new Set<string>();
  const latencyBySite = new Map<string, Map<string, number | null>>();

  for (const site of series) {
    const siteMap = new Map<string, number | null>();
    for (const point of site.points) {
      timestampSet.add(point.observedAt);
      siteMap.set(point.observedAt, point.isDown ? null : point.latencyAvgMs);
    }
    latencyBySite.set(site.siteId, siteMap);
  }

  return [...timestampSet]
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())
    .map((observedAt) => ({
      observedAt,
      ...Object.fromEntries(series.map((site) => [site.siteId, latencyBySite.get(site.siteId)?.get(observedAt) ?? null])),
    }));
};

export const SitePingHistoryChart = ({ series }: { series: SitePingSeries[] }) => {
  const rows = buildChartRows(series);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis
            dataKey="observedAt"
            tickFormatter={(value) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => `${value} ms`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16 }}
            formatter={(value) => (value === null || value === undefined ? 'Down / no reply' : `${Number(value).toFixed(1)} ms`)}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
          />
          <Legend />
          {series.map((site, index) => (
            <Line
              key={site.siteId}
              type="monotone"
              dataKey={site.siteId}
              name={site.siteName}
              stroke={palette[index % palette.length]}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              strokeDasharray={site.wanStatus === 'offline' ? '5 5' : undefined}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
