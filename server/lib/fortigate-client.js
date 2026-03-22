import { execFile } from 'node:child_process';
import https from 'node:https';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const pingCacheTtlMs = 60_000;
const switchStatsCacheTtlMs = 60_000;
const switchStatsCache = new Map();

const requestJson = (url, apiKey) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`FortiGate request failed with HTTP ${response.statusCode}`));
            return;
          }

          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('error', reject);
    request.end();
  });

const parseMaybeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const extractStatusField = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
};

const extractFromStatusPayload = (payload, keys) =>
  extractStatusField(payload?.results ?? {}, keys) || extractStatusField(payload, keys);

const parseUnixPing = (stdout) => {
  const packetLossMatch = stdout.match(/(\d+(?:\.\d+)?)%\s+packet loss/i);
  const roundTripMatch = stdout.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/[\d.]+/);
  if (!packetLossMatch) return null;

  return {
    minMs: parseMaybeNumber(roundTripMatch?.[1]),
    avgMs: parseMaybeNumber(roundTripMatch?.[2]),
    maxMs: parseMaybeNumber(roundTripMatch?.[3]),
    packetLoss: parseMaybeNumber(packetLossMatch[1]),
  };
};

const parseWindowsPing = (stdout) => {
  const packetLossMatch = stdout.match(/\((\d+)%\s+loss\)/i);
  const minMatch = stdout.match(/Minimum = (\d+)ms/i);
  const maxMatch = stdout.match(/Maximum = (\d+)ms/i);
  const avgMatch = stdout.match(/Average = (\d+)ms/i);
  if (!packetLossMatch) return null;

  return {
    minMs: parseMaybeNumber(minMatch?.[1]),
    avgMs: parseMaybeNumber(avgMatch?.[1]),
    maxMs: parseMaybeNumber(maxMatch?.[1]),
    packetLoss: parseMaybeNumber(packetLossMatch[1]),
  };
};

const parsePingOutput = (stdout) => parseUnixPing(stdout) ?? parseWindowsPing(stdout);

const inferSwitchModel = (item) => {
  const explicit = extractStatusField(item, ['model', 'model_name', 'model-name', 'platform', 'product']);
  if (explicit) return explicit;

  const serial = extractStatusField(item, ['sn', 'serial', 'switch-id']);
  return serial && serial.length > 6 ? serial.slice(0, -6) : serial || 'FortiSwitch';
};

const parseWatts = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const match = value.match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
};

const hasAnyTraffic = (stats) =>
  Boolean(
    stats &&
      (stats.rxBytes > 0 ||
        stats.txBytes > 0 ||
        stats.rxPackets > 0 ||
        stats.txPackets > 0 ||
        stats.l3Packets > 0 ||
        stats.rxErrors > 0 ||
        stats.txErrors > 0 ||
        stats.rxDrops > 0 ||
        stats.txDrops > 0),
  );

const mapPortStatus = (port, stats) => {
  if (port['poe-status'] === 'disable') return 'disabled';
  if (stats) {
    if (!hasAnyTraffic(stats)) return 'down';
    if ((stats.rxErrors > 0 || stats.txErrors > 0 || stats.crcAlignments > 0) && port.status === 'up') return 'warning';
  }
  if (port.status === 'up') return 'up';
  return 'down';
};

const hasNeighbor = (port) =>
  Boolean(
    extractStatusField(port, ['isl-peer-device-name', 'fgt-peer-device-name', 'isl-peer-device-sn', 'fgt-peer-port-name']),
  );

const inferTrunk = (port) =>
  hasNeighbor(port) ||
  port['fortilink-port'] === 1 ||
  (Array.isArray(port['allowed-vlans']) && port['allowed-vlans'].length > 1) ||
  port.bundle === 'enable';

const getPortTags = (port) => {
  const tags = [];
  if (inferTrunk(port)) tags.push('Trunk');
  if (port['poe-capable'] === 1) tags.push('PoE');
  if (port['fortilink-port'] === 1) tags.push('FortiLink');
  return tags;
};

const mapPortStats = (stats) => ({
  rxBytes: Number(stats?.['rx-bytes'] ?? 0),
  txBytes: Number(stats?.['tx-bytes'] ?? 0),
  rxPackets: Number(stats?.['rx-packets'] ?? 0),
  txPackets: Number(stats?.['tx-packets'] ?? 0),
  rxErrors: Number(stats?.['rx-errors'] ?? 0),
  txErrors: Number(stats?.['tx-errors'] ?? 0),
  rxDrops: Number(stats?.['rx-drops'] ?? 0),
  txDrops: Number(stats?.['tx-drops'] ?? 0),
  crcAlignments: Number(stats?.['crc-alignments'] ?? 0),
  l3Packets: Number(stats?.l3packets ?? 0),
});

const shouldUseCachedSwitchStats = (entry) =>
  Boolean(entry) && Date.now() - entry.fetchedAt < switchStatsCacheTtlMs;

const getCachedSwitchStats = async (site, serial, apiKey) => {
  const cacheKey = `${site.id}:${serial}`;
  const cached = switchStatsCache.get(cacheKey);
  if (shouldUseCachedSwitchStats(cached)) {
    return cached.payload;
  }

  const payload = await requestJson(
    `https://${site.fortigate_ip}/api/v2/monitor/switch-controller/managed-switch/port-stats?mkey=${encodeURIComponent(serial)}`,
    apiKey,
  );

  switchStatsCache.set(cacheKey, {
    fetchedAt: Date.now(),
    payload,
  });

  return payload;
};

const applyUplinkHeuristics = (ports) => {
  const activePorts = ports.filter((port) => port.status === 'up' && port.stats);
  if (!activePorts.length) return ports;

  const maxRxBytes = Math.max(...activePorts.map((port) => port.stats.rxBytes), 0);
  const maxRxPackets = Math.max(...activePorts.map((port) => port.stats.rxPackets), 0);

  const scored = activePorts.map((port) => {
    const reasons = [];
    let score = 0;

    if (port.stats.l3Packets > 0) {
      score += 120;
      reasons.push(`L3 traffic observed (${port.stats.l3Packets.toLocaleString()} packets).`);
    }

    if (port.stats.rxBytes > port.stats.txBytes * 2 && port.stats.rxBytes > 0) {
      score += 35;
      reasons.push('RX bytes significantly exceed TX bytes.');
    }

    if (port.stats.rxBytes === maxRxBytes && maxRxBytes > 0) {
      score += 30;
      reasons.push('Highest RX byte count among active ports.');
    }

    if (port.stats.rxPackets === maxRxPackets && maxRxPackets > 0) {
      score += 25;
      reasons.push('Highest RX packet count among active ports.');
    }

    if ((port.stats.crcAlignments > 0 || port.stats.rxErrors > 0) && port.stats.rxPackets > 0) {
      score += 5;
      reasons.push('Low but non-zero CRC or RX errors on a busy port.');
    }

    if (port.isTrunk) {
      score += 10;
      reasons.push('Configured like a trunk or FortiLink-facing port.');
    }

    if (port.neighbor?.toLowerCase().includes('fgt')) {
      score += 20;
      reasons.push(`Neighbor hints at FortiGate uplink (${port.neighbor}).`);
    }

    return { id: port.id, score, reasons };
  });

  const winner = scored.sort((left, right) => right.score - left.score)[0];
  if (!winner || winner.score < 35) {
    return ports;
  }

  return ports.map((port) =>
    port.id === winner.id
      ? {
          ...port,
          isUplink: true,
          tags: [...new Set([...(port.tags ?? []), 'Uplink'])],
          uplinkReasons: winner.reasons,
        }
      : port,
  );
};

const buildSwitchId = (siteId, serial) => `${siteId}--${serial}`;

const mapManagedSwitch = (site, item, statsByPort = {}) => {
  const serial = extractStatusField(item, ['sn', 'serial', 'switch-id']) || 'unknown-switch';
  const rawPorts = Array.isArray(item.ports) ? item.ports : [];
  const poeBudgetWatts = rawPorts.reduce((total, port) => total + parseWatts(port['poe-max-power']), 0);
  const firmware = extractStatusField(item, ['firmware-provision-version', 'staged-image-version', 'os-version']) || 'Managed by FortiGate';
  const ports = applyUplinkHeuristics(
    rawPorts.map((port) => {
      const portName = port['port-name'] || 'unknown';
      const stats = statsByPort[portName] ? mapPortStats(statsByPort[portName]) : undefined;

      return {
        id: `${buildSwitchId(site.id, serial)}-${portName}`,
        portNumber: portName,
        status: mapPortStatus(port, stats),
        speed: port.speed || 'auto',
        poeWatts: 0,
        vlan: port.vlan || '_default',
        description: port.description || portName,
        profileId: port['port-policy'] || port['qos-policy'] || 'default',
        clientCount: 0,
        neighbor:
          extractStatusField(port, ['isl-peer-device-name', 'fgt-peer-device-name', 'isl-peer-device-sn']) ||
          undefined,
        isTrunk: inferTrunk(port),
        tags: getPortTags(port),
        stats,
      };
    }),
  );
  const portsUsed = ports.filter((port) => port.status === 'up').length;
  const uplinkStatus = ports.some((port) => port.isUplink)
    ? 'up'
    : item['directly-connected'] === 1
      ? 'up'
      : portsUsed
        ? 'degraded'
        : 'down';

  return {
    id: buildSwitchId(site.id, serial),
    hostname:
      extractStatusField(item, ['description', 'switch-device-tag', 'name']) ||
      extractStatusField(item, ['switch-id', 'sn']) ||
      serial,
    model: inferSwitchModel(item),
    serial,
    siteId: site.id,
    status: portsUsed ? (item['directly-connected'] === 1 ? 'healthy' : 'warning') : 'offline',
    firmware,
    targetFirmware: firmware,
    portsUsed,
    totalPorts: ports.length,
    poeUsageWatts: 0,
    poeBudgetWatts,
    uplinkStatus,
    lastSeen: new Date().toISOString(),
    managementIp: extractStatusField(item, ['ip', 'management-ip', 'mgmt-ip']) || '',
    profileId: extractStatusField(item, ['switch-profile', 'access-profile']) || 'default',
    stackRole: 'standalone',
    configSummary: [
      `Switch profile: ${extractStatusField(item, ['switch-profile']) || 'default'}`,
      `Access profile: ${extractStatusField(item, ['access-profile']) || 'default'}`,
      `FortiLink peer: ${extractStatusField(item, ['fsw-wan1-peer']) || 'not reported'}`,
      `Firmware provisioning: ${extractStatusField(item, ['firmware-provision']) || 'disable'}`,
      'Live PoE draw is not exposed by the current REST endpoints; budget only is shown here.',
    ],
    ports,
  };
};

const shouldRefreshLatency = (site) => {
  if (!site.latency_checked_at) return true;

  const checkedAt = new Date(site.latency_checked_at).getTime();
  if (!Number.isFinite(checkedAt)) return true;

  return Date.now() - checkedAt > pingCacheTtlMs;
};

const runPing = async (host) => {
  const args =
    process.platform === 'win32'
      ? ['-n', '3', '-w', '2000', host]
      : ['-n', '-c', '3', '-W', '2', host];

  try {
    const { stdout, stderr } = await execFileAsync('ping', args, { timeout: 10_000 });
    const parsed = parsePingOutput(stdout);

    if (!parsed) {
      return {
        avgMs: null,
        minMs: null,
        maxMs: null,
        packetLoss: null,
        checkedAt: new Date().toISOString(),
        error: stderr?.trim() || 'Ping output could not be parsed.',
      };
    }

    return {
      ...parsed,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error && 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()
        ? error.stderr.trim()
        : error instanceof Error
          ? error.message
          : 'Ping failed';

    return {
      avgMs: null,
      minMs: null,
      maxMs: null,
      packetLoss: null,
      checkedAt: new Date().toISOString(),
      error: message,
    };
  }
};

const toLatencySummary = (site) => ({
  avgMs: parseMaybeNumber(site.latency_avg_ms),
  minMs: parseMaybeNumber(site.latency_min_ms),
  maxMs: parseMaybeNumber(site.latency_max_ms),
  packetLoss: parseMaybeNumber(site.latency_packet_loss),
  checkedAt: site.latency_checked_at || null,
  error: site.latency_error || null,
});

const normalizeSite = (site, overrides = {}) => ({
  id: site.id,
  shorthandId: site.shorthand_id,
  name: site.name,
  address: site.address,
  timezone: site.timezone,
  region: site.region,
  status: 'warning',
  wanStatus: 'degraded',
  clientCount: 0,
  switchCount: 0,
  apCount: 0,
  fortigateName: site.fortigate_name || site.name,
  fortigateIp: site.fortigate_ip || '',
  source: site.is_demo ? 'demo' : 'live',
  fortigateVersion: null,
  fortigateSerial: null,
  addressObjectCount: 0,
  apiReachable: false,
  lastSyncError: null,
  latencyAvgMs: parseMaybeNumber(site.latency_avg_ms),
  latencyMinMs: parseMaybeNumber(site.latency_min_ms),
  latencyMaxMs: parseMaybeNumber(site.latency_max_ms),
  latencyPacketLoss: parseMaybeNumber(site.latency_packet_loss),
  latencyCheckedAt: site.latency_checked_at || null,
  latencyError: site.latency_error || null,
  ...overrides,
});

export const createFortiGateClient = ({ siteStore }) => ({
  async summarizeSite(site) {
    if (site.is_demo) {
      return normalizeSite(site, {
        status: 'healthy',
        wanStatus: 'online',
        clientCount: 97,
        switchCount: 4,
        apCount: 6,
        apiReachable: false,
      });
    }

    let workingSite = site;
    if (site.fortigate_ip && shouldRefreshLatency(site)) {
      workingSite = await siteStore.updateLatencyCache(site.id, await runPing(site.fortigate_ip));
    }

    const latency = toLatencySummary(workingSite);

    if (!workingSite.fortigate_ip || !workingSite.fortigate_api_key) {
      return normalizeSite(workingSite, {
        status: 'warning',
        wanStatus: 'degraded',
        lastSyncError: 'FortiGate IP or API key is missing for this site.',
      });
    }

    try {
      const [statusPayload, addressPayload] = await Promise.all([
        requestJson(`https://${workingSite.fortigate_ip}/api/v2/monitor/system/status`, workingSite.fortigate_api_key),
        requestJson(`https://${workingSite.fortigate_ip}/api/v2/cmdb/firewall/address?format=name`, workingSite.fortigate_api_key),
      ]);

      const addressResults = Array.isArray(addressPayload.results) ? addressPayload.results : [];
      const fortigateVersion = extractFromStatusPayload(statusPayload, ['version', 'firmware', 'build', 'major']);
      const fortigateSerial = extractFromStatusPayload(statusPayload, ['serial', 'serial_number', 'serial-no', 'sn']);
      const fortigateName = extractFromStatusPayload(statusPayload, ['hostname', 'name']);
      const hasIdentity = Boolean(fortigateVersion && fortigateSerial);

      return normalizeSite(workingSite, {
        status: hasIdentity ? 'healthy' : 'warning',
        wanStatus: latency.packetLoss === 100 ? 'offline' : latency.packetLoss && latency.packetLoss > 0 ? 'degraded' : 'online',
        fortigateName: fortigateName || workingSite.fortigate_name || workingSite.name,
        fortigateVersion,
        fortigateSerial,
        addressObjectCount: addressResults.length,
        apiReachable: true,
        latencyAvgMs: latency.avgMs,
        latencyMinMs: latency.minMs,
        latencyMaxMs: latency.maxMs,
        latencyPacketLoss: latency.packetLoss,
        latencyCheckedAt: latency.checkedAt,
        latencyError: latency.error,
        lastSyncError: hasIdentity ? null : 'FortiGate API authenticated, but firmware or serial fields were not returned by monitor/system/status.',
      });
    } catch (error) {
      return normalizeSite(workingSite, {
        status: latency.packetLoss === 100 ? 'offline' : 'warning',
        wanStatus: latency.packetLoss === 100 ? 'offline' : 'degraded',
        latencyAvgMs: latency.avgMs,
        latencyMinMs: latency.minMs,
        latencyMaxMs: latency.maxMs,
        latencyPacketLoss: latency.packetLoss,
        latencyCheckedAt: latency.checkedAt,
        latencyError: latency.error,
        lastSyncError: error instanceof Error ? error.message : 'Unable to reach FortiGate API',
      });
    }
  },

  async listManagedSwitchesForSite(site) {
    if (site.is_demo || !site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const payload = await requestJson(
      `https://${site.fortigate_ip}/api/v2/cmdb/switch-controller/managed-switch`,
      site.fortigate_api_key,
    );

    const switches = Array.isArray(payload.results) ? payload.results : [];
    return switches.map((item) => mapManagedSwitch(site, item));
  },

  async getManagedSwitchDetailForSite(site, switchId) {
    if (site.is_demo || !site.fortigate_ip || !site.fortigate_api_key) {
      return null;
    }

    const payload = await requestJson(
      `https://${site.fortigate_ip}/api/v2/cmdb/switch-controller/managed-switch`,
      site.fortigate_api_key,
    );

    const switches = Array.isArray(payload.results) ? payload.results : [];
    const item = switches.find(
      (candidate) => buildSwitchId(site.id, extractStatusField(candidate, ['sn', 'serial', 'switch-id']) || 'unknown-switch') === switchId,
    );

    if (!item) return null;

    const serial = extractStatusField(item, ['sn', 'serial', 'switch-id']) || 'unknown-switch';
    const statsPayload = await getCachedSwitchStats(site, serial, site.fortigate_api_key).catch(() => null);
    const statsByPort =
      Array.isArray(statsPayload?.results) && statsPayload.results[0]?.ports ? statsPayload.results[0].ports : {};

    return mapManagedSwitch(site, item, statsByPort);
  },
});
