const summarizeTraffic = (ports) =>
  ports.reduce((sum, port) => sum + (port.stats?.rxBytes ?? 0) + (port.stats?.txBytes ?? 0), 0);

const formatLatencyLabel = (summary) => {
  if (typeof summary?.latencyAvgMs === 'number') {
    return `${summary.latencyAvgMs.toFixed(1)} ms`;
  }
  if (summary?.latencyError) {
    return 'Ping unavailable';
  }
  return 'Latency unavailable';
};

const mapWanEdgeStatus = (summary) => {
  if (!summary) return 'warning';
  if (summary.wanStatus === 'offline') return 'critical';
  if (summary.wanStatus === 'degraded') return 'warning';
  return 'healthy';
};

const buildNode = ({ id, type, label, status, siteId, meta = {}, x, y }) => ({
  id,
  type,
  label,
  status,
  siteId,
  meta,
  x,
  y,
});

export const createTopologyService = ({ siteStore, fortiGateClient }) => ({
  async getTopology({ siteId } = {}) {
    const sites = siteId ? [await siteStore.getSiteById(siteId)].filter(Boolean) : await siteStore.listSites();
    const isMultiSite = sites.length > 1;
    const columnWidth = 300;
    const rowHeight = 170;
    const minSiteBlockHeight = 320;
    const siteSnapshots = await Promise.all(
      sites.map(async (site) => {
        const [summary, switches, aps] = await Promise.all([
          fortiGateClient.summarizeSite(site).catch(() => null),
          fortiGateClient.listManagedSwitchesForSite(site).catch(() => []),
          fortiGateClient.listManagedAccessPointsForSite(site).catch(() => []),
        ]);

        return { site, summary, switches, aps };
      }),
    );

    const siteResults = [];
    let nextBaseY = 60;

    for (const snapshot of siteSnapshots) {
      const { site, summary, switches, aps } = snapshot;
      const baseY = nextBaseY;
      const siteX = isMultiSite ? 320 : 320;
      const switchX = siteX + columnWidth;
      const apX = switchX + columnWidth;
      const clientX = apX + columnWidth;

      const nodes = [];
      const edges = [];
      const summaryNode = buildNode({
          id: site.id,
          type: 'site',
          label: site.name,
          status: summary?.status ?? 'warning',
          siteId: site.id,
          x: siteX,
          y: baseY,
          meta: {
            fortigate: summary?.fortigateName || site.fortigate_name || site.name,
            latency: summary?.latencyAvgMs ?? null,
            clients: summary?.clientCount ?? 0,
          },
        });

        nodes.push(summaryNode);

        if (!isMultiSite) {
          const wanNode = buildNode({
            id: `${site.id}--wan`,
            type: 'wan',
            label: 'WAN Edge',
            status: mapWanEdgeStatus(summary),
            siteId: site.id,
            x: 40,
            y: baseY,
            meta: {
              latency: summary?.latencyAvgMs ?? null,
              packetLoss: summary?.latencyPacketLoss ?? null,
              wan: summary?.wanStatus ?? 'unknown',
            },
          });
          nodes.push(wanNode);
          edges.push({
            id: `${wanNode.id}-${summaryNode.id}`,
            from: wanNode.id,
            to: summaryNode.id,
            status: mapWanEdgeStatus(summary),
            label: formatLatencyLabel(summary),
          });
        }

        const switchNodes = switches.map((device, index) => {
          const node = buildNode({
            id: device.id,
            type: 'switch',
            label: device.hostname,
            status: device.status,
            siteId: device.siteId,
            x: switchX,
            y: baseY - 10 + index * rowHeight,
            meta: {
              model: device.model,
              ports: `${device.portsUsed}/${device.totalPorts}`,
              traffic: summarizeTraffic(device.ports),
              uplink: device.uplinkStatus,
            },
          });

          edges.push({
            id: `${site.id}-${device.id}`,
            from: summaryNode.id,
            to: device.id,
            status:
              device.status === 'offline'
                ? 'offline'
                : device.uplinkStatus === 'down'
                  ? 'critical'
                  : device.uplinkStatus === 'degraded'
                    ? 'warning'
                    : 'healthy',
            label: device.uplinkStatus === 'up' ? 'FortiLink' : `Uplink ${device.uplinkStatus}`,
          });
          return node;
        });

        nodes.push(...switchNodes);

        const availableSwitchNodes = switchNodes.filter((node) => {
          const switchDevice = switches.find((device) => device.id === node.id);
          return node.status !== 'offline' && switchDevice?.uplinkStatus !== 'down';
        });

        const apNodes = aps.map((device, index) => {
          const fallbackSwitch = availableSwitchNodes[index % Math.max(availableSwitchNodes.length, 1)];
          const parentNode = fallbackSwitch ?? summaryNode;
          const node = buildNode({
            id: device.id,
            type: 'ap',
            label: device.name,
            status: device.status,
            siteId: device.siteId,
            x: apX,
            y: baseY - 10 + index * rowHeight,
            meta: {
              model: device.model,
              clients: device.clients,
              radios: device.radios.length,
              ip: device.ip,
            },
          });

          edges.push({
            id: `${parentNode.id}-${device.id}`,
            from: parentNode.id,
            to: device.id,
            status: parentNode.status === 'offline' ? 'offline' : device.status,
            label: fallbackSwitch ? (device.clients ? `${device.clients} clients` : 'Wireless edge') : 'Wireless estate',
          });
          return node;
        });

        nodes.push(...apNodes);

        const clientGroupY = baseY + (apNodes.length > 1 ? ((apNodes.length - 1) * rowHeight) / 2 : 0);
        const clientAggregateNode = buildNode({
          id: `${site.id}--clients`,
          type: 'client-group',
          label: 'Active Clients',
          status: summary?.clientCount ? 'healthy' : 'warning',
          siteId: site.id,
          x: clientX,
          y: clientGroupY,
          meta: {
            clients: summary?.clientCount ?? 0,
            ssids: aps.reduce((sum, ap) => sum + ap.ssids.length, 0),
          },
        });

        nodes.push(clientAggregateNode);

        if (apNodes.length) {
          apNodes.forEach((node) => {
            edges.push({
              id: `${node.id}-${clientAggregateNode.id}`,
              from: node.id,
              to: clientAggregateNode.id,
              status: node.status,
              label: 'Associated clients',
            });
          });
        } else {
          edges.push({
            id: `${summaryNode.id}-${clientAggregateNode.id}`,
            from: summaryNode.id,
            to: clientAggregateNode.id,
            status: summary?.status ?? 'warning',
            label: 'Client estate',
          });
        }

      siteResults.push({
        site: summary,
        nodes,
        edges,
      });

      const tallestColumnCount = Math.max(1, switches.length, aps.length);
      nextBaseY += Math.max(minSiteBlockHeight, (tallestColumnCount - 1) * rowHeight + 230);
    }

    const nodes = siteResults.flatMap((entry) => entry.nodes);
    const edges = siteResults.flatMap((entry) => entry.edges);

    if (isMultiSite) {
      const reachable = siteResults.filter((entry) => entry.site?.apiReachable).length;
      const latencyValues = siteResults
        .map((entry) => entry.site?.latencyAvgMs)
        .filter((value) => typeof value === 'number');
      const averageLatency =
        latencyValues.reduce((sum, value) => sum + value, 0) / Math.max(1, latencyValues.length);
      const coreNode = buildNode({
        id: 'network-core',
        type: 'wan',
        label: 'Network Web',
        status: reachable ? 'healthy' : 'warning',
        siteId: 'global',
        x: 40,
        y: 60 + Math.max(0, nextBaseY - 60 - minSiteBlockHeight) / 2,
        meta: {
          sites: siteResults.length,
          latency: Number.isFinite(averageLatency) ? averageLatency : null,
          reachable,
        },
      });
      nodes.unshift(coreNode);

      siteResults.forEach((entry) => {
        const siteNode = entry.nodes.find((node) => node.type === 'site');
        if (!siteNode) return;
        edges.unshift({
          id: `${coreNode.id}-${siteNode.id}`,
          from: coreNode.id,
          to: siteNode.id,
          status: mapWanEdgeStatus(entry.site),
          label: formatLatencyLabel(entry.site),
        });
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
      summary: {
        siteCount: siteResults.length,
        switchCount: nodes.filter((node) => node.type === 'switch').length,
        apCount: nodes.filter((node) => node.type === 'ap').length,
        clientGroupCount: nodes.filter((node) => node.type === 'client-group').length,
      },
    };
  },
});
