export type DeviceStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type Severity = 'critical' | 'warning' | 'info';
export type Role = 'super_admin' | 'site_admin' | 'read_only';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  siteId: string | null;
  createdAt: string;
  updatedAt: string;
  passwordChangedAt: string | null;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  user: AuthUser;
}

export interface ManagedUser extends AuthUser {
  siteName?: string | null;
}

export interface SiteConfigSnapshot {
  id: string;
  siteId: string;
  snapshotDate: string;
  status: 'success' | 'failed';
  configSha256: string | null;
  diffSha256: string | null;
  changeSummary: {
    comparedToDate: string | null;
    addedLines: number;
    removedLines: number;
    hasChanges: boolean;
  } | null;
  errorText: string | null;
  fetchedAt: string;
  updatedAt: string;
}

export interface SiteConfigDiff {
  fromSnapshot: SiteConfigSnapshot;
  toSnapshot: SiteConfigSnapshot;
  diffText: string;
  stats: {
    addedLines: number;
    removedLines: number;
    hasChanges: boolean;
  };
}

export interface Site {
  id: string;
  shorthandId?: string;
  name: string;
  address: string;
  timezone: string;
  region: string;
  status: DeviceStatus;
  wanStatus: 'online' | 'degraded' | 'offline';
  clientCount: number;
  switchCount: number;
  apCount: number;
  fortigateName?: string;
  fortigateIp?: string;
  wanIp?: string | null;
  fortigateVersion?: string | null;
  fortigateSerial?: string | null;
  addressObjectCount?: number;
  apiReachable?: boolean;
  lastSyncError?: string | null;
  latencyAvgMs?: number | null;
  latencyMinMs?: number | null;
  latencyMaxMs?: number | null;
  latencyPacketLoss?: number | null;
  latencyCheckedAt?: string | null;
  latencyError?: string | null;
  configArchiveEnabled?: boolean;
  source?: 'live';
}

export interface SwitchPort {
  id: string;
  portNumber: string;
  status: 'up' | 'down' | 'disabled' | 'warning';
  speed: string;
  poeWatts: number;
  poeState?: string;
  vlan: string;
  description: string;
  profileId: string;
  clientCount: number;
  neighbor?: string;
  isTrunk?: boolean;
  isUplink?: boolean;
  tags?: string[];
  uplinkReasons?: string[];
  stats?: SwitchPortStats;
  overrideSource?: 'fortigate' | 'edgeops';
}

export interface SwitchPortStats {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
  crcAlignments: number;
  l3Packets: number;
}

export interface SwitchVlanOption {
  name: string;
  vlanId?: number | null;
  interfaceName?: string | null;
}

export interface SwitchDevice {
  id: string;
  hostname: string;
  model: string;
  serial: string;
  siteId: string;
  status: DeviceStatus;
  firmware: string;
  targetFirmware: string;
  portsUsed: number;
  totalPorts: number;
  poeUsageWatts: number;
  poeBudgetWatts: number;
  uplinkStatus: 'up' | 'degraded' | 'down';
  lastSeen: string;
  managementIp: string;
  profileId: string;
  stackRole: 'standalone' | 'member' | 'core';
  configSummary: string[];
  ports: SwitchPort[];
}

export interface Radio {
  id: string;
  band: '2.4 GHz' | '5 GHz' | '6 GHz';
  channel: number;
  txPower: string;
  utilization: number;
  status: 'up' | 'down';
}

export interface SSID {
  id: string;
  name: string;
  vlan: string;
  authMode: string;
  clientCount: number;
}

export interface AccessPoint {
  id: string;
  name: string;
  model: string;
  serial: string;
  siteId: string;
  status: DeviceStatus;
  firmware: string;
  targetFirmware: string;
  clients: number;
  radios: Radio[];
  ip: string;
  lastSeen: string;
  profileId: string;
  ssids: SSID[];
  configSummary: string[];
  neighborAps: string[];
  clientDevices?: AccessPointClient[];
}

export interface RogueAccessPoint {
  id: string;
  siteId: string;
  ssid: string;
  bssid: string;
  status: 'rogue' | 'accepted' | 'suppressed' | 'unknown';
  detectedBy?: string;
  vendor?: string;
}

export interface AccessPointClient {
  id: string;
  name: string;
  hostname?: string;
  dhcpName?: string;
  ip?: string;
  mac: string;
  ssid: string;
  radioId: string;
  radioType: string;
  signal?: number;
  snr?: number;
  channel?: number;
  manufacturer?: string;
  health?: 'good' | 'fair' | 'poor';
  rxRateMbps?: number;
  txRateMbps?: number;
  retryPercent?: number;
  discardPercent?: number;
  idleSeconds?: number;
  connectedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  username: string;
  connectionType: 'wired' | 'wireless';
  ip: string;
  mac: string;
  network: string;
  connectedDeviceId: string;
  connectedDeviceType: 'switch' | 'ap';
  siteId: string;
  usageGb: number;
  status: 'active' | 'idle' | 'blocked';
  lastSeen: string;
  hostname?: string;
  vendor?: string;
  osName?: string;
  osVersion?: string;
  detectedInterface?: string;
  connectedPort?: string;
  connectedApName?: string;
  vlanId?: number;
  dhcpLeaseStatus?: string;
  connectedAt?: string;
}

export interface Alert {
  id: string;
  severity: Severity;
  type: string;
  title: string;
  description: string;
  siteId: string;
  siteName?: string;
  deviceId?: string;
  deviceType?: 'switch' | 'ap' | 'site';
  deviceName?: string;
  timestamp: string;
  acknowledged: boolean;
  source?: 'live';
  context?: Array<{
    label: string;
    value: string;
  }>;
}

export interface FirmwareStatus {
  id: string;
  deviceType: 'switch' | 'ap';
  deviceId: string;
  deviceName?: string;
  serial?: string;
  siteId?: string;
  siteName?: string;
  current: string;
  target: string;
  compliance: 'compliant' | 'pending' | 'blocked';
  eligible: boolean;
  rolloutGroup: string;
}

export interface DeviceProfile {
  id: string;
  type: 'switch' | 'ap' | 'ssid';
  name: string;
  description: string;
  assignedCount: number;
  version: string;
}

export interface VLANProfile {
  id: string;
  name: string;
  vlanId: number;
  purpose: string;
  qos: string;
}

export interface PortProfile {
  id: string;
  name: string;
  poeMode: string;
  voiceVlan: string;
  accessVlan: string;
  stormControl: string;
}

export interface EventLog {
  id: string;
  targetId: string;
  targetType: 'switch' | 'ap' | 'site' | 'client';
  timestamp: string;
  actor: string;
  message: string;
  category: 'config' | 'system' | 'alert' | 'user';
}

export interface BandwidthPoint {
  interval: string;
  inbound: number;
  outbound: number;
}

export interface SiteHistoryPoint {
  siteId: string;
  observedAt: string;
  status: DeviceStatus;
  wanStatus: 'online' | 'degraded' | 'offline';
  clientCount: number;
  switchCount: number;
  apCount: number;
  addressObjectCount: number;
  latencyAvgMs: number | null;
  latencyPacketLoss: number | null;
  apiReachable: boolean;
  lastSyncError: string | null;
}

export interface DeviceActionRecord {
  id: string;
  siteId: string;
  targetId: string;
  targetType: 'switch' | 'ap' | 'site';
  action: string;
  status: 'queued' | 'completed' | 'manual_required' | 'failed';
  actorUsername: string;
  payload: Record<string, string | boolean>;
  message: string;
  requestedAt: string;
  completedAt: string | null;
  result: Record<string, unknown> | null;
}

export interface TopologyNode {
  id: string;
  type: 'site' | 'switch' | 'ap' | 'client-group';
  label: string;
  status: DeviceStatus;
  siteId: string;
  meta: Record<string, string | number | null>;
  x: number;
  y: number;
}

export interface TopologyEdge {
  id: string;
  from: string;
  to: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  label: string;
}

export interface TopologyGraph {
  generatedAt: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  summary: {
    siteCount: number;
    switchCount: number;
    apCount: number;
    clientGroupCount: number;
  };
}
