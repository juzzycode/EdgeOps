import type {
  AccessPoint,
  Alert,
  BandwidthPoint,
  Client,
  DeviceProfile,
  EventLog,
  FirmwareStatus,
  PortProfile,
  Site,
  SwitchPort,
  SwitchDevice,
  VLANProfile,
} from '@/types/models';

export const sites: Site[] = [
  { id: 'site-aus', name: 'Austin HQ', address: '701 Congress Ave, Austin, TX', timezone: 'America/Chicago', region: 'Central', status: 'healthy', wanStatus: 'online', clientCount: 214, switchCount: 8, apCount: 12 },
  { id: 'site-den', name: 'Denver Branch', address: '1801 California St, Denver, CO', timezone: 'America/Denver', region: 'Mountain', status: 'warning', wanStatus: 'degraded', clientCount: 97, switchCount: 4, apCount: 6 },
  { id: 'site-rdu', name: 'Raleigh Lab', address: '4242 Six Forks Rd, Raleigh, NC', timezone: 'America/New_York', region: 'East', status: 'critical', wanStatus: 'online', clientCount: 58, switchCount: 3, apCount: 4 },
  { id: 'site-sea', name: 'Seattle Warehouse', address: '301 Elliott Ave W, Seattle, WA', timezone: 'America/Los_Angeles', region: 'West', status: 'offline', wanStatus: 'offline', clientCount: 22, switchCount: 2, apCount: 3 },
];

const switchPorts = (prefix: string): SwitchPort[] =>
  Array.from({ length: 12 }).map((_, index) => ({
    id: `${prefix}-port-${index + 1}`,
    portNumber: `${index + 1}`,
    status: (index % 7 === 0 ? 'warning' : index % 5 === 0 ? 'disabled' : index % 4 === 0 ? 'down' : 'up') as SwitchPort['status'],
    speed: index < 10 ? '1G' : '10G',
    poeWatts: index % 3 === 0 ? 8 + index : 0,
    vlan: index % 2 === 0 ? 'Corp-Data' : 'Voice-Edge',
    description: index % 3 === 0 ? `Desk-${index + 10}` : `Access-${index + 1}`,
    profileId: index % 2 === 0 ? 'port-access' : 'port-voice',
    clientCount: index % 3 === 0 ? 1 : 0,
    neighbor: index > 9 ? `Core-${index - 9}` : undefined,
  }));

export const switches: SwitchDevice[] = [
  { id: 'sw-aus-core-1', hostname: 'AUS-CORE-01', model: 'EOS-48P-X', serial: 'EO48PX9A1021', siteId: 'site-aus', status: 'healthy', firmware: '12.4.2', targetFirmware: '12.4.2', portsUsed: 38, totalPorts: 48, poeUsageWatts: 412, poeBudgetWatts: 740, uplinkStatus: 'up', lastSeen: '2026-03-21T15:14:00Z', managementIp: '10.10.0.11', profileId: 'switch-campus-standard', stackRole: 'core', configSummary: ['MST enabled', 'Voice VLAN auto-assignment', 'SNMP v3', 'Storm control policy: default'], ports: switchPorts('sw-aus-core-1') },
  { id: 'sw-aus-idf-2', hostname: 'AUS-IDF-02', model: 'EOS-24P', serial: 'EO24P6Z8122', siteId: 'site-aus', status: 'warning', firmware: '12.3.9', targetFirmware: '12.4.2', portsUsed: 18, totalPorts: 24, poeUsageWatts: 165, poeBudgetWatts: 370, uplinkStatus: 'degraded', lastSeen: '2026-03-21T15:10:00Z', managementIp: '10.10.0.22', profileId: 'switch-campus-standard', stackRole: 'member', configSummary: ['Loop guard enabled', 'QoS profile: office', 'Mgmt ACL locked'], ports: switchPorts('sw-aus-idf-2') },
  { id: 'sw-den-core-1', hostname: 'DEN-CORE-01', model: 'EOS-48F', serial: 'EO48F7K2109', siteId: 'site-den', status: 'healthy', firmware: '12.4.2', targetFirmware: '12.4.2', portsUsed: 26, totalPorts: 48, poeUsageWatts: 0, poeBudgetWatts: 0, uplinkStatus: 'up', lastSeen: '2026-03-21T15:16:00Z', managementIp: '10.20.0.10', profileId: 'switch-aggregation', stackRole: 'standalone', configSummary: ['LACP uplinks active', 'Trunk to firewall', 'Syslog profile attached'], ports: switchPorts('sw-den-core-1') },
  { id: 'sw-sea-edge-1', hostname: 'SEA-EDGE-01', model: 'EOS-24P', serial: 'EO24PQ2R0111', siteId: 'site-sea', status: 'offline', firmware: '12.2.1', targetFirmware: '12.4.2', portsUsed: 10, totalPorts: 24, poeUsageWatts: 94, poeBudgetWatts: 370, uplinkStatus: 'down', lastSeen: '2026-03-21T13:42:00Z', managementIp: '10.40.0.15', profileId: 'switch-warehouse', stackRole: 'standalone', configSummary: ['Offline since WAN flap', 'Fallback config applied last sync'], ports: switchPorts('sw-sea-edge-1') },
];

export const accessPoints: AccessPoint[] = [
  { id: 'ap-aus-l1-01', name: 'AUS-L1-AP-01', model: 'AirPoint 640', serial: 'AP640A11290', siteId: 'site-aus', status: 'healthy', firmware: '8.9.1', targetFirmware: '8.9.1', clients: 42, radios: [{ id: 'r1', band: '2.4 GHz', channel: 1, txPower: '14 dBm', utilization: 42, status: 'up' }, { id: 'r2', band: '5 GHz', channel: 44, txPower: '17 dBm', utilization: 61, status: 'up' }], ip: '10.10.5.21', lastSeen: '2026-03-21T15:15:00Z', profileId: 'ap-office-standard', ssids: [{ id: 'ssid-corp', name: 'EdgeOps Corp', vlan: 'Corp-Data', authMode: 'WPA3-Enterprise', clientCount: 31 }, { id: 'ssid-guest', name: 'EdgeOps Guest', vlan: 'Guest', authMode: 'WPA2/WPA3', clientCount: 11 }], configSummary: ['Band steering enabled', 'Min RSSI policy active', 'Fast roaming enabled'], neighborAps: ['AUS-L1-AP-02', 'AUS-L2-AP-01'] },
  { id: 'ap-den-conf-02', name: 'DEN-CONF-AP-02', model: 'AirPoint 620', serial: 'AP620D33381', siteId: 'site-den', status: 'warning', firmware: '8.8.5', targetFirmware: '8.9.1', clients: 26, radios: [{ id: 'r1', band: '2.4 GHz', channel: 11, txPower: '13 dBm', utilization: 74, status: 'up' }, { id: 'r2', band: '5 GHz', channel: 149, txPower: '15 dBm', utilization: 81, status: 'up' }], ip: '10.20.5.33', lastSeen: '2026-03-21T15:11:00Z', profileId: 'ap-office-standard', ssids: [{ id: 'ssid-corp', name: 'EdgeOps Corp', vlan: 'Corp-Data', authMode: 'WPA3-Enterprise', clientCount: 18 }, { id: 'ssid-guest', name: 'EdgeOps Guest', vlan: 'Guest', authMode: 'WPA2/WPA3', clientCount: 8 }], configSummary: ['Auto channel failed over once', 'DFS event count elevated'], neighborAps: ['DEN-CONF-AP-01', 'DEN-OPEN-AP-03'] },
  { id: 'ap-rdu-lab-01', name: 'RDU-LAB-AP-01', model: 'AirPoint 650E', serial: 'AP650E21201', siteId: 'site-rdu', status: 'critical', firmware: '8.7.9', targetFirmware: '8.9.1', clients: 11, radios: [{ id: 'r1', band: '2.4 GHz', channel: 6, txPower: '12 dBm', utilization: 89, status: 'up' }, { id: 'r2', band: '5 GHz', channel: 36, txPower: '16 dBm', utilization: 91, status: 'up' }, { id: 'r3', band: '6 GHz', channel: 5, txPower: '14 dBm', utilization: 37, status: 'down' }], ip: '10.30.8.21', lastSeen: '2026-03-21T15:08:00Z', profileId: 'ap-lab-high-density', ssids: [{ id: 'ssid-lab', name: 'EdgeOps Lab', vlan: 'Lab', authMode: 'WPA3-Enterprise', clientCount: 11 }], configSummary: ['6 GHz radio disabled pending site survey', 'Rogue containment placeholder enabled'], neighborAps: ['RDU-LAB-AP-02'] },
  { id: 'ap-sea-wh-01', name: 'SEA-WH-AP-01', model: 'AirPoint 620', serial: 'AP620S11299', siteId: 'site-sea', status: 'offline', firmware: '8.8.1', targetFirmware: '8.9.1', clients: 0, radios: [{ id: 'r1', band: '2.4 GHz', channel: 1, txPower: '12 dBm', utilization: 0, status: 'down' }, { id: 'r2', band: '5 GHz', channel: 40, txPower: '15 dBm', utilization: 0, status: 'down' }], ip: '10.40.6.10', lastSeen: '2026-03-21T13:40:00Z', profileId: 'ap-warehouse', ssids: [{ id: 'ssid-scanner', name: 'ScannerNet', vlan: 'Operations', authMode: 'WPA2-PSK', clientCount: 0 }], configSummary: ['Waiting for site connectivity restore'], neighborAps: [] },
];

export const clients: Client[] = [
  { id: 'client-1', name: 'Olivia-MBP', username: 'olivia', connectionType: 'wireless', ip: '10.10.5.101', mac: 'A4:11:3C:91:2F:09', network: 'EdgeOps Corp', connectedDeviceId: 'ap-aus-l1-01', connectedDeviceType: 'ap', siteId: 'site-aus', usageGb: 18.4, status: 'active', lastSeen: '2026-03-21T15:15:00Z' },
  { id: 'client-2', name: 'ConfRoom-Nuc', username: 'shared', connectionType: 'wired', ip: '10.20.0.88', mac: '70:4D:7B:28:90:AB', network: 'Corp-Data', connectedDeviceId: 'sw-den-core-1', connectedDeviceType: 'switch', siteId: 'site-den', usageGb: 6.9, status: 'active', lastSeen: '2026-03-21T15:12:00Z' },
  { id: 'client-3', name: 'Barcode-Scanner-12', username: 'ops', connectionType: 'wireless', ip: '10.40.6.55', mac: '44:19:B6:AF:11:0C', network: 'ScannerNet', connectedDeviceId: 'ap-sea-wh-01', connectedDeviceType: 'ap', siteId: 'site-sea', usageGb: 1.2, status: 'idle', lastSeen: '2026-03-21T13:37:00Z' },
  { id: 'client-4', name: 'Lab-Sensor-Hub', username: 'iot', connectionType: 'wired', ip: '10.10.0.121', mac: '9C:2E:7D:63:CC:19', network: 'Lab', connectedDeviceId: 'sw-aus-idf-2', connectedDeviceType: 'switch', siteId: 'site-aus', usageGb: 42.7, status: 'blocked', lastSeen: '2026-03-21T15:02:00Z' },
];

export const alerts: Alert[] = [
  { id: 'alert-1', severity: 'critical', type: 'device offline', title: 'Seattle warehouse edge switch offline', description: 'The switch stopped checking in after upstream WAN loss. Last successful heartbeat was 1h 34m ago.', siteId: 'site-sea', deviceId: 'sw-sea-edge-1', deviceType: 'switch', timestamp: '2026-03-21T14:02:00Z', acknowledged: false },
  { id: 'alert-2', severity: 'warning', type: 'PoE overload', title: 'AUS-IDF-02 nearing PoE budget', description: 'PoE draw is above 85% of available power budget. Review recently connected devices.', siteId: 'site-aus', deviceId: 'sw-aus-idf-2', deviceType: 'switch', timestamp: '2026-03-21T15:01:00Z', acknowledged: true },
  { id: 'alert-3', severity: 'warning', type: 'AP high channel utilization', title: 'DEN conference AP channel utilization elevated', description: '5 GHz utilization has remained above 80% for 20 minutes. Consider power or channel adjustment.', siteId: 'site-den', deviceId: 'ap-den-conf-02', deviceType: 'ap', timestamp: '2026-03-21T14:48:00Z', acknowledged: false },
  { id: 'alert-4', severity: 'info', type: 'firmware mismatch', title: 'RDU lab AP pending firmware target', description: 'AP firmware is below target release. Device remains eligible for next staged rollout.', siteId: 'site-rdu', deviceId: 'ap-rdu-lab-01', deviceType: 'ap', timestamp: '2026-03-21T13:15:00Z', acknowledged: false },
];

export const firmwareStatuses: FirmwareStatus[] = [
  ...switches.map((device): FirmwareStatus => ({
    id: `fw-${device.id}`,
    deviceType: 'switch',
    deviceId: device.id,
    current: device.firmware,
    target: device.targetFirmware,
    compliance: device.firmware === device.targetFirmware ? 'compliant' : device.status === 'offline' ? 'blocked' : 'pending',
    eligible: device.status !== 'offline',
    rolloutGroup: device.siteId === 'site-aus' ? 'Wave A' : 'Wave B',
  })),
  ...accessPoints.map((device): FirmwareStatus => ({
    id: `fw-${device.id}`,
    deviceType: 'ap',
    deviceId: device.id,
    current: device.firmware,
    target: device.targetFirmware,
    compliance: device.firmware === device.targetFirmware ? 'compliant' : device.status === 'offline' ? 'blocked' : 'pending',
    eligible: device.status !== 'offline',
    rolloutGroup: device.siteId === 'site-aus' ? 'Wave A' : 'Wave C',
  })),
];

export const deviceProfiles: DeviceProfile[] = [
  { id: 'switch-campus-standard', type: 'switch', name: 'Campus Standard', description: 'Baseline access switching profile', assignedCount: 9, version: 'v12' },
  { id: 'switch-aggregation', type: 'switch', name: 'Aggregation Core', description: 'L3 aggregation and uplink policy', assignedCount: 3, version: 'v7' },
  { id: 'switch-warehouse', type: 'switch', name: 'Warehouse Edge', description: 'Durable profile for sparse edge sites', assignedCount: 2, version: 'v4' },
  { id: 'ap-office-standard', type: 'ap', name: 'Office Standard AP', description: 'Balanced office roaming and radio policy', assignedCount: 14, version: 'v18' },
  { id: 'ap-lab-high-density', type: 'ap', name: 'High Density Lab', description: 'Optimized for multi-band test areas', assignedCount: 4, version: 'v9' },
  { id: 'ssid-corp-profile', type: 'ssid', name: 'Corporate WLAN', description: 'Secure employee WLAN profile', assignedCount: 12, version: 'v6' },
];

export const vlanProfiles: VLANProfile[] = [
  { id: 'vlan-corp', name: 'Corp-Data', vlanId: 110, purpose: 'Managed user traffic', qos: 'business-critical' },
  { id: 'vlan-voice', name: 'Voice-Edge', vlanId: 120, purpose: 'VoIP handsets and voice clients', qos: 'real-time' },
  { id: 'vlan-guest', name: 'Guest', vlanId: 210, purpose: 'Internet-only guest access', qos: 'best-effort' },
  { id: 'vlan-lab', name: 'Lab', vlanId: 310, purpose: 'Engineering lab devices', qos: 'assured-forwarding' },
];

export const portProfiles: PortProfile[] = [
  { id: 'port-access', name: 'Access Default', poeMode: 'auto', voiceVlan: 'disabled', accessVlan: 'Corp-Data', stormControl: 'default' },
  { id: 'port-voice', name: 'Voice Ready', poeMode: 'auto', voiceVlan: 'Voice-Edge', accessVlan: 'Corp-Data', stormControl: 'strict' },
  { id: 'port-camera', name: 'Camera Secure', poeMode: 'high-priority', voiceVlan: 'disabled', accessVlan: 'Operations', stormControl: 'strict' },
];

export const eventLogs: EventLog[] = [
  { id: 'ev-1', targetId: 'sw-aus-core-1', targetType: 'switch', timestamp: '2026-03-21T14:40:00Z', actor: 'system', message: 'Config sync completed successfully.', category: 'system' },
  { id: 'ev-2', targetId: 'sw-aus-idf-2', targetType: 'switch', timestamp: '2026-03-21T15:00:00Z', actor: 'automation', message: 'PoE budget warning threshold crossed.', category: 'alert' },
  { id: 'ev-3', targetId: 'ap-den-conf-02', targetType: 'ap', timestamp: '2026-03-21T14:48:00Z', actor: 'rf-engine', message: 'High channel utilization detected on 5 GHz radio.', category: 'alert' },
  { id: 'ev-4', targetId: 'ap-rdu-lab-01', targetType: 'ap', timestamp: '2026-03-21T14:13:00Z', actor: 'netadmin', message: 'Assigned High Density Lab profile.', category: 'config' },
  { id: 'ev-5', targetId: 'site-sea', targetType: 'site', timestamp: '2026-03-21T13:43:00Z', actor: 'wan-monitor', message: 'Site WAN marked offline.', category: 'alert' },
  { id: 'ev-6', targetId: 'client-4', targetType: 'client', timestamp: '2026-03-21T15:02:00Z', actor: 'policy-engine', message: 'Client placed into blocked state due to abnormal traffic profile.', category: 'user' },
];

export const bandwidthUsage: BandwidthPoint[] = [
  { interval: '00:00', inbound: 130, outbound: 88 },
  { interval: '04:00', inbound: 96, outbound: 72 },
  { interval: '08:00', inbound: 212, outbound: 160 },
  { interval: '12:00', inbound: 328, outbound: 214 },
  { interval: '16:00', inbound: 285, outbound: 196 },
  { interval: '20:00', inbound: 188, outbound: 140 },
];
