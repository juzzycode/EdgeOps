const severityPriority = {
  critical: 0,
  warning: 1,
  info: 2,
};

const toTimestamp = (...values) => {
  for (const value of values) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

const createContext = (entries) =>
  entries
    .filter((entry) => entry.value !== undefined && entry.value !== null && String(entry.value).trim() !== '')
    .map((entry) => ({
      label: entry.label,
      value: String(entry.value),
    }));

const formatPacketLoss = (value) => `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}% packet loss`;

const summarizePortWarnings = (ports) => {
  if (!ports.length) return 'Ports are reporting errors.';

  const topPorts = ports.slice(0, 3).map((port) => port.portNumber);
  const suffix = ports.length > 3 ? ` and ${ports.length - 3} more` : '';
  return `${ports.length} ports need attention: ${topPorts.join(', ')}${suffix}.`;
};

const createAlert = ({
  id,
  severity,
  type,
  title,
  description,
  site,
  deviceId,
  deviceType,
  deviceName,
  timestamp,
  source = 'live',
  context = [],
}) => ({
  id,
  severity,
  type,
  title,
  description,
  siteId: site.id,
  siteName: site.name,
  deviceId,
  deviceType,
  deviceName,
  timestamp,
  acknowledged: false,
  source,
  context,
});

const summaryIsDown = (summary) =>
  summary.status === 'offline' ||
  summary.wanStatus === 'offline' ||
  summary.apiReachable === false ||
  summary.latencyPacketLoss === 100;

const buildSiteAlerts = async ({ site, fortiGateClient, inventoryCacheService }) => {
  const summary = await fortiGateClient.summarizeSite(site);
  const loadSwitches = () =>
    inventoryCacheService
      ? inventoryCacheService.listCachedOrRefresh(site, 'switches', () => fortiGateClient.listManagedSwitchesForSite(site), {
          logLabel: 'alerts',
        })
      : fortiGateClient.listManagedSwitchesForSite(site);
  const loadAccessPoints = () =>
    inventoryCacheService
      ? inventoryCacheService.listCachedOrRefresh(site, 'accessPoints', () => fortiGateClient.listManagedAccessPointsForSite(site), {
          logLabel: 'alerts',
        })
      : fortiGateClient.listManagedAccessPointsForSite(site);
  const [switchesResult, apsResult] = await Promise.allSettled([
    loadSwitches(),
    loadAccessPoints(),
  ]);

  const switches = switchesResult.status === 'fulfilled' ? switchesResult.value : [];
  const accessPoints = apsResult.status === 'fulfilled' ? apsResult.value : [];
  const alerts = [];
  const summaryTimestamp = toTimestamp(summary.latencyCheckedAt);

  if (!summary.apiReachable) {
    alerts.push(
      createAlert({
        id: `${site.id}-site-api-unreachable`,
        severity: summary.status === 'offline' ? 'critical' : 'warning',
        type: 'device offline',
        title: `${summary.name} FortiGate unreachable`,
        description: summary.lastSyncError || 'The FortiGate API could not be reached during the latest poll.',
        site: summary,
        deviceId: site.id,
        deviceType: 'site',
        deviceName: summary.fortigateName || summary.name,
        timestamp: summaryTimestamp,
        context: createContext([
          { label: 'FortiGate IP', value: summary.fortigateIp },
          { label: 'Latency', value: summary.latencyAvgMs !== null && summary.latencyAvgMs !== undefined ? `${summary.latencyAvgMs} ms` : null },
          { label: 'Packet Loss', value: summary.latencyPacketLoss !== null && summary.latencyPacketLoss !== undefined ? formatPacketLoss(summary.latencyPacketLoss) : null },
          { label: 'Sync Error', value: summary.lastSyncError },
        ]),
      }),
    );
  } else if (summary.latencyPacketLoss && summary.latencyPacketLoss > 0) {
    alerts.push(
      createAlert({
        id: `${site.id}-site-packet-loss`,
        severity: summary.latencyPacketLoss >= 20 ? 'critical' : 'warning',
        type: 'site connectivity degraded',
        title: `${summary.name} WAN latency degraded`,
        description: `The latest ping probe reported ${formatPacketLoss(summary.latencyPacketLoss)} to the FortiGate management address.`,
        site: summary,
        deviceId: site.id,
        deviceType: 'site',
        deviceName: summary.fortigateName || summary.name,
        timestamp: summaryTimestamp,
        context: createContext([
          { label: 'Average Latency', value: summary.latencyAvgMs !== null && summary.latencyAvgMs !== undefined ? `${summary.latencyAvgMs} ms` : null },
          { label: 'Min Latency', value: summary.latencyMinMs !== null && summary.latencyMinMs !== undefined ? `${summary.latencyMinMs} ms` : null },
          { label: 'Max Latency', value: summary.latencyMaxMs !== null && summary.latencyMaxMs !== undefined ? `${summary.latencyMaxMs} ms` : null },
        ]),
      }),
    );
  }

  if (summary.apiReachable && (!summary.fortigateVersion || !summary.fortigateSerial)) {
    alerts.push(
      createAlert({
        id: `${site.id}-site-identity-incomplete`,
        severity: 'info',
        type: 'inventory incomplete',
        title: `${summary.name} identity data incomplete`,
        description: 'The FortiGate API authenticated successfully, but firmware version or serial data was not returned.',
        site: summary,
        deviceId: site.id,
        deviceType: 'site',
        deviceName: summary.fortigateName || summary.name,
        timestamp: summaryTimestamp,
        context: createContext([
          { label: 'Version', value: summary.fortigateVersion },
          { label: 'Serial', value: summary.fortigateSerial },
        ]),
      }),
    );
  }

  for (const device of switches) {
    const deviceTimestamp = toTimestamp(device.lastSeen, summary.latencyCheckedAt);

    if (device.status === 'offline') {
      alerts.push(
        createAlert({
          id: `${device.id}-switch-offline`,
          severity: 'critical',
          type: 'device offline',
          title: `${device.hostname} is offline`,
          description: 'The managed switch is not currently carrying traffic or checking in through FortiLink.',
          site: summary,
          deviceId: device.id,
          deviceType: 'switch',
          deviceName: device.hostname,
          timestamp: deviceTimestamp,
          context: createContext([
            { label: 'Model', value: device.model },
            { label: 'Serial', value: device.serial },
            { label: 'Uplink', value: device.uplinkStatus },
          ]),
        }),
      );
    }

    if (device.uplinkStatus === 'degraded' || device.uplinkStatus === 'down') {
      alerts.push(
        createAlert({
          id: `${device.id}-uplink-${device.uplinkStatus}`,
          severity: device.uplinkStatus === 'down' ? 'critical' : 'warning',
          type: 'uplink degraded',
          title: `${device.hostname} uplink ${device.uplinkStatus}`,
          description: 'The switch uplink was inferred as degraded or unavailable based on FortiLink and traffic signals.',
          site: summary,
          deviceId: device.id,
          deviceType: 'switch',
          deviceName: device.hostname,
          timestamp: deviceTimestamp,
          context: createContext([
            { label: 'Ports Used', value: `${device.portsUsed}/${device.totalPorts}` },
            { label: 'Firmware', value: device.firmware },
          ]),
        }),
      );
    }
  }

  const detailedSwitchResults = summaryIsDown(summary)
    ? []
    : inventoryCacheService
      ? switches
          .filter((device) => device.status !== 'offline')
          .map((device) => ({ status: 'fulfilled', value: device }))
      : await Promise.allSettled(
          switches
            .filter((device) => device.status !== 'offline')
            .map((device) => fortiGateClient.getManagedSwitchDetailForSite(site, device.id)),
        );

  for (const result of detailedSwitchResults) {
    if (result.status !== 'fulfilled' || !result.value) continue;

    const device = result.value;
    const warningPorts = device.ports.filter((port) => port.status === 'warning');
    if (!warningPorts.length) continue;

    alerts.push(
      createAlert({
        id: `${device.id}-port-errors`,
        severity: 'warning',
        type: 'port errors',
        title: `${device.hostname} has port errors`,
        description: summarizePortWarnings(warningPorts),
        site: summary,
        deviceId: device.id,
        deviceType: 'switch',
        deviceName: device.hostname,
        timestamp: toTimestamp(device.lastSeen, summary.latencyCheckedAt),
        context: createContext([
          { label: 'Affected Ports', value: warningPorts.map((port) => port.portNumber).join(', ') },
          { label: 'Uplink', value: device.uplinkStatus },
        ]),
      }),
    );
  }

  for (const device of accessPoints) {
    const deviceTimestamp = toTimestamp(device.lastSeen, summary.latencyCheckedAt);

    if (device.status === 'offline') {
      alerts.push(
        createAlert({
          id: `${device.id}-ap-offline`,
          severity: 'critical',
          type: 'device offline',
          title: `${device.name} is offline`,
          description: 'The access point is not reporting any active radios or telemetry through the FortiGate controller.',
          site: summary,
          deviceId: device.id,
          deviceType: 'ap',
          deviceName: device.name,
          timestamp: deviceTimestamp,
          context: createContext([
            { label: 'Model', value: device.model },
            { label: 'Serial', value: device.serial },
            { label: 'IP', value: device.ip },
          ]),
        }),
      );
    }

    const hotRadios = device.radios.filter((radio) => radio.utilization >= 80);
    if (hotRadios.length) {
      alerts.push(
        createAlert({
          id: `${device.id}-high-channel-utilization`,
          severity: 'warning',
          type: 'AP high channel utilization',
          title: `${device.name} channel utilization elevated`,
          description: `One or more radios are under heavy client load: ${hotRadios.map((radio) => `${radio.band} (${radio.utilization}%)`).join(', ')}.`,
          site: summary,
          deviceId: device.id,
          deviceType: 'ap',
          deviceName: device.name,
          timestamp: deviceTimestamp,
          context: createContext([
            { label: 'Clients', value: device.clients },
            { label: 'SSIDs', value: device.ssids.map((ssid) => ssid.name).join(', ') },
          ]),
        }),
      );
    }

    const poorClients = (device.clientDevices ?? []).filter(
      (client) => client.health === 'poor' || (client.retryPercent ?? 0) >= 30 || (client.snr ?? 99) <= 15,
    );

    if (poorClients.length >= 2) {
      alerts.push(
        createAlert({
          id: `${device.id}-client-health`,
          severity: 'warning',
          type: 'wireless client health',
          title: `${device.name} has struggling wireless clients`,
          description: `${poorClients.length} associated clients are showing poor health, elevated retries, or low SNR.`,
          site: summary,
          deviceId: device.id,
          deviceType: 'ap',
          deviceName: device.name,
          timestamp: deviceTimestamp,
          context: createContext([
            { label: 'Affected Clients', value: poorClients.slice(0, 4).map((client) => client.name).join(', ') },
            { label: 'Management IP', value: device.ip },
          ]),
        }),
      );
    }
  }

  return alerts;
};

export const createAlertService = ({ siteStore, fortiGateClient, inventoryCacheService }) => ({
  async listAlerts({ siteId, severity, hours } = {}) {
    const sites = siteId ? [await siteStore.getSiteById(siteId)].filter(Boolean) : await siteStore.listSites();
    const results = await Promise.allSettled(
      sites.map((site) =>
        buildSiteAlerts({
          site,
          fortiGateClient,
          inventoryCacheService,
        }),
      ),
    );

    let alerts = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    if (severity && severity !== 'all') {
      alerts = alerts.filter((alert) => alert.severity === severity);
    }

    const numericHours = Number(hours);
    if (Number.isFinite(numericHours) && numericHours > 0) {
      const cutoff = Date.now() - numericHours * 60 * 60 * 1000;
      alerts = alerts.filter((alert) => new Date(alert.timestamp).getTime() >= cutoff);
    }

    return alerts.sort((left, right) => {
      const severityDelta = severityPriority[left.severity] - severityPriority[right.severity];
      if (severityDelta !== 0) return severityDelta;
      return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    });
  },
});
