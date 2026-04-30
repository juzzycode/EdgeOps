import { execFile } from 'node:child_process';
import https from 'node:https';
import { promisify } from 'node:util';
import { serverConfig } from '../config.js';

const execFileAsync = promisify(execFile);
const pingCacheTtlMs = 60_000;
const switchStatsCacheTtlMs = 60_000;
const switchStatusCacheTtlMs = 30_000;
const managedApStatusCacheTtlMs = 30_000;
const wirelessClientsCacheTtlMs = 30_000;
const fortiGateRequestTimeoutMs = serverConfig.fortiGateRequestTimeoutMs;
const fortiGateRateLimitRetryCount = 2;
const switchStatsCache = new Map();
const switchStatusCache = new Map();
const managedApStatusCache = new Map();
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

const resolveSiteVdom = (site) => String(site?.fortigate_vdom || '').trim() || 'root';

const parseRetryAfterMs = (value) => {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(250, Math.round(seconds * 1000));
  }

  return 1_000;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestFortiGate = (url, apiKey, options = {}) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const attempt = Number(options.attempt ?? 0);
    const method = options.method || 'GET';
    const body = options.body;
    const serializedBody =
      body === undefined || body === null ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(serializedBody ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(serializedBody) } : {}),
      ...(options.headers ?? {}),
    };
    const request = https.request(
      url,
      {
        method,
        rejectUnauthorized: false,
        headers,
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (settled) return;
          if ((response.statusCode ?? 500) >= 400) {
            if ((response.statusCode ?? 500) === 429 && attempt < fortiGateRateLimitRetryCount) {
              settled = true;
              void wait(parseRetryAfterMs(response.headers['retry-after'])).then(() =>
                requestFortiGate(url, apiKey, {
                  ...options,
                  attempt: attempt + 1,
                }).then(resolve, reject),
              );
              return;
            }

            settled = true;
            reject(new Error(`FortiGate request failed with HTTP ${response.statusCode}`));
            return;
          }

          try {
            settled = true;
            const contentType = String(response.headers['content-type'] || '').toLowerCase();
            if (!body) {
              resolve({});
              return;
            }
            if (contentType.includes('application/json')) {
              resolve(JSON.parse(body));
              return;
            }
            resolve(body);
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
    if (serializedBody) {
      request.write(serializedBody);
    }
    request.end();
  });

const requestJson = (url, apiKey) => requestFortiGate(url, apiKey);

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

const inferFortiGateModel = (statusPayload, site) =>
  extractFromStatusPayload(statusPayload, ['model', 'model_name', 'model-name', 'platform', 'product']) ||
  String(site?.fortigate_name || '').trim() ||
  'FortiGate';

const isFortiWifiModel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.includes('fortiwifi') || normalized.startsWith('fwf');
};

const isIntegratedFortiWifiWtp = (item, statusPayload, site) => {
  const fortiGateModel = inferFortiGateModel(statusPayload, site);
  if (!isFortiWifiModel(fortiGateModel)) {
    return false;
  }

  const wtpId = extractStatusField(item, ['wtp-id', 'serial']) || '';
  const normalizedWtpId = wtpId.trim().toLowerCase();
  return normalizedWtpId.startsWith('fwf') && normalizedWtpId.includes('-wifi');
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

const toFortiGateInterfaceReference = (value, nameKey = 'name') => {
  const name =
    typeof value === 'string'
      ? value.trim()
      : extractStatusField(value, [nameKey, 'vlan-name', 'q_origin_key', 'name']);

  if (!name) return null;

  return {
    [nameKey]: name,
    q_origin_key: name,
    datasource: 'system.interface',
  };
};

const normalizeFortiGateInterfaceReferenceList = (value, nameKey = 'vlan-name') => {
  const entries = Array.isArray(value) ? value : [];
  return entries.map((entry) => toFortiGateInterfaceReference(entry, nameKey)).filter(Boolean);
};

const normalizeSwitchPortVlanName = (value) => {
  if (typeof value === 'string') return value.trim();
  return extractStatusField(value, ['name', 'vlan-name', 'q_origin_key']) || '';
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

const summarizeObservedRadio = (clients, radioNumber) => {
  const radioClients = clients.filter((client) => Number(client.wtp_radio) === radioNumber);
  if (!radioClients.length) return null;

  const representative = radioClients[0];
  const channelCounts = new Map();
  for (const client of radioClients) {
    const channel = parseMaybeNumber(client.channel);
    if (!Number.isFinite(channel)) continue;
    channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
  }

  const primaryChannel =
    [...channelCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    parseMaybeNumber(representative.channel) ??
    0;

  return {
    id: `radio-${radioNumber}`,
    band: toRadioBand(representative.radio_type),
    channel: primaryChannel,
    txPower: 'Unavailable',
    utilization: estimateUtilization(clients, radioNumber),
    status: 'up',
  };
};

const mapObservedRadiosFromClients = (clients) =>
  uniqueBy(
    clients
      .map((client) => summarizeObservedRadio(clients, Number(client.wtp_radio)))
      .filter(Boolean),
    (radio) => radio.id,
  );

const humanizeSecurity = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const mapSsidsFromClients = (item, clients) =>
  uniqueBy(
    clients
      .map((client) => {
        const name = client.ssid || client.vap_name;
        if (!name) return null;

        return {
          id: `${item['wtp-id']}-${name}`,
          name,
          vlan: Number.isFinite(parseMaybeNumber(client.vlan_id)) && Number(client.vlan_id) > 0 ? `VLAN ${client.vlan_id}` : 'FortiGate WLAN',
          authMode: humanizeSecurity(client.security_str) || 'Observed from client telemetry',
          clientCount: clients.filter((entry) => (entry.ssid || entry.vap_name) === name).length,
        };
      })
      .filter(Boolean),
    (ssid) => ssid.id,
  );

const synthesizeIntegratedAccessPoint = ({
  site,
  statusPayload,
  clients,
  runtimeStatus = null,
  neighborNames = [],
}) => {
  const fortiGateModel = inferFortiGateModel(statusPayload, site);
  const statusSerial =
    extractFromStatusPayload(statusPayload, ['serial', 'serial_number', 'serial-no', 'sn']) ||
    extractStatusField(runtimeStatus, ['wtp_id', 'serial']) ||
    site.id;
  const serial = `integrated-${statusSerial}`;
  const radios = mapObservedRadiosFromClients(clients);
  const ssids = mapSsidsFromClients({ 'wtp-id': serial }, clients);
  const managementIp =
    extractStatusField(runtimeStatus, ['local_ipv4_addr', 'connecting_from']) ||
    clients[0]?.wtp_ip ||
    clients[0]?.wtp_control_ip ||
    parseFortiGateTarget(site.fortigate_ip).host ||
    '';
  const firmware =
    extractStatusField(runtimeStatus, ['os_version', 'version']) ||
    extractFromStatusPayload(statusPayload, ['version', 'firmware-version']) ||
    'Integrated with FortiGate';

  return {
    id: buildApId(site.id, serial),
    name: `${extractFromStatusPayload(statusPayload, ['hostname', 'name']) || site.fortigate_name || site.name} Integrated AP`,
    model: isFortiWifiModel(fortiGateModel) ? fortiGateModel : 'FortiWiFi Integrated AP',
    serial,
    siteId: site.id,
    status: clients.length ? 'healthy' : runtimeStatus ? 'healthy' : 'warning',
    firmware,
    targetFirmware: 'Managed by FortiGate platform firmware',
    clients: clients.length,
    radios,
    ip: managementIp,
    lastSeen: new Date().toISOString(),
    profileId: 'integrated-wireless',
    ssids,
    configSummary: [
      `Parent device: ${extractFromStatusPayload(statusPayload, ['hostname', 'name']) || site.fortigate_name || site.name}`,
      `Model: ${fortiGateModel}`,
      'This AP is synthesized from FortiWiFi-integrated wireless capability rather than a separate FortiAP controller record.',
      'Client counts and SSIDs are inferred from live wireless client telemetry when available.',
    ],
    neighborAps: neighborNames.slice(0, 4),
    clientDevices: clients.map(mapApClient),
  };
};

const appendIntegratedAccessPointIfNeeded = ({
  site,
  statusPayload = null,
  accessPoints,
  clients,
  managedApStatuses,
}) => {
  const knownSerials = new Set(
    accessPoints
      .map((item) => extractStatusField(item, ['wtp-id', 'serial']))
      .filter(Boolean),
  );
  const statusModel = inferFortiGateModel(statusPayload, site);
  const runtimeCandidates = managedApStatuses
    .map((entry) => ({
      key: extractStatusField(entry, ['wtp_id', 'serial']),
      runtimeStatus: entry,
    }))
    .filter((entry) => entry.key && !knownSerials.has(entry.key));
  const clientCandidates = [...new Set(clients.map((entry) => extractStatusField(entry, ['wtp_id'])).filter(Boolean))]
    .filter((key) => !knownSerials.has(key))
    .map((key) => ({
      key,
      runtimeStatus:
        managedApStatuses.find((entry) => extractStatusField(entry, ['wtp_id', 'serial']) === key) ?? null,
    }));
  const integratedCandidates = runtimeCandidates.length || clientCandidates.length
    ? uniqueBy([...runtimeCandidates, ...clientCandidates], (entry) => entry.key)
    : isFortiWifiModel(statusModel)
      ? [{ key: `integrated-${site.id}`, runtimeStatus: managedApStatuses[0] ?? null }]
      : [];
  const accessPointNames = accessPoints.map((item) => extractStatusField(item, ['name', 'location'])).filter(Boolean);

  return [
    ...accessPoints,
    ...integratedCandidates.map((candidate) =>
      synthesizeIntegratedAccessPoint({
        site,
        statusPayload,
        clients: clients.filter((entry) => {
          const clientWtpId = extractStatusField(entry, ['wtp_id']);
          return candidate.key === `integrated-${site.id}` ? !clientWtpId || !knownSerials.has(clientWtpId) : clientWtpId === candidate.key;
        }),
        runtimeStatus: candidate.runtimeStatus,
        neighborNames: accessPointNames,
      }),
    ),
  ];
};

const filterStandaloneAccessPoints = ({ site, statusPayload = null, accessPoints }) =>
  accessPoints.filter((item) => !isIntegratedFortiWifiWtp(item, statusPayload, site));

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

const shouldUseCachedManagedApStatus = (entry) =>
  Boolean(entry) && Date.now() - entry.fetchedAt < managedApStatusCacheTtlMs;

const getCachedManagedApStatus = async (site, apiKey) => {
  const cacheKey = `${site.id}:managed-ap-status`;
  const cached = managedApStatusCache.get(cacheKey);
  if (shouldUseCachedManagedApStatus(cached)) {
    return cached.payload;
  }

  const payload = await requestJson(
    `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/wifi/managed_ap`,
    apiKey,
  );

  managedApStatusCache.set(cacheKey, {
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

const normalizeClientIdentityValue = (value) => String(value || '').trim();

const isMacLikeValue = (value) => /^[0-9a-f]{2}([-:.]?[0-9a-f]{2}){5}$/i.test(normalizeClientIdentityValue(value));

const isPlaceholderIdentity = (value) => {
  const normalized = normalizeClientIdentityValue(value).toLowerCase();
  if (!normalized) return true;
  if (['unknown', 'unknown client', 'n/a', 'na', 'none', 'null', 'unidentified'].includes(normalized)) return true;
  return isMacLikeValue(normalized);
};

const mapManagedClient = (site, item, resolvedVendor = null) => {
  const mac = String(item.mac || item.master_mac || '').toLowerCase();
  const connectionType = mapConnectionType(item);
  const connectedDeviceType = connectionType === 'wired' ? 'switch' : 'ap';
  const connectedPort = item.fortiswitch_port_name ? String(item.fortiswitch_port_name) : undefined;
  const connectedApName = item.fortiap_name ? String(item.fortiap_name) : undefined;
  const rawHostname = normalizeClientIdentityValue(item.hostname);
  const rawVendor = normalizeClientIdentityValue(item.hardware_vendor);
  const vendor = resolvedVendor || (isPlaceholderIdentity(rawVendor) ? undefined : rawVendor) || undefined;
  const hasUnknownName = isPlaceholderIdentity(rawHostname);
  const derivedName = hasUnknownName
    ? vendor
      ? `Unknown Client - (${vendor})`
      : 'Unknown Client'
    : rawHostname;

  return {
    id: `${site.id}--client--${mac || item.ipv4_address || item.hostname || 'unknown'}`,
    name: derivedName,
    username: rawHostname || item.host_src || 'unidentified',
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
    hostname: hasUnknownName ? undefined : rawHostname,
    vendor,
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

const inferPortAdminEnabled = (runtimePort, port, overrideEnabled = null) => {
  if (typeof overrideEnabled === 'boolean') return overrideEnabled;

  const runtimeStatus = String(runtimePort?.status || '').toLowerCase();
  if (['disabled', 'down-admin', 'admin-down'].includes(runtimeStatus)) return false;

  const configStatus = String(port?.status || '').toLowerCase();
  if (['disable', 'disabled', 'down'].includes(configStatus)) return false;

  return true;
};

const inferPoeEnabled = (runtimePort, port) => {
  const runtimePoeEnabled = String(runtimePort?.poe_status || '').toLowerCase();
  if (runtimePoeEnabled) {
    return ['enable', 'enabled', 'on'].includes(runtimePoeEnabled);
  }

  const configPoeEnabled = String(port?.['poe-status'] || '').toLowerCase();
  return ['enable', 'enabled', 'on'].includes(configPoeEnabled);
};

const mapPortStatus = (port, stats) => {
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

const getPortTags = (port, runtimePort = null) => {
  const tags = [];
  const poeEnabled = inferPoeEnabled(runtimePort, port);
  if (inferTrunk(port)) tags.push('Trunk');
  if (port['poe-capable'] === 1) tags.push(poeEnabled ? 'PoE' : 'PoE Off');
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

const shouldUseCachedSwitchStatus = (entry) =>
  Boolean(entry) && Date.now() - entry.fetchedAt < switchStatusCacheTtlMs;

const getCachedSwitchStatus = async (site, apiKey) => {
  const cacheKey = `${site.id}:switch-status`;
  const cached = switchStatusCache.get(cacheKey);
  if (shouldUseCachedSwitchStatus(cached)) {
    return cached.payload;
  }

  const requestedVdom = resolveSiteVdom(site);
  let payload = await requestJson(
    `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/switch-controller/managed-switch/status?vdom=${encodeURIComponent(requestedVdom)}`,
    apiKey,
  ).catch(() => ({ results: [] }));

  const hasResults = Array.isArray(payload?.results) && payload.results.length > 0;
  if (!hasResults && requestedVdom !== 'root') {
    payload = await requestJson(
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/switch-controller/managed-switch/status?vdom=root`,
      apiKey,
    );
  }

  switchStatusCache.set(cacheKey, {
    fetchedAt: Date.now(),
    payload,
  });

  return payload;
};

const mapPoeState = (runtimePort, configPort) => {
  const runtimePoeEnabled = String(runtimePort?.poe_status || '').toLowerCase();
  const configPoeEnabled = String(configPort?.['poe-status'] || '').toLowerCase();
  const portPower = parseMaybeNumber(runtimePort?.port_power) ?? 0;
  const powerStatus = parseMaybeNumber(runtimePort?.power_status);
  const poeCapable = Boolean(runtimePort?.poe_capable ?? configPort?.['poe-capable']);

  if (!poeCapable) return 'Not PoE';
  if (portPower > 0 || powerStatus === 2) return 'Delivering power';
  if (runtimePoeEnabled === 'enabled' || configPoeEnabled === 'enable') return 'PoE enabled';
  return 'PoE disabled';
};

const invalidateSwitchCaches = (site, serial = null) => {
  switchStatusCache.delete(`${site.id}:switch-status`);
  if (serial) {
    switchStatsCache.delete(`${site.id}:${serial}`);
  }
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
const buildFortiGateId = (siteId) => `fortigate--${siteId}`;
const buildRogueApId = (siteId, bssid, ssid) => `${siteId}--rogue--${bssid || ssid || 'unknown'}`;

const buildPortOverrideMap = (rows = []) =>
  new Map(
    rows.map((row) => [
      String(row.port_number || ''),
      {
        description: row.description_override || null,
        vlan: row.vlan_override || null,
        enabled: row.enabled_override === null || row.enabled_override === undefined ? null : Boolean(row.enabled_override),
        updatedAt: row.updated_at || null,
        updatedBy: row.updated_by || null,
      },
    ]),
  );

const normalizeManagedSwitchPortName = (value) => String(value || '').trim();

const mapSwitchVlanOption = (item) => ({
  name: String(item?.name || item?.q_origin_key || '').trim(),
  vlanId: parseMaybeNumber(item?.vlanid),
  interfaceName: String(item?.interface || item?.interface_name || item?.fortilink || '').trim() || null,
});

const looksLikePortName = (value) => /^port\d+$/i.test(String(value || '').trim());

const isFortiLinkVlanInterface = (item) => {
  const type = String(item?.type || '').toLowerCase();
  const parent = String(item?.interface || item?.interface_name || '').toLowerCase();
  return type === 'vlan' && parent.includes('fortilink');
};

const dedupeSwitchVlanOptions = (items) =>
  uniqueBy(
    items.filter((item) => item && item.name && !looksLikePortName(item.name)),
    (item) => item.name,
  ).sort((left, right) => {
    const leftId = left.vlanId ?? Number.MAX_SAFE_INTEGER;
    const rightId = right.vlanId ?? Number.MAX_SAFE_INTEGER;
    if (leftId !== rightId) return leftId - rightId;
    return left.name.localeCompare(right.name);
  });

const mapManagedSwitch = (site, item, statsByPort = {}, portOverrideRows = [], runtimeStatus = null) => {
  const serial = extractStatusField(item, ['sn', 'serial', 'switch-id']) || 'unknown-switch';
  const switchId = buildSwitchId(site.id, serial);
  const rawPorts = Array.isArray(item.ports) ? item.ports : [];
  const portOverrides = buildPortOverrideMap(portOverrideRows);
  const poeBudgetWatts = rawPorts.reduce((total, port) => total + parseWatts(port['poe-max-power']), 0);
  const runtimePorts = Array.isArray(runtimeStatus?.ports) ? runtimeStatus.ports : [];
  const runtimePortMap = new Map(runtimePorts.map((port) => [String(port.interface || '').trim(), port]));
  const poeUsageWatts = runtimePorts.reduce((total, port) => total + (parseMaybeNumber(port.port_power) ?? 0), 0);
  const firmware =
    extractStatusField(runtimeStatus, ['os_version', 'firmware-version', 'version']) ||
    extractStatusField(item, ['firmware-provision-version', 'staged-image-version', 'os-version']) ||
    'Managed by FortiGate';
  const targetFirmware =
    extractStatusField(item, ['firmware-provision-version', 'staged-image-version']) ||
    (item['firmware-provision-latest'] === 'once' ? 'Latest available firmware' : 'No staged target');
  const ports = applyUplinkHeuristics(
    rawPorts.map((port) => {
      const portName = port['port-name'] || 'unknown';
      const stats = statsByPort[portName] ? mapPortStats(statsByPort[portName]) : undefined;
      const runtimePort = runtimePortMap.get(portName);
      const override = portOverrides.get(portName);
      const adminEnabled = inferPortAdminEnabled(runtimePort, port, override?.enabled ?? null);

      return {
        id: `${switchId}-${portName}`,
        portNumber: portName,
        status:
          !adminEnabled
            ? 'disabled'
            : runtimePort?.status
              ? String(runtimePort.status).toLowerCase() === 'up'
                ? 'up'
                : ['disabled', 'down-admin', 'admin-down'].includes(String(runtimePort.status).toLowerCase())
                  ? 'disabled'
                  : 'down'
              : mapPortStatus(port, stats),
        adminEnabled,
        speed: port.speed || 'auto',
        poeWatts: parseMaybeNumber(runtimePort?.port_power) ?? 0,
        poeState: mapPoeState(runtimePort, port),
        poeEnabled: inferPoeEnabled(runtimePort, port),
        vlan: override?.vlan || normalizeSwitchPortVlanName(port.vlan) || '_default',
        description: override?.description || port.description || portName,
        profileId: port['port-policy'] || port['qos-policy'] || 'default',
        clientCount: 0,
        neighbor:
          extractStatusField(port, ['isl-peer-device-name', 'fgt-peer-device-name', 'isl-peer-device-sn']) ||
          undefined,
        isTrunk: inferTrunk(port),
        tags: override ? [...new Set([...getPortTags(port, runtimePort), 'EdgeOps'])] : getPortTags(port, runtimePort),
        stats,
        overrideSource: override ? 'edgeops' : 'fortigate',
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
    id: switchId,
    hostname:
      extractStatusField(item, ['description', 'switch-device-tag', 'name']) ||
      extractStatusField(item, ['switch-id', 'sn']) ||
      serial,
    model: inferSwitchModel(item),
    serial,
    siteId: site.id,
    status: portsUsed ? (item['directly-connected'] === 1 ? 'healthy' : 'warning') : 'offline',
    firmware,
    targetFirmware,
    portsUsed,
    totalPorts: ports.length,
    poeUsageWatts,
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
      `Target firmware: ${targetFirmware}`,
      runtimeStatus?.os_version ? `Running firmware: ${runtimeStatus.os_version}` : 'Live switch runtime status is not available from the FortiGate monitor endpoint.',
    ],
    ports,
  };
};

const mapManagedAccessPoint = (site, item, clients, neighborNames = [], runtimeStatus = null) => {
  const serial = extractStatusField(item, ['wtp-id', 'serial']) || 'unknown-ap';
  const firmware =
    extractStatusField(runtimeStatus, ['os_version', 'version']) ||
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
  const configuredRadios = ['radio-1', 'radio-2', 'radio-3', 'radio-4']
    .map((radioKey) => mapApRadio(radioKey, item[radioKey], clients))
    .filter((radio) => radio.status === 'up');
  const radios = configuredRadios.length ? configuredRadios : mapObservedRadiosFromClients(clients);
  const configuredSsids = mapSsidsFromAp(item, clients);
  const ssids = configuredSsids.length ? configuredSsids : mapSsidsFromClients(item, clients);
  const managementIp =
    extractStatusField(runtimeStatus, ['local_ipv4_addr', 'connecting_from']) ||
    clients[0]?.wtp_ip ||
    clients[0]?.wtp_control_ip ||
    '';
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
      runtimeStatus?.os_version ? `Running firmware: ${runtimeStatus.os_version}` : 'Live AP runtime firmware is not available from the FortiGate monitor endpoint.',
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
  fortigateVdom: site.fortigate_vdom || 'root',
  wanIp: null,
  source: 'live',
  configArchiveEnabled:
    site.config_backups_to_keep === 0
      ? false
      : site.config_archive_enabled === undefined
        ? true
        : Boolean(site.config_archive_enabled),
  configBackupsToKeep:
    site.config_backups_to_keep === undefined || site.config_backups_to_keep === null
      ? null
      : Number(site.config_backups_to_keep),
  siteAlertEmailEnabled: Boolean(site.site_alert_email_enabled),
  siteAlertEmailRecipients: site.site_alert_email_recipients || '',
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

const parseAllowAccess = (value) =>
  String(value || '')
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const mapFortiGateInterface = (siteId, item) => ({
  id: `${buildFortiGateId(siteId)}--${String(item?.name || item?.q_origin_key || 'interface')}`,
  name: String(item?.name || item?.q_origin_key || 'Interface'),
  role: String(item?.role || 'unknown'),
  type: String(item?.type || 'unknown'),
  ip:
    parseInterfaceIp(item?.ip) ||
    parseInterfaceIp(item?.['ipv4-address']) ||
    parseInterfaceIp(item?.['secondary-ip']) ||
    'Unavailable',
  alias: String(item?.alias || '').trim() || undefined,
  status:
    String(item?.status || '').toLowerCase() === 'up'
      ? 'up'
      : String(item?.status || '').toLowerCase() === 'down'
        ? 'down'
        : 'unknown',
  allowAccess: parseAllowAccess(item?.allowaccess),
});

const mapFortiGateVpn = (siteId, item, phase2Count = 0, statusPayload = null) => {
  const name =
    extractStatusField(item, ['name', 'q_origin_key']) ||
    extractStatusField(statusPayload, ['name']) ||
    'IPsec Tunnel';
  const statusValue = String(
    extractStatusField(statusPayload, ['status']) ||
      extractStatusField(item, ['status']) ||
      'down',
  ).toLowerCase();

  return {
    id: `${buildFortiGateId(siteId)}--vpn--${name}`,
    name,
    type: extractStatusField(item, ['type']) || 'ipsec',
    interface: extractStatusField(item, ['interface']) || 'unknown',
    remoteGateway:
      extractStatusField(item, ['remote-gw', 'remote_gw']) ||
      extractStatusField(statusPayload, ['gateway', 'remote_gw']) ||
      'dynamic',
    status: statusValue.includes('up')
      ? 'up'
      : statusValue.includes('established') || statusValue.includes('connected')
        ? 'up'
        : statusValue.includes('warning')
          ? 'warning'
          : 'down',
    phase2Count,
  };
};

const mapFortiGatePolicy = (siteId, item) => ({
  id: `${buildFortiGateId(siteId)}--policy--${String(item?.policyid || item?.id || '0')}`,
  sequence: Number(item?.policyid || item?.id || 0),
  name: extractStatusField(item, ['name']) || `Policy ${item?.policyid || item?.id || ''}`.trim(),
  action: extractStatusField(item, ['action']) || 'accept',
  srcInterface:
    (Array.isArray(item?.srcintf) ? item.srcintf.map((entry) => entry?.name || entry?.q_origin_key).filter(Boolean).join(', ') : '') ||
    'any',
  dstInterface:
    (Array.isArray(item?.dstintf) ? item.dstintf.map((entry) => entry?.name || entry?.q_origin_key).filter(Boolean).join(', ') : '') ||
    'any',
  srcAddresses: Array.isArray(item?.srcaddr)
    ? item.srcaddr.map((entry) => entry?.name || entry?.q_origin_key).filter(Boolean)
    : [],
  dstAddresses: Array.isArray(item?.dstaddr)
    ? item.dstaddr.map((entry) => entry?.name || entry?.q_origin_key).filter(Boolean)
    : [],
  services: Array.isArray(item?.service)
    ? item.service.map((entry) => entry?.name || entry?.q_origin_key).filter(Boolean)
    : ['ALL'],
  schedule: extractStatusField(item, ['schedule']) || 'always',
  nat: String(item?.nat || '').toLowerCase() === 'enable',
  logTraffic: extractStatusField(item, ['logtraffic']) || 'disable',
  comments: extractStatusField(item, ['comments', 'comment']) || undefined,
  status: String(item?.status || '').toLowerCase() === 'disable' ? 'disabled' : 'enabled',
});

const toIsoFromEpochSeconds = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return new Date(numeric * 1000).toISOString();
};

const mapFortiGateDhcpLease = (siteId, item, resolvedVendor = null) => {
  const rawHostname = extractStatusField(item, ['hostname', 'host-name', 'client-hostname', 'client_hostname']) || '';
  const derivedHostname = isPlaceholderIdentity(rawHostname)
    ? resolvedVendor
      ? `Unknown Client - (${resolvedVendor})`
      : 'Unknown client'
    : rawHostname;

  return {
    id: `${buildFortiGateId(siteId)}--lease--${String(item?.ip || item?.address || item?.mac || 'unknown')}`,
    interface: extractStatusField(item, ['interface', 'interface-name', 'interface_name']) || 'unknown',
    ip: extractStatusField(item, ['ip', 'address']) || 'Unavailable',
    mac: extractStatusField(item, ['mac', 'mac-address', 'mac_address']) || 'Unavailable',
    hostname: derivedHostname,
    status: extractStatusField(item, ['status', 'state']) || 'leased',
    expiresAt: toIsoFromEpochSeconds(item?.expires || item?.expire || item?.lease_expire),
  };
};

const mapFortiGateHaStatus = (haConfigPayload, haChecksPayload, statusPayload) => {
  const haConfig = Array.isArray(haConfigPayload?.results) ? haConfigPayload.results[0] ?? {} : haConfigPayload?.results ?? {};
  const haChecks = Array.isArray(haChecksPayload?.results) ? haChecksPayload.results[0] ?? {} : haChecksPayload?.results ?? {};
  const peers = Array.isArray(haChecks?.peers)
    ? haChecks.peers.map((peer) => extractStatusField(peer, ['hostname', 'serial', 'name']) || 'Peer').filter(Boolean)
    : [];
  const mode =
    extractStatusField(haChecks, ['mode']) ||
    extractStatusField(haConfig, ['mode']) ||
    extractFromStatusPayload(statusPayload, ['ha_mode']) ||
    'standalone';
  const role =
    extractStatusField(haChecks, ['role']) ||
    extractFromStatusPayload(statusPayload, ['ha_role']) ||
    (peers.length ? 'member' : 'standalone');
  const state =
    extractStatusField(haChecks, ['status', 'state']) ||
    (mode === 'standalone' ? 'Standalone' : 'Unknown');
  const syncStatus =
    extractStatusField(haChecks, ['sync_status', 'sync-status']) ||
    (peers.length ? 'Peer data present' : 'No peers detected');

  return {
    mode,
    role,
    state,
    clusterName: extractStatusField(haConfig, ['group-name', 'group_name']),
    peerCount: peers.length,
    syncStatus,
    peers,
  };
};

const mapFortiGateDevice = (site, summary, interfaces = [], details = {}) => ({
  id: buildFortiGateId(site.id),
  siteId: site.id,
  siteName: summary.name,
  name: summary.fortigateName || site.fortigate_name || site.name,
  hostname: summary.fortigateName || site.fortigate_name || site.name,
  managementIp: summary.fortigateIp || site.fortigate_ip || '',
  wanIp: summary.wanIp ?? null,
  serial: summary.fortigateSerial ?? null,
  firmware: summary.fortigateVersion ?? null,
  status: summary.status,
  apiReachable: Boolean(summary.apiReachable),
  latencyAvgMs: summary.latencyAvgMs ?? null,
  lastSeen: summary.latencyCheckedAt || new Date().toISOString(),
  addressObjectCount: summary.addressObjectCount ?? 0,
  switchCount: summary.switchCount ?? 0,
  apCount: summary.apCount ?? 0,
  clientCount: summary.clientCount ?? 0,
  configArchiveEnabled: summary.configArchiveEnabled !== false,
  configSummary: [
    `Firmware: ${summary.fortigateVersion || 'Unavailable'}`,
    `Serial: ${summary.fortigateSerial || 'Unavailable'}`,
    `WAN status: ${summary.wanStatus}`,
    `Latency: ${summary.latencyAvgMs !== null && summary.latencyAvgMs !== undefined ? `${summary.latencyAvgMs.toFixed(1)} ms` : 'Unavailable'}`,
    `Config archive: ${summary.configArchiveEnabled === false ? 'disabled' : 'enabled'}`,
  ],
  interfaces,
  vpns: details.vpns ?? [],
  policies: details.policies ?? [],
  dhcpLeases: details.dhcpLeases ?? [],
  haStatus:
    details.haStatus ?? {
      mode: 'standalone',
      role: 'standalone',
      state: 'Standalone',
      peerCount: 0,
      syncStatus: 'No peers detected',
      peers: [],
    },
  lastSyncError: summary.lastSyncError ?? null,
});

export const createFortiGateClient = ({ siteStore, vendorLookupService }) => ({
  async summarizeSite(site, { forceLatency = false } = {}) {
    let workingSite = site;
    if (site.fortigate_ip && (forceLatency || shouldRefreshLatency(site))) {
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
      const fortiGateModel = inferFortiGateModel(statusPayload, workingSite);
      const rawAccessPoints =
        accessPointResult.status === 'fulfilled' && Array.isArray(accessPointResult.value.results) ? accessPointResult.value.results : [];
      const externalApCount = filterStandaloneAccessPoints({
        site: workingSite,
        statusPayload,
        accessPoints: rawAccessPoints,
      }).length;
      const apCount = externalApCount + (isFortiWifiModel(fortiGateModel) ? 1 : 0);
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

  async listFortiGatesForSite(site) {
    if (!site?.fortigate_ip || !site?.fortigate_api_key) {
      return [];
    }

    const [summary, interfacesPayload] = await Promise.all([
      this.summarizeSite(site),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/system/interface`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
    ]);

    const interfaces = Array.isArray(interfacesPayload.results)
      ? interfacesPayload.results.map((item) => mapFortiGateInterface(site.id, item))
      : [];

    return [mapFortiGateDevice(site, summary, interfaces)];
  },

  async getFortiGateDetailForSite(site, fortiGateId) {
    if (!site?.fortigate_ip || !site?.fortigate_api_key) {
      return null;
    }

    if (fortiGateId !== buildFortiGateId(site.id)) {
      return null;
    }

    const [summary, interfacesPayload, statusPayload, addressPayload, vpnPhase1Payload, vpnPhase2Payload, vpnMonitorPayload, policyPayload, dhcpPayload, haConfigPayload, haChecksPayload] = await Promise.all([
      this.summarizeSite(site),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/system/interface`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/system/status`,
        site.fortigate_api_key,
      ).catch(() => ({})),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/firewall/address`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/vpn.ipsec/phase1-interface`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/vpn.ipsec/phase2-interface`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/vpn/ipsec`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/firewall/policy`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/system/dhcp`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/system/ha`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/system/ha-checks`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
    ]);

    const interfaces = Array.isArray(interfacesPayload.results)
      ? interfacesPayload.results.map((item) => mapFortiGateInterface(site.id, item))
      : [];
    const addressCount = Array.isArray(addressPayload.results)
      ? addressPayload.results.length
      : summary.addressObjectCount ?? 0;

    const runtimeHostname =
      extractFromStatusPayload(statusPayload, ['hostname', 'host-name', 'name']) ||
      summary.fortigateName ||
      site.fortigate_name ||
      site.name;
    const runtimeVersion =
      extractFromStatusPayload(statusPayload, ['version', 'firmware-version']) ||
      summary.fortigateVersion ||
      null;
    const runtimeSerial =
      extractFromStatusPayload(statusPayload, ['serial', 'serial-number']) ||
      summary.fortigateSerial ||
      null;
    const phase1Items = Array.isArray(vpnPhase1Payload.results) ? vpnPhase1Payload.results : [];
    const phase2Items = Array.isArray(vpnPhase2Payload.results) ? vpnPhase2Payload.results : [];
    const vpnMonitorItems = Array.isArray(vpnMonitorPayload.results) ? vpnMonitorPayload.results : [];
    const policies = (Array.isArray(policyPayload.results) ? policyPayload.results : [])
      .map((item) => mapFortiGatePolicy(site.id, item))
      .sort((left, right) => left.sequence - right.sequence)
      .slice(0, 50);
    const dhcpLeases = await Promise.all(
      (Array.isArray(dhcpPayload.results) ? dhcpPayload.results : []).map(async (item) => {
        const shouldLookupVendor =
          vendorLookupService &&
          isPlaceholderIdentity(extractStatusField(item, ['hostname', 'host-name', 'client-hostname', 'client_hostname'])) &&
          String(extractStatusField(item, ['mac', 'mac-address', 'mac_address']) || '').trim();

        const resolvedVendor = shouldLookupVendor
          ? await vendorLookupService
              .lookupByMac(String(extractStatusField(item, ['mac', 'mac-address', 'mac_address']) || ''))
              .catch(() => null)
          : null;

        return mapFortiGateDhcpLease(site.id, item, resolvedVendor);
      }),
    );
    const sortedDhcpLeases = dhcpLeases
      .sort((left, right) => left.interface.localeCompare(right.interface) || left.ip.localeCompare(right.ip))
      .slice(0, 100);
    const vpnStatusMap = new Map(
      vpnMonitorItems.map((item) => [extractStatusField(item, ['name']) || '', item]),
    );
    const vpns = phase1Items.map((item) => {
      const name = extractStatusField(item, ['name', 'q_origin_key']) || '';
      const phase2Count = phase2Items.filter((phase2) => extractStatusField(phase2, ['phase1name']) === name).length;
      return mapFortiGateVpn(site.id, item, phase2Count, vpnStatusMap.get(name) ?? null);
    });
    const haStatus = mapFortiGateHaStatus(haConfigPayload, haChecksPayload, statusPayload);

    return mapFortiGateDevice(
      site,
      {
        ...summary,
        fortigateName: runtimeHostname,
        fortigateVersion: runtimeVersion,
        fortigateSerial: runtimeSerial,
        addressObjectCount: addressCount,
      },
      interfaces,
      {
        vpns,
        policies,
        dhcpLeases: sortedDhcpLeases,
        haStatus,
      },
    );
  },

  async listManagedSwitchesForSite(site) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const [payload, switchStatusPayload] = await Promise.all([
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`,
        site.fortigate_api_key,
      ),
      getCachedSwitchStatus(site, site.fortigate_api_key).catch(() => ({ results: [] })),
    ]);

    const switches = Array.isArray(payload.results) ? payload.results : [];
    const switchStatuses = Array.isArray(switchStatusPayload.results) ? switchStatusPayload.results : [];
    const runtimeMap = new Map(
      switchStatuses.map((entry) => [extractStatusField(entry, ['switch-id', 'serial']) || '', entry]),
    );
    return switches.map((item) => {
      const serial = extractStatusField(item, ['sn', 'serial', 'switch-id']) || 'unknown-switch';
      return mapManagedSwitch(site, item, {}, [], runtimeMap.get(serial) ?? null);
    });
  },

  async getManagedSwitchDetailForSite(site, switchId) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
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
    const [statsPayload, switchStatusPayload] = await Promise.all([
      getCachedSwitchStats(site, serial, site.fortigate_api_key).catch(() => null),
      getCachedSwitchStatus(site, site.fortigate_api_key).catch(() => ({ results: [] })),
    ]);
    const statsByPort =
      Array.isArray(statsPayload?.results) && statsPayload.results[0]?.ports ? statsPayload.results[0].ports : {};
    const resolvedSwitchId = buildSwitchId(site.id, serial);
    const portOverrides = await siteStore.listSwitchPortOverrides(resolvedSwitchId).catch(() => []);
    const switchStatuses = Array.isArray(switchStatusPayload.results) ? switchStatusPayload.results : [];
    const runtimeStatus =
      switchStatuses.find((entry) => (extractStatusField(entry, ['switch-id', 'serial']) || '') === serial) ?? null;

    return mapManagedSwitch(site, item, statsByPort, portOverrides, runtimeStatus);
  },

  async listManagedSwitchVlansForSite(site, switchId) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const [interfacesPayload, switchPayload] = await Promise.all([
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/system/interface`,
        site.fortigate_api_key,
      ).catch(() => ({ results: [] })),
      requestJson(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`,
        site.fortigate_api_key,
      ),
    ]);

    const interfaces = Array.isArray(interfacesPayload.results) ? interfacesPayload.results : [];
    const interfaceOptions = interfaces
      .filter((item) => isFortiLinkVlanInterface(item))
      .map(mapSwitchVlanOption);

    const switches = Array.isArray(switchPayload.results) ? switchPayload.results : [];
    const switchItem = switches.find(
      (candidate) => buildSwitchId(site.id, extractStatusField(candidate, ['sn', 'serial', 'switch-id']) || 'unknown-switch') === switchId,
    );

    const currentPortVlans = Array.isArray(switchItem?.ports)
      ? switchItem.ports
          .flatMap((port) => [
            normalizeSwitchPortVlanName(port?.vlan),
            ...(Array.isArray(port?.['untagged-vlans']) ? port['untagged-vlans'].map((entry) => normalizeSwitchPortVlanName(entry)) : []),
            ...(Array.isArray(port?.['allowed-vlans']) ? port['allowed-vlans'].map((entry) => normalizeSwitchPortVlanName(entry)) : []),
          ])
          .filter(Boolean)
          .map((name) => ({ name, vlanId: null, interfaceName: null }))
      : [];

    return dedupeSwitchVlanOptions([...interfaceOptions, ...currentPortVlans]);
  },

  async updateManagedSwitchPortSettings(site, switchId, portNumber, settings = {}) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      throw new Error('FortiGate IP or API key is missing for this site.');
    }

    const payload = await requestJson(
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`,
      site.fortigate_api_key,
    );

    const switches = Array.isArray(payload.results) ? payload.results : [];
    const item = switches.find(
      (candidate) => buildSwitchId(site.id, extractStatusField(candidate, ['sn', 'serial', 'switch-id']) || 'unknown-switch') === switchId,
    );

    if (!item) {
      throw new Error('Switch not found in the live FortiGate inventory.');
    }

    const serial = extractStatusField(item, ['sn', 'serial', 'switch-id']) || 'unknown-switch';
    const normalizedPortNumber = normalizeManagedSwitchPortName(portNumber);
    const port = Array.isArray(item.ports)
      ? item.ports.find((candidate) => normalizeManagedSwitchPortName(candidate?.['port-name']) === normalizedPortNumber)
      : null;

    if (!port) {
      throw new Error('Port not found on the selected switch.');
    }

    const currentVlan = normalizeSwitchPortVlanName(port.vlan);
    const currentEnabled = inferPortAdminEnabled(null, port, null);
    const currentPoeEnabled = inferPoeEnabled(null, port);
    const requestedVlan = typeof settings.vlan === 'string' ? settings.vlan.trim() : currentVlan;
    const requestedEnabled = typeof settings.enabled === 'boolean' ? settings.enabled : currentEnabled;
    const requestedPoeEnabled = typeof settings.poeEnabled === 'boolean' ? settings.poeEnabled : currentPoeEnabled;

    if (requestedVlan === currentVlan && requestedEnabled === currentEnabled && requestedPoeEnabled === currentPoeEnabled) {
      return {
        changed: false,
        verified: true,
        portName: normalizedPortNumber,
        current: {
          vlan: currentVlan || requestedVlan,
          enabled: currentEnabled,
          poeEnabled: currentPoeEnabled,
        },
      };
    }

    const vdom = encodeURIComponent(extractStatusField(item, ['vdom']) || resolveSiteVdom(site));
    const patchBody = {
      ...port,
      'port-name': normalizedPortNumber,
      q_origin_key: normalizedPortNumber,
      'switch-id': serial,
      status: requestedEnabled ? 'up' : 'down',
      'poe-status': requestedPoeEnabled ? 'enable' : 'disable',
      vlan: toFortiGateInterfaceReference(requestedVlan, 'name'),
      'allowed-vlans-all': port['allowed-vlans-all'] || 'disable',
      'allowed-vlans': normalizeFortiGateInterfaceReferenceList(port['allowed-vlans'], 'vlan-name'),
      'untagged-vlans': normalizeFortiGateInterfaceReferenceList(port['untagged-vlans'], 'vlan-name'),
    };

    try {
      await requestFortiGate(
        `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch/${encodeURIComponent(serial)}/ports/${encodeURIComponent(normalizedPortNumber)}?vdom=${vdom}`,
        site.fortigate_api_key,
        {
          method: 'PUT',
          body: patchBody,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown FortiGate error';
      throw new Error(`Unable to update the FortiGate switch port settings. FortiGate rejected the UI-shaped port update: ${message}.`);
    }

    invalidateSwitchCaches(site, serial);

    const verificationPayload = await requestJson(
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/switch-controller/managed-switch`,
      site.fortigate_api_key,
    );

    const verificationSwitches = Array.isArray(verificationPayload.results) ? verificationPayload.results : [];
    const verifiedSwitch = verificationSwitches.find(
      (candidate) => buildSwitchId(site.id, extractStatusField(candidate, ['sn', 'serial', 'switch-id']) || 'unknown-switch') === switchId,
    );
    const verifiedPort = Array.isArray(verifiedSwitch?.ports)
      ? verifiedSwitch.ports.find((candidate) => normalizeManagedSwitchPortName(candidate?.['port-name']) === normalizedPortNumber)
      : null;
    const verifiedVlan = normalizeSwitchPortVlanName(verifiedPort?.vlan);
    const verifiedEnabled = inferPortAdminEnabled(null, verifiedPort, null);
    const verifiedPoeEnabled = inferPoeEnabled(null, verifiedPort);
    const verified =
      verifiedVlan === requestedVlan &&
      verifiedEnabled === requestedEnabled &&
      verifiedPoeEnabled === requestedPoeEnabled;

    return {
      changed: true,
      verified,
      portName: normalizedPortNumber,
      current: {
        vlan: verifiedVlan || currentVlan,
        enabled: verifiedEnabled,
        poeEnabled: verifiedPoeEnabled,
      },
      requested: {
        vlan: requestedVlan,
        enabled: requestedEnabled,
        poeEnabled: requestedPoeEnabled,
      },
    };
  },

  async listManagedAccessPointsForSite(site) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const [wtpResult, clientsResult, managedApStatusResult, statusResult] = await Promise.allSettled([
      requestJson(`${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/wireless-controller/wtp`, site.fortigate_api_key),
      getCachedWirelessClients(site, site.fortigate_api_key),
      getCachedManagedApStatus(site, site.fortigate_api_key),
      requestJson(`${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/system/status`, site.fortigate_api_key),
    ]);

    const rawAccessPoints = wtpResult.status === 'fulfilled' && Array.isArray(wtpResult.value.results) ? wtpResult.value.results : [];
    const clients = clientsResult.status === 'fulfilled' && Array.isArray(clientsResult.value.results) ? clientsResult.value.results : [];
    const managedApStatuses =
      managedApStatusResult.status === 'fulfilled' && Array.isArray(managedApStatusResult.value.results)
        ? managedApStatusResult.value.results
        : [];
    const statusPayload = statusResult.status === 'fulfilled' ? statusResult.value : null;
    const accessPoints = filterStandaloneAccessPoints({
      site,
      statusPayload,
      accessPoints: rawAccessPoints,
    });
    const runtimeMap = new Map(
      managedApStatuses.map((entry) => [extractStatusField(entry, ['wtp_id', 'serial']) || '', entry]),
    );
    const apNames = accessPoints
      .map((item) => extractStatusField(item, ['name', 'location']))
      .filter(Boolean);
    const mappedAccessPoints = accessPoints.map((item) =>
      mapManagedAccessPoint(
        site,
        item,
        clients.filter((client) => client.wtp_id === item['wtp-id']),
        apNames,
        runtimeMap.get(extractStatusField(item, ['wtp-id', 'serial']) || '') ?? null,
      ),
    );

    return appendIntegratedAccessPointIfNeeded({
      site,
      statusPayload,
      accessPoints,
      clients,
      managedApStatuses,
    }).map((item) =>
      'siteId' in item
        ? item
        : mapManagedAccessPoint(
            site,
            item,
            clients.filter((client) => client.wtp_id === item['wtp-id']),
            apNames,
            runtimeMap.get(extractStatusField(item, ['wtp-id', 'serial']) || '') ?? null,
          ),
    );
  },

  async listRogueAccessPointsForSite(site) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const payload = await requestJson(
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/wireless-controller/ap-status`,
      site.fortigate_api_key,
    );

    const entries = Array.isArray(payload.results) ? payload.results : [];
    return entries.map((item) => ({
      id: buildRogueApId(site.id, item.bssid || '', item.ssid || ''),
      siteId: site.id,
      ssid: item.ssid || 'Unknown SSID',
      bssid: item.bssid || 'Unknown BSSID',
      status: ['rogue', 'accepted', 'suppressed'].includes(String(item.status || '').toLowerCase())
        ? String(item.status).toLowerCase()
        : 'unknown',
      detectedBy: item.ap_name || item.detected_by || undefined,
      vendor: item.vendor || item.vendor_info || undefined,
    }));
  },

  async getManagedAccessPointDetailForSite(site, accessPointId) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      return null;
    }

    const [wtpResult, clientsResult, managedApStatusResult, statusResult] = await Promise.allSettled([
      requestJson(`${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/cmdb/wireless-controller/wtp`, site.fortigate_api_key),
      getCachedWirelessClients(site, site.fortigate_api_key),
      getCachedManagedApStatus(site, site.fortigate_api_key),
      requestJson(`${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/system/status`, site.fortigate_api_key),
    ]);

    const rawAccessPoints = wtpResult.status === 'fulfilled' && Array.isArray(wtpResult.value.results) ? wtpResult.value.results : [];
    const clients = clientsResult.status === 'fulfilled' && Array.isArray(clientsResult.value.results) ? clientsResult.value.results : [];
    const managedApStatuses =
      managedApStatusResult.status === 'fulfilled' && Array.isArray(managedApStatusResult.value.results)
        ? managedApStatusResult.value.results
        : [];
    const statusPayload = statusResult.status === 'fulfilled' ? statusResult.value : null;
    const accessPoints = filterStandaloneAccessPoints({
      site,
      statusPayload,
      accessPoints: rawAccessPoints,
    });

    const apNames = accessPoints
      .map((candidate) => extractStatusField(candidate, ['name', 'location']))
      .filter(Boolean);
    const runtimeMap = new Map(
      managedApStatuses.map((entry) => [extractStatusField(entry, ['wtp_id', 'serial']) || '', entry]),
    );
    const mappedAccessPoints = accessPoints.map((item) =>
      mapManagedAccessPoint(
        site,
        item,
        clients.filter((client) => client.wtp_id === item['wtp-id']),
        apNames,
        runtimeMap.get(extractStatusField(item, ['wtp-id', 'serial']) || '') ?? null,
      ),
    );
    const combinedAccessPoints = [
      ...mappedAccessPoints,
      ...appendIntegratedAccessPointIfNeeded({
        site,
        statusPayload,
        accessPoints,
        clients,
        managedApStatuses,
      }).filter((item) => 'siteId' in item),
    ];

    return combinedAccessPoints.find((candidate) => candidate.id === accessPointId) ?? null;
  },

  async listClientsForSite(site) {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      return [];
    }

    const payload = await requestJson(
      `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/user/device/query`,
      site.fortigate_api_key,
    );

    const devices = Array.isArray(payload.results) ? payload.results : [];
    const filteredDevices = devices.filter((item) => !isInfrastructureDevice(item));

    return Promise.all(
      filteredDevices.map(async (item) => {
        const shouldLookupVendor =
          vendorLookupService &&
          isPlaceholderIdentity(item.hostname) &&
          isPlaceholderIdentity(item.hardware_vendor) &&
          String(item.mac || item.master_mac || '').trim();

        const resolvedVendor = shouldLookupVendor
          ? await vendorLookupService.lookupByMac(String(item.mac || item.master_mac || '')).catch(() => null)
          : null;

        return mapManagedClient(site, item, resolvedVendor);
      }),
    );
  },
});
