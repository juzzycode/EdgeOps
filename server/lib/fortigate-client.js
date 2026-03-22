import { execFile } from 'node:child_process';
import https from 'node:https';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const pingCacheTtlMs = 60_000;
const switchStatsCacheTtlMs = 60_000;
const wirelessClientsCacheTtlMs = 30_000;
const fortiGateRequestTimeoutMs = 5_000;
const switchStatsCache = new Map();
const wirelessClientsCache = new Map();

const parseFortiGateTarget = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return { authority: '', host: '' };
  }

  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return {
      authority: parsed.host,
      host: parsed.hostname,
    };
  } catch {
    return {
      authority: raw,
      host: raw.split(':')[0],
    };
  }
};

const fortiGateBaseUrl = (value) => {
  const target = parseFortiGateTarget(value);
  return target.authority ? `https://${target.authority}` : '';
};

const requestJson = (url, apiKey) =>
  new Promise((resolve, reject) => {
    let settled = false;
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
          if (settled) return;
          settled = true;
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

    request.setTimeout(fortiGateRequestTimeoutMs, () => {
      if (settled) return;
      settled = true;
      reject(new Error(`FortiGate request timed out after ${fortiGateRequestTimeoutMs / 1000}s`));
      request.destroy();
    });

    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
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

const parseInterfaceIp = (value) => {
  if (typeof value !== 'string') return null;
  const token = value.trim().split(/\s+/)[0];
  return token || null;
};

const maybeIsoFromUnix = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1_000_000_000) return undefined;
  return new Date(numeric * 1000).toISOString();
};

const inferApModel = (item) => {
  const profile = extractStatusField(item, ['wtp-profile', 'platform']);
  if (profile?.includes('-default')) {
    return profile.replace('-default', '');
  }

  const serial = extractStatusField(item, ['wtp-id', 'serial']);
  if (serial?.startsWith('FP')) {
    return `FAP${serial.slice(2, 6)}`;
  }

  return profile || 'FortiAP';
};

const extractWanIpFromInterfaces = (payload) => {
  const interfaces = Array.isArray(payload?.results) ? payload.results : [];
  const candidate =
    interfaces.find((item) => {
      const role = String(item?.role || '').toLowerCase();
      const name = String(item?.name || item?.q_origin_key || '').toLowerCase();
      const alias = String(item?.alias || '').toLowerCase();
      return role === 'wan' || name.startsWith('wan') || alias.includes('wan');
    }) || interfaces[0];

  if (!candidate) return null;

  return (
    parseInterfaceIp(candidate.ip) ||
    parseInterfaceIp(candidate['ipv4-address']) ||
    parseInterfaceIp(candidate['secondary-ip']) ||
    null
  );
};

const toRadioBand = (band) => {
  const normalized = String(band || '').toLowerCase();
  if (normalized.includes('6g')) return '6 GHz';
  if (normalized.includes('5g') || normalized.includes('11a') || normalized.includes('11ac') || normalized.includes('11be-5g')) return '5 GHz';
  return '2.4 GHz';
};

const channelListFromRadio = (radio) =>
  Array.isArray(radio?.channel) ? radio.channel.map((entry) => Number(entry?.chan)).filter(Number.isFinite) : [];

const primaryChannelFromRadio = (radio) => channelListFromRadio(radio)[0] ?? 0;

const uniqueBy = (items, selector) => {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = selector(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
};

const mapApClient = (client) => ({
  id: client.mac || `${client.wtp_id}-${client.ip || 'client'}`,
  name: client.hostname || client.host || client.manufacturer || client.mac || 'Client',
  hostname: client.hostname || client.host || undefined,
  dhcpName: client.host || undefined,
  ip: client.ip || undefined,
  mac: client.mac || '',
  ssid: client.ssid || client.vap_name || 'Unknown SSID',
  radioId: `radio-${client.wtp_radio ?? 'unknown'}`,
  radioType: client.radio_type || '',
  signal: parseMaybeNumber(client.signal) ?? undefined,
  snr: parseMaybeNumber(client.snr) ?? undefined,
  channel: parseMaybeNumber(client.channel) ?? undefined,
  manufacturer: client.manufacturer || undefined,
  health: client.health?.signal_strength?.severity || client.health?.snr?.severity || 'good',
  rxRateMbps: parseMaybeNumber(client.sta_rxrate) ? Math.round(Number(client.sta_rxrate) / 1000) : undefined,
  txRateMbps: parseMaybeNumber(client.sta_txrate) ? Math.round(Number(client.sta_txrate) / 1000) : undefined,
  retryPercent: parseMaybeNumber(client.tx_retry_percentage) ?? undefined,
  discardPercent: parseMaybeNumber(client.tx_discard_percentage) ?? undefined,
  idleSeconds: parseMaybeNumber(client.idle_time) ?? undefined,
  connectedAt: maybeIsoFromUnix(client.association_time),
});

const deriveStatusFromAp = (item, clients) => {
  if (item.admin !== 'enable') return 'offline';

  const activeRadioCount = [item['radio-1'], item['radio-2'], item['radio-3'], item['radio-4']].filter((radio) => String(radio?.band || '').trim()).length;
  const lowHealthClients = clients.filter((client) => client.health === 'poor').length;
  if (clients.length > 0) {
    return lowHealthClients >= 3 ? 'warning' : 'healthy';
  }

  if (!activeRadioCount) return 'warning';

  if (lowHealthClients >= 3) return 'warning';

  if (clients.length === 0 && item['wtp-mode'] === 'remote') return 'warning';

  return 'healthy';
};

const estimateUtilization = (clients, radioNumber) => {
  const radioClients = clients.filter((client) => Number(client.wtp_radio) === radioNumber);
  if (!radioClients.length) return 0;

  const retryPenalty = radioClients.reduce((total, client) => total + (parseMaybeNumber(client.tx_retry_percentage) ?? 0), 0) / radioClients.length;
  return Math.min(100, Math.round(radioClients.length * 11 + retryPenalty));
};

const mapApRadio = (radioKey, radio, clients) => {
  const radioNumber = Number(radio?.['radio-id'] ?? 0) + 1;
  const radioId = `radio-${radioNumber}`;
  return {
    id: radioId,
    band: toRadioBand(radio?.band),
    channel: primaryChannelFromRadio(radio),
    txPower: radio?.['power-value'] ? `${radio['power-value']} dBm` : `${radio?.['power-level'] ?? 100}%`,
    utilization: estimateUtilization(clients, radioNumber),
    status: String(radio?.band || '').trim() ? 'up' : 'down',
  };
};

const mapSsidsFromAp = (item, clients) => {
  const ssids = uniqueBy(
    ['radio-1', 'radio-2', 'radio-3', 'radio-4'].flatMap((radioKey) => {
      const radio = item[radioKey];
      if (!Array.isArray(radio?.vaps)) return [];

      return radio.vaps.map((vap) => {
        const name = vap?.name || vap?.q_origin_key;
        return name
          ? {
              id: `${item['wtp-id']}-${name}`,
              name,
              vlan: 'FortiGate WLAN',
              authMode: 'Managed by FortiGate',
              clientCount: clients.filter((client) => client.ssid === name).length,
            }
          : null;
      });
    }).filter(Boolean),
    (ssid) => ssid.id,
  );

  return ssids;
};

const shouldUseCachedWirelessClients = (entry) =>
  Boolean(entry) && Date.now() - entry.fetchedAt < wirelessClientsCacheTtlMs;

const getCachedWirelessClients = async (site, apiKey) => {
  const cacheKey = `${site.id}:wifi-clients`;
  const cached = wirelessClientsCache.get(cacheKey);
  if (shouldUseCachedWirelessClients(cached)) {
    return cached.payload;
  }

  const payload = await requestJson(
    `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/wifi/client`,
    apiKey,
  );

  wirelessClientsCache.set(cacheKey, {
    fetchedAt: Date.now(),
    payload,
  });

  return payload;
};

const isInfrastructureDevice = (item) => {
  const family = String(item.hardware_family || '').toLowerCase();
  const vendor = String(item.hardware_vendor || '').toLowerCase();
  const hostname = String(item.hostname || '').toLowerCase();
  return (
    family.includes('fortiap') ||
    family === 'ap' ||
    hostname.startsWith('441k-') ||
    hostname.startsWith('432g-') ||
    hostname.startsWith('443k-') ||
    (vendor === 'fortinet' && String(item.os_name || '').toLowerCase().includes('fortiap'))
  );
};

const mapClientStatus = (item) => {
  if (!item.is_online) return 'idle';
  const lastSeen = Number(item.last_seen);
  if (Number.isFinite(lastSeen) && Date.now() - lastSeen * 1000 > 15 * 60 * 1000) {
    return 'idle';
  }
  return 'active';
};

const mapConnectionType = (item) => {
  const detected = String(item.detected_interface || '').toLowerCase();
  return detected.includes('wired') ? 'wired' : 'wireless';
};

const mapClientNetwork = (item) => item.fortiap_ssid || (item.fortiswitch_vlan_id ? `VLAN ${item.fortiswitch_vlan_id}` : 'Unknown');

const mapManagedClient = (site, item) => {
  const mac = String(item.mac || item.master_mac || '').toLowerCase();
  const connectionType = mapConnectionType(item);
  const connectedDeviceType = connectionType === 'wired' ? 'switch' : 'ap';
  const connectedPort = item.fortiswitch_port_name ? String(item.fortiswitch_port_name) : undefined;
  const connectedApName = item.fortiap_name ? String(item.fortiap_name) : undefined;

  return {
    id: `${site.id}--client--${mac || item.ipv4_address || item.hostname || 'unknown'}`,
    name: item.hostname || item.hardware_vendor || item.mac || 'Client',
    username: item.hostname || item.host_src || 'unidentified',
    connectionType,
    ip: item.ipv4_address || '',
    mac: String(item.mac || ''),
    network: mapClientNetwork(item),
    connectedDeviceId: connectedApName || item.fortiswitch_serial || item.fortiswitch_id || 'unknown-device',
    connectedDeviceType,
    siteId: site.id,
    usageGb: 0,
    status: mapClientStatus(item),
    lastSeen: maybeIsoFromUnix(item.last_seen) || new Date().toISOString(),
    hostname: item.hostname || undefined,
    vendor: item.hardware_vendor || undefined,
    osName: item.os_name || undefined,
    osVersion: item.os_version || undefined,
    detectedInterface: item.detected_interface || undefined,
    connectedPort,
    connectedApName,
    vlanId: parseMaybeNumber(item.fortiswitch_vlan_id) ?? undefined,
    dhcpLeaseStatus: item.dhcp_lease_status || undefined,
    connectedAt: maybeIsoFromUnix(item.active_start_time),
  };
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
    `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/switch-controller/managed-switch/port-stats?mkey=${encodeURIComponent(serial)}`,
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
const buildApId = (siteId, serial) => `${siteId}--${serial}`;

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

const mapManagedAccessPoint = (site, item, clients, neighborNames = []) => {
  const serial = extractStatusField(item, ['wtp-id', 'serial']) || 'unknown-ap';
  const firmware =
    extractStatusField(item, [
      'os-version',
      'firmware-version',
      'firmware_version',
      'version',
      'image-version',
      'wtp-version',
      'firmware-provision-version',
      'firmware-provision',
    ]) || 'Managed by FortiGate';
  const targetFirmware =
    extractStatusField(item, ['firmware-provision-version', 'firmware-provision', 'staged-image-version']) ||
    (item['firmware-provision-latest'] === 'disable' ? 'No staged target' : 'Latest staged target');
  const radios = ['radio-1', 'radio-2', 'radio-3', 'radio-4']
    .map((radioKey) => mapApRadio(radioKey, item[radioKey], clients))
    .filter((radio) => radio.status === 'up');
  const ssids = mapSsidsFromAp(item, clients);
  const managementIp = clients[0]?.wtp_ip || clients[0]?.wtp_control_ip || '';
  const status = deriveStatusFromAp(item, clients);

  return {
    id: buildApId(site.id, serial),
    name: extractStatusField(item, ['name', 'location']) || serial,
    model: inferApModel(item),
    serial,
    siteId: site.id,
    status,
    firmware,
    targetFirmware,
    clients: clients.length,
    radios,
    ip: managementIp,
    lastSeen: new Date().toISOString(),
    profileId: extractStatusField(item, ['wtp-profile', 'apcfg-profile']) || 'default',
    ssids,
    configSummary: [
      `WTP profile: ${extractStatusField(item, ['wtp-profile']) || 'default'}`,
      `Mode: ${extractStatusField(item, ['wtp-mode']) || 'unknown'}`,
      `Region: ${extractStatusField(item, ['region']) || 'unassigned'}`,
      `LED override: ${extractStatusField(item, ['override-led-state']) || 'disable'}`,
      'Client counts and management IPs are live from monitor/wifi/client.',
      'Per-radio utilization is estimated from current client load because FortiGate does not expose direct utilization in these endpoints.',
    ],
    neighborAps: neighborNames.filter((name) => name !== (extractStatusField(item, ['name', 'location']) || serial)).slice(0, 4),
    clientDevices: clients.map(mapApClient),
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
  wanIp: null,
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
      workingSite = await siteStore.updateLatencyCache(site.id, await runPing(parseFortiGateTarget(site.fortigate_ip).host));
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
      const [statusResult, addressResult, switchResult, accessPointResult, clientResult, interfaceResult] = await Promise.allSettled([
        requestJson(`${fortiGateBaseUrl(workingSite.fortigate_ip)}/api/v2/monitor/system/status`, workingSite.fortigate_api_key),
        requestJson(`${fortiGateBaseUrl(workingSite.fortigate_ip)}/api/v2/cmdb/firewall/address?format=name`, workingSite.fortigate_api_key),
        requestJson(`${fortiGateBaseUrl(workingSite.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`, workingSite.fortigate_api_key),
        requestJson(`${fortiGateBaseUrl(workingSite.fortigate_ip)}/api/v2/cmdb/wireless-controller/wtp`, workingSite.fortigate_api_key),
        requestJson(`${fortiGateBaseUrl(workingSite.fortigate_ip)}/api/v2/monitor/user/device/query`, workingSite.fortigate_api_key),
        requestJson(`${fortiGateBaseUrl(workingSite.fortigate_ip)}/api/v2/cmdb/system/interface`, workingSite.fortigate_api_key),
      ]);

      if (statusResult.status === 'rejected') {
        throw statusResult.reason;
      }

      if (addressResult.status === 'rejected') {
        throw addressResult.reason;
      }

      const statusPayload = statusResult.value;
      const addressPayload = addressResult.value;
      const addressResults = Array.isArray(addressPayload.results) ? addressPayload.results : [];
      const switchCount =
        switchResult.status === 'fulfilled' && Array.isArray(switchResult.value.results) ? switchResult.value.results.length : 0;
      const apCount =
        accessPointResult.status === 'fulfilled' && Array.isArray(accessPointResult.value.results) ? accessPointResult.value.results.length : 0;
      const clientCount =
        clientResult.status === 'fulfilled' && Array.isArray(clientResult.value.results)
          ? clientResult.value.results.filter((item) => !isInfrastructureDevice(item)).length
          : 0;
      const wanIp = interfaceResult.status === 'fulfilled' ? extractWanIpFromInterfaces(interfaceResult.value) : null;
      const fortigateVersion = extractFromStatusPayload(statusPayload, ['version', 'firmware', 'build', 'major']);
      const fortigateSerial = extractFromStatusPayload(statusPayload, ['serial', 'serial_number', 'serial-no', 'sn']);
      const fortigateName = extractFromStatusPayload(statusPayload, ['hostname', 'name']);
      const hasIdentity = Boolean(fortigateVersion && fortigateSerial);

      return normalizeSite(workingSite, {
        status: hasIdentity ? 'healthy' : 'warning',
        wanStatus: latency.packetLoss === 100 ? 'offline' : latency.packetLoss && latency.packetLoss > 0 ? 'degraded' : 'online',
        fortigateName: fortigateName || workingSite.fortigate_name || workingSite.name,
        wanIp,
        fortigateVersion,
        fortigateSerial,
        clientCount,
        switchCount,
        apCount,
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
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`,
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
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`,
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

  async listManagedAccessPointsForSite(site) {
    if (site.is_demo || !site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const [wtpPayload, clientsPayload] = await Promise.all([
      requestJson(`${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/wireless-controller/wtp`, site.fortigate_api_key),
      getCachedWirelessClients(site, site.fortigate_api_key).catch(() => ({ results: [] })),
    ]);

    const accessPoints = Array.isArray(wtpPayload.results) ? wtpPayload.results : [];
    const clients = Array.isArray(clientsPayload.results) ? clientsPayload.results : [];
    const apNames = accessPoints
      .map((item) => extractStatusField(item, ['name', 'location']))
      .filter(Boolean);

    return accessPoints.map((item) =>
      mapManagedAccessPoint(
        site,
        item,
        clients.filter((client) => client.wtp_id === item['wtp-id']),
        apNames,
      ),
    );
  },

  async getManagedAccessPointDetailForSite(site, accessPointId) {
    if (site.is_demo || !site.fortigate_ip || !site.fortigate_api_key) {
      return null;
    }

    const [wtpPayload, clientsPayload] = await Promise.all([
      requestJson(`${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/wireless-controller/wtp`, site.fortigate_api_key),
      getCachedWirelessClients(site, site.fortigate_api_key).catch(() => ({ results: [] })),
    ]);

    const accessPoints = Array.isArray(wtpPayload.results) ? wtpPayload.results : [];
    const clients = Array.isArray(clientsPayload.results) ? clientsPayload.results : [];
    const item = accessPoints.find(
      (candidate) =>
        buildApId(site.id, extractStatusField(candidate, ['wtp-id', 'serial']) || 'unknown-ap') === accessPointId,
    );

    if (!item) return null;

    const apNames = accessPoints
      .map((candidate) => extractStatusField(candidate, ['name', 'location']))
      .filter(Boolean);

    return mapManagedAccessPoint(
      site,
      item,
      clients.filter((client) => client.wtp_id === item['wtp-id']),
      apNames,
    );
  },

  async listClientsForSite(site) {
    if (site.is_demo || !site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const payload = await requestJson(
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/user/device/query`,
      site.fortigate_api_key,
    );

    const devices = Array.isArray(payload.results) ? payload.results : [];
    return devices
      .filter((item) => !isInfrastructureDevice(item))
      .map((item) => mapManagedClient(site, item));
  },
});
