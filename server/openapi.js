const examples = {
  apiIndex: {
    name: 'EdgeOps Cloud API',
    version: '1.0.0',
    docs: '/api/docs',
    openApi: '/api/openapi.json',
    routes: {
      health: '/api/health',
      setupStatus: '/api/setup/status',
      setupWizard: '/api/setup/wizard',
      sites: '/api/sites',
      siteDetail: '/api/sites/:id',
      loadDemoSites: '/api/sites/load-demo',
      switches: '/api/switches',
      switchDetail: '/api/switches/:id',
      accessPoints: '/api/aps',
      accessPointDetail: '/api/aps/:id',
      clients: '/api/clients',
      gateways: '/api/gateways',
      gatewayApiKeys: '/api/gateways/:gatewayId/api-keys',
      syncConfig: '/api/gateways/:gatewayId/sync-config',
      configCache: '/api/gateways/:gatewayId/config-cache',
      latestConfigCache: '/api/gateways/:gatewayId/config-cache/latest',
    },
  },
  health: {
    ok: true,
    dbPath: '/app/data/edgeops-cache.sqlite',
  },
  site: {
    id: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
    shorthandId: 'site-den',
    name: 'Denver Branch',
    address: '1801 California St, Denver, CO',
    timezone: 'America/Denver',
    region: 'Mountain',
    status: 'warning',
    wanStatus: 'online',
    clientCount: 0,
    switchCount: 0,
    apCount: 0,
    fortigateName: 'DEN-BRANCH-FGT',
    fortigateIp: '192.0.2.14',
    fortigateVersion: 'v7.4.5',
    fortigateSerial: 'FGT60FTK24000001',
    addressObjectCount: 17,
    apiReachable: true,
    lastSyncError: 'FortiGate API authenticated, but firmware or serial fields were not returned by monitor/system/status.',
    latencyAvgMs: 12.3,
    latencyMinMs: 10.8,
    latencyMaxMs: 16.1,
    latencyPacketLoss: 0,
    latencyCheckedAt: '2026-03-21T20:19:44.112Z',
    latencyError: null,
    source: 'live',
  },
  siteCreateRequest: {
    name: 'Denver Branch',
    address: '1801 California St, Denver, CO',
    timezone: 'America/Denver',
    region: 'Mountain',
    fortigateName: 'DEN-BRANCH-FGT',
    fortigateIp: '192.0.2.14',
    fortigateApiKey: 'replace-with-real-fortigate-key',
    adminUsername: 'admin',
    adminPassword: 'replace-if-needed',
  },
  siteList: {
    sites: [
      {
        id: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
        shorthandId: 'site-den',
        name: 'Denver Branch',
        address: '1801 California St, Denver, CO',
        timezone: 'America/Denver',
        region: 'Mountain',
        status: 'warning',
        wanStatus: 'online',
        clientCount: 0,
        switchCount: 0,
        apCount: 0,
        fortigateName: 'DEN-BRANCH-FGT',
        fortigateIp: '192.0.2.14',
        fortigateVersion: 'v7.4.5',
        fortigateSerial: 'FGT60FTK24000001',
        addressObjectCount: 17,
        apiReachable: true,
        lastSyncError: 'FortiGate API authenticated, but firmware or serial fields were not returned by monitor/system/status.',
        latencyAvgMs: 12.3,
        latencyMinMs: 10.8,
        latencyMaxMs: 16.1,
        latencyPacketLoss: 0,
        latencyCheckedAt: '2026-03-21T20:19:44.112Z',
        latencyError: null,
        source: 'live',
      },
      {
        id: 'site_5367fce5-bf96-4653-8a9b-9f9fdabf9d2e',
        shorthandId: 'site-sea',
        name: 'Seattle Warehouse',
        address: '301 Elliott Ave W, Seattle, WA',
        timezone: 'America/Los_Angeles',
        region: 'West',
        status: 'healthy',
        wanStatus: 'online',
        clientCount: 97,
        switchCount: 4,
        apCount: 6,
        fortigateName: 'Seattle Warehouse FortiGate',
        fortigateIp: '',
        fortigateVersion: null,
        fortigateSerial: null,
        addressObjectCount: 0,
        apiReachable: false,
        lastSyncError: null,
        source: 'demo',
      },
    ],
  },
  managedSwitch: {
    id: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d--S426EFTF21001195',
    hostname: 'S426EFTF21001195',
    model: 'S426EFTF',
    serial: 'S426EFTF21001195',
    siteId: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
    status: 'healthy',
    firmware: 'Managed by FortiGate',
    targetFirmware: 'Managed by FortiGate',
    portsUsed: 30,
    totalPorts: 30,
    poeUsageWatts: 0,
    poeBudgetWatts: 720,
    uplinkStatus: 'up',
    lastSeen: '2026-03-22T01:52:47.408Z',
    managementIp: '',
    profileId: 'default',
    stackRole: 'standalone',
    configSummary: [
      'Switch profile: default',
      'Access profile: default',
      'FortiLink peer: fortilink',
      'Firmware provisioning: disable',
    ],
    ports: [
      {
        id: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d--S426EFTF21001195-port1',
        portNumber: 'port1',
        status: 'up',
        speed: 'auto',
        poeWatts: 0,
        vlan: 'FortiAP',
        description: 'port1',
        profileId: 'default',
        clientCount: 0,
        neighbor: null,
      },
    ],
  },
  managedAccessPoint: {
    id: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d--FP441KTF24014592',
    name: '441k-Hallway',
    model: 'FAP441K',
    serial: 'FP441KTF24014592',
    siteId: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
    status: 'healthy',
    firmware: 'Managed by FortiGate',
    targetFirmware: 'No staged target',
    clients: 12,
    radios: [
      { id: 'radio-1', band: '2.4 GHz', channel: 1, txPower: '27 dBm', utilization: 68, status: 'up' },
      { id: 'radio-2', band: '5 GHz', channel: 44, txPower: '27 dBm', utilization: 44, status: 'up' },
      { id: 'radio-3', band: '6 GHz', channel: 1, txPower: '27 dBm', utilization: 0, status: 'up' },
    ],
    ip: '192.168.60.44',
    lastSeen: '2026-03-22T02:18:00.000Z',
    profileId: 'FAP441K-default',
    ssids: [
      { id: 'FP441KTF24014592-Juz-2.4', name: 'Juz-2.4', vlan: 'FortiGate WLAN', authMode: 'Managed by FortiGate', clientCount: 3 },
      { id: 'FP441KTF24014592-Juzzy-5ghz', name: 'Juzzy-5ghz', vlan: 'FortiGate WLAN', authMode: 'Managed by FortiGate', clientCount: 2 },
    ],
    configSummary: [
      'WTP profile: FAP441K-default',
      'Mode: remote',
      'Region: House',
    ],
    neighborAps: ['432G-Outdoor', '441k-Den', '443k-Garage'],
    clientDevices: [
      {
        id: '04:33:c2:66:72:72',
        name: 'DESKTOP-NEHMJM2',
        hostname: 'DESKTOP-NEHMJM2',
        ip: '192.168.60.42',
        mac: '04:33:c2:66:72:72',
        ssid: 'Juzzy-5ghz',
        radioId: 'radio-2',
        radioType: '802.11ax-5G',
        signal: -69,
        snr: 26,
        channel: 44,
        manufacturer: 'Intel Corporate',
        health: 'fair',
      },
    ],
  },
  managedClient: {
    id: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d--client--04:33:c2:66:72:72',
    name: 'DESKTOP-NEHMJM2',
    username: 'DESKTOP-NEHMJM2',
    connectionType: 'wireless',
    ip: '192.168.60.42',
    mac: '04:33:c2:66:72:72',
    network: 'Juzzy-5ghz',
    connectedDeviceId: '441k-Hallway',
    connectedDeviceType: 'ap',
    siteId: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
    usageGb: 0,
    status: 'active',
    lastSeen: '2026-03-22T03:14:23.000Z',
    hostname: 'DESKTOP-NEHMJM2',
    vendor: 'Intel Corporate',
    osName: 'Windows',
    osVersion: '10/11',
    detectedInterface: 'FortiAP',
    connectedApName: '441k-Hallway',
    vlanId: 60,
    dhcpLeaseStatus: 'leased',
    connectedAt: '2026-03-22T01:05:19.000Z',
  },
  setupStatus: {
    complete: false,
    checks: [
      {
        key: 'username',
        label: 'Username',
        filePath: '/app/data/setup/username.sqlite',
        fileExists: true,
        hasValue: true,
        updatedAt: '2026-03-21T20:12:14.116Z',
      },
      {
        key: 'password',
        label: 'Password',
        filePath: '/app/data/setup/password.sqlite',
        fileExists: false,
        hasValue: false,
        updatedAt: null,
      },
      {
        key: 'fortigateIp',
        label: 'FortiGate IP',
        filePath: '/app/data/setup/fortigate-ip.sqlite',
        fileExists: true,
        hasValue: true,
        updatedAt: '2026-03-21T20:12:14.116Z',
      },
      {
        key: 'fortigateApiKey',
        label: 'FortiGate API Key',
        filePath: '/app/data/setup/fortigate-api-key.sqlite',
        fileExists: true,
        hasValue: true,
        updatedAt: '2026-03-21T20:12:14.116Z',
      },
    ],
  },
  gateway: {
    id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
    name: 'Austin Edge Firewall',
    base_url: 'https://10.0.0.1',
    vendor: 'generic',
    site_name: 'Austin HQ',
    auth_header: 'Authorization',
    config_path: '/api/config/export',
    created_at: '2026-03-21T20:12:14.116Z',
    updated_at: '2026-03-21T20:12:14.116Z',
    api_key_count: 2,
    last_cached_at: '2026-03-21T20:18:20.002Z',
  },
  gatewayCreated: {
    gateway: {
      id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
      name: 'Austin Edge Firewall',
      base_url: 'https://10.0.0.1',
      vendor: 'generic',
      site_name: 'Austin HQ',
      auth_header: 'Authorization',
      config_path: '/api/config/export',
      created_at: '2026-03-21T20:12:14.116Z',
      updated_at: '2026-03-21T20:12:14.116Z',
    },
  },
  gatewayList: {
    gateways: [
      {
        id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
        name: 'Austin Edge Firewall',
        base_url: 'https://10.0.0.1',
        vendor: 'generic',
        site_name: 'Austin HQ',
        auth_header: 'Authorization',
        config_path: '/api/config/export',
        created_at: '2026-03-21T20:12:14.116Z',
        updated_at: '2026-03-21T20:12:14.116Z',
        api_key_count: 2,
        last_cached_at: '2026-03-21T20:18:20.002Z',
      },
    ],
  },
  apiKey: {
    id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
    gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
    name: 'Primary Admin Key',
    created_at: '2026-03-21T20:14:42.442Z',
    last_used_at: '2026-03-21T20:18:18.921Z',
  },
  apiKeyCreated: {
    apiKey: {
      id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
      gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
      name: 'Primary Admin Key',
      created_at: '2026-03-21T20:14:42.442Z',
    },
  },
  apiKeyList: {
    apiKeys: [
      {
        id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
        gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
        name: 'Primary Admin Key',
        created_at: '2026-03-21T20:14:42.442Z',
        last_used_at: '2026-03-21T20:18:18.921Z',
      },
    ],
  },
  cacheEntry: {
    id: 'cfg_9154fef2-8f7f-4512-898a-c4feef88f190',
    gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
    api_key_id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
    status: 'success',
    config_sha256: '4e0ec6ae57e2f8a2fe9f859167dcb0dddaf09caff9dcb8fe441e5888eacbd9c5',
    config_blob: 'config system interface\\n  edit wan1\\n    set ip 203.0.113.10 255.255.255.248\\n  next\\nend',
    metadata_json: '{"requestUrl":"https://10.0.0.1/api/config/export","responseStatus":200,"contentLength":94}',
    error_text: null,
    fetched_at: '2026-03-21T20:18:20.002Z',
  },
  cacheEntryCreated: {
    cacheEntry: {
      id: 'cfg_9154fef2-8f7f-4512-898a-c4feef88f190',
      gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
      api_key_id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
      status: 'success',
      config_sha256: '4e0ec6ae57e2f8a2fe9f859167dcb0dddaf09caff9dcb8fe441e5888eacbd9c5',
      config_blob: 'config system interface\\n  edit wan1\\n    set ip 203.0.113.10 255.255.255.248\\n  next\\nend',
      metadata_json: '{"requestUrl":"https://10.0.0.1/api/config/export","responseStatus":200,"contentLength":94}',
      error_text: null,
      fetched_at: '2026-03-21T20:18:20.002Z',
    },
  },
  cacheEntryList: {
    entries: [
      {
        id: 'cfg_9154fef2-8f7f-4512-898a-c4feef88f190',
        gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
        api_key_id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
        status: 'success',
        config_sha256: '4e0ec6ae57e2f8a2fe9f859167dcb0dddaf09caff9dcb8fe441e5888eacbd9c5',
        metadata_json: '{"requestUrl":"https://10.0.0.1/api/config/export","responseStatus":200,"contentLength":94}',
        error_text: null,
        fetched_at: '2026-03-21T20:18:20.002Z',
      },
    ],
  },
  error: {
    error: 'name and baseUrl are required',
  },
  notFound: {
    error: 'Gateway not found',
  },
  noCache: {
    error: 'No cached config found for this gateway',
  },
};

const components = {
  schemas: {
    SetupCheck: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        label: { type: 'string' },
        filePath: { type: 'string' },
        fileExists: { type: 'boolean' },
        hasValue: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
    SetupStatus: {
      type: 'object',
      properties: {
        complete: { type: 'boolean' },
        checks: {
          type: 'array',
          items: { $ref: '#/components/schemas/SetupCheck' },
        },
      },
      example: examples.setupStatus,
    },
    SetupWizardRequest: {
      type: 'object',
      required: ['username', 'password', 'fortigateIp', 'fortigateApiKey'],
      properties: {
        username: { type: 'string', example: 'admin' },
        password: { type: 'string', example: 'correct-horse-battery-staple' },
        fortigateIp: { type: 'string', example: '192.0.2.10' },
        fortigateApiKey: { type: 'string', example: 'FGT-API-KEY-EXAMPLE' },
      },
    },
    ErrorResponse: {
      type: 'object',
      required: ['error'],
      properties: {
        error: { type: 'string' },
      },
    },
    Site: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        shorthandId: { type: 'string' },
        name: { type: 'string' },
        address: { type: 'string' },
        timezone: { type: 'string' },
        region: { type: 'string' },
        status: { type: 'string', enum: ['healthy', 'warning', 'critical', 'offline'] },
        wanStatus: { type: 'string', enum: ['online', 'degraded', 'offline'] },
        clientCount: { type: 'integer' },
        switchCount: { type: 'integer' },
        apCount: { type: 'integer' },
        fortigateName: { type: 'string', nullable: true },
        fortigateIp: { type: 'string', nullable: true },
        fortigateVersion: { type: 'string', nullable: true },
        fortigateSerial: { type: 'string', nullable: true },
        addressObjectCount: { type: 'integer' },
        apiReachable: { type: 'boolean' },
        lastSyncError: { type: 'string', nullable: true },
        latencyAvgMs: { type: 'number', nullable: true },
        latencyMinMs: { type: 'number', nullable: true },
        latencyMaxMs: { type: 'number', nullable: true },
        latencyPacketLoss: { type: 'number', nullable: true },
        latencyCheckedAt: { type: 'string', format: 'date-time', nullable: true },
        latencyError: { type: 'string', nullable: true },
        source: { type: 'string', enum: ['live', 'demo'] },
      },
      example: examples.site,
    },
    SiteCreateRequest: {
      type: 'object',
      required: ['name', 'address', 'timezone', 'region'],
      properties: {
        name: { type: 'string', example: 'Denver Branch' },
        address: { type: 'string', example: '1801 California St, Denver, CO' },
        timezone: { type: 'string', example: 'America/Denver' },
        region: { type: 'string', example: 'Mountain' },
        fortigateName: { type: 'string', example: 'DEN-BRANCH-FGT' },
        fortigateIp: { type: 'string', example: '192.0.2.14' },
        fortigateApiKey: { type: 'string', example: 'replace-with-real-fortigate-key' },
        adminUsername: { type: 'string', example: 'admin' },
        adminPassword: { type: 'string', example: 'replace-if-needed' },
      },
      example: examples.siteCreateRequest,
    },
    SwitchPort: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        portNumber: { type: 'string' },
        status: { type: 'string', enum: ['up', 'down', 'disabled', 'warning'] },
        speed: { type: 'string' },
        poeWatts: { type: 'number' },
        vlan: { type: 'string' },
        description: { type: 'string' },
        profileId: { type: 'string' },
        clientCount: { type: 'integer' },
        neighbor: { type: 'string', nullable: true },
      },
    },
    SwitchDevice: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        hostname: { type: 'string' },
        model: { type: 'string' },
        serial: { type: 'string' },
        siteId: { type: 'string' },
        status: { type: 'string', enum: ['healthy', 'warning', 'critical', 'offline'] },
        firmware: { type: 'string' },
        targetFirmware: { type: 'string' },
        portsUsed: { type: 'integer' },
        totalPorts: { type: 'integer' },
        poeUsageWatts: { type: 'number' },
        poeBudgetWatts: { type: 'number' },
        uplinkStatus: { type: 'string', enum: ['up', 'degraded', 'down'] },
        lastSeen: { type: 'string', format: 'date-time' },
        managementIp: { type: 'string' },
        profileId: { type: 'string' },
        stackRole: { type: 'string', enum: ['standalone', 'member', 'core'] },
        configSummary: { type: 'array', items: { type: 'string' } },
        ports: { type: 'array', items: { $ref: '#/components/schemas/SwitchPort' } },
      },
      example: examples.managedSwitch,
    },
    Radio: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        band: { type: 'string', enum: ['2.4 GHz', '5 GHz', '6 GHz'] },
        channel: { type: 'integer' },
        txPower: { type: 'string' },
        utilization: { type: 'integer' },
        status: { type: 'string', enum: ['up', 'down'] },
      },
    },
    SSID: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        vlan: { type: 'string' },
        authMode: { type: 'string' },
        clientCount: { type: 'integer' },
      },
    },
    AccessPointClient: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        hostname: { type: 'string', nullable: true },
        ip: { type: 'string', nullable: true },
        mac: { type: 'string' },
        ssid: { type: 'string' },
        radioId: { type: 'string' },
        radioType: { type: 'string' },
        signal: { type: 'integer', nullable: true },
        snr: { type: 'integer', nullable: true },
        channel: { type: 'integer', nullable: true },
        manufacturer: { type: 'string', nullable: true },
        health: { type: 'string', enum: ['good', 'fair', 'poor'] },
      },
    },
    AccessPoint: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        model: { type: 'string' },
        serial: { type: 'string' },
        siteId: { type: 'string' },
        status: { type: 'string', enum: ['healthy', 'warning', 'critical', 'offline'] },
        firmware: { type: 'string' },
        targetFirmware: { type: 'string' },
        clients: { type: 'integer' },
        radios: { type: 'array', items: { $ref: '#/components/schemas/Radio' } },
        ip: { type: 'string' },
        lastSeen: { type: 'string', format: 'date-time' },
        profileId: { type: 'string' },
        ssids: { type: 'array', items: { $ref: '#/components/schemas/SSID' } },
        configSummary: { type: 'array', items: { type: 'string' } },
        neighborAps: { type: 'array', items: { type: 'string' } },
        clientDevices: { type: 'array', items: { $ref: '#/components/schemas/AccessPointClient' } },
      },
      example: examples.managedAccessPoint,
    },
    Client: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        username: { type: 'string' },
        connectionType: { type: 'string', enum: ['wired', 'wireless'] },
        ip: { type: 'string' },
        mac: { type: 'string' },
        network: { type: 'string' },
        connectedDeviceId: { type: 'string' },
        connectedDeviceType: { type: 'string', enum: ['switch', 'ap'] },
        siteId: { type: 'string' },
        usageGb: { type: 'number' },
        status: { type: 'string', enum: ['active', 'idle', 'blocked'] },
        lastSeen: { type: 'string', format: 'date-time' },
        hostname: { type: 'string', nullable: true },
        vendor: { type: 'string', nullable: true },
        osName: { type: 'string', nullable: true },
        osVersion: { type: 'string', nullable: true },
        detectedInterface: { type: 'string', nullable: true },
        connectedPort: { type: 'string', nullable: true },
        connectedApName: { type: 'string', nullable: true },
        vlanId: { type: 'integer', nullable: true },
        dhcpLeaseStatus: { type: 'string', nullable: true },
        connectedAt: { type: 'string', format: 'date-time', nullable: true },
      },
      example: examples.managedClient,
    },
    Gateway: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        base_url: { type: 'string' },
        vendor: { type: 'string' },
        site_name: { type: 'string' },
        auth_header: { type: 'string' },
        config_path: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        api_key_count: { type: 'integer' },
        last_cached_at: { type: 'string', format: 'date-time', nullable: true },
      },
      example: examples.gateway,
    },
    GatewayCreateRequest: {
      type: 'object',
      required: ['name', 'baseUrl'],
      properties: {
        name: { type: 'string', example: 'Austin Edge Firewall' },
        baseUrl: { type: 'string', example: 'https://10.0.0.1' },
        vendor: { type: 'string', example: 'generic' },
        siteName: { type: 'string', example: 'Austin HQ' },
        authHeader: { type: 'string', example: 'Authorization' },
        configPath: { type: 'string', example: '/api/config/export' },
      },
    },
    ApiKey: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        gateway_id: { type: 'string' },
        name: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        last_used_at: { type: 'string', format: 'date-time', nullable: true },
      },
      example: examples.apiKey,
    },
    ApiKeyCreateRequest: {
      type: 'object',
      required: ['name', 'apiKey'],
      properties: {
        name: { type: 'string', example: 'Primary Admin Key' },
        apiKey: { type: 'string', example: 'replace-with-real-key' },
      },
    },
    CacheEntry: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        gateway_id: { type: 'string' },
        api_key_id: { type: 'string' },
        status: { type: 'string', enum: ['success', 'failed'] },
        config_sha256: { type: 'string', nullable: true },
        config_blob: { type: 'string', nullable: true },
        metadata_json: { type: 'string', nullable: true },
        error_text: { type: 'string', nullable: true },
        fetched_at: { type: 'string', format: 'date-time' },
      },
      example: examples.cacheEntry,
    },
    SyncConfigRequest: {
      type: 'object',
      properties: {
        apiKeyId: { type: 'string', example: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf' },
      },
    },
  },
};

export const createOpenApiDocument = ({ port }) => ({
  openapi: '3.0.3',
  info: {
    title: 'EdgeOps Gateway Cache API',
    version: '1.1.0',
    description:
      'Gateway inventory, API key management, and cached configuration retrieval for EdgeOps Cloud.',
  },
  servers: [
    {
      url: `http://localhost:${port}`,
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health and discovery endpoints' },
    { name: 'Setup', description: 'Startup wizard state and bootstrap configuration' },
    { name: 'Sites', description: 'Site onboarding and live FortiGate summaries' },
    { name: 'Switches', description: 'Managed FortiSwitch inventory sourced from FortiGate' },
    { name: 'Access Points', description: 'Managed FortiAP inventory sourced from FortiGate' },
    { name: 'Clients', description: 'Discovered wired and wireless endpoint inventory sourced from FortiGate' },
    { name: 'Gateways', description: 'Gateway inventory and metadata management' },
    { name: 'API Keys', description: 'Gateway API key storage and listing' },
    { name: 'Config Cache', description: 'Gateway config sync and cached config retrieval' },
  ],
  components,
  paths: {
    '/api': {
      get: {
        tags: ['Health'],
        summary: 'API index',
        description: 'Returns the primary API routes and documentation links.',
        responses: {
          200: {
            description: 'API index',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.apiIndex,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.health,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/setup/status': {
      get: {
        tags: ['Setup'],
        summary: 'Get startup wizard status',
        description: 'If any required setup file is missing or empty, the wizard should be shown again.',
        responses: {
          200: {
            description: 'Wizard completion status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetupStatus' },
                examples: {
                  incomplete: { value: examples.setupStatus },
                },
              },
            },
          },
        },
      },
    },
    '/api/setup/wizard': {
      post: {
        tags: ['Setup'],
        summary: 'Save startup wizard values',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SetupWizardRequest' },
              examples: {
                default: {
                  value: {
                    username: 'admin',
                    password: 'correct-horse-battery-staple',
                    fortigateIp: '192.0.2.10',
                    fortigateApiKey: 'FGT-API-KEY-EXAMPLE',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Wizard values saved',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetupStatus' },
                examples: {
                  complete: {
                    value: {
                      complete: true,
                      checks: examples.setupStatus.checks.map((check) => ({
                        ...check,
                        fileExists: true,
                        hasValue: true,
                      })),
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: {
                      error: 'username, password, fortigateIp, and fortigateApiKey are required',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/sites': {
      get: {
        tags: ['Sites'],
        summary: 'List sites',
        description: 'Returns all configured sites with live or demo FortiGate summary data.',
        responses: {
          200: {
            description: 'Site list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sites: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Site' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.siteList,
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Sites'],
        summary: 'Create a site',
        description: 'Creates site metadata and FortiGate connection settings. The shorthand site id is generated automatically.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SiteCreateRequest' },
              examples: {
                default: {
                  value: examples.siteCreateRequest,
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Site created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    site: { $ref: '#/components/schemas/Site' },
                  },
                },
                examples: {
                  default: {
                    value: { site: examples.site },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: { error: 'name, address, timezone, and region are required' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/sites/load-demo': {
      post: {
        tags: ['Sites'],
        summary: 'Seed demo sites',
        description: 'Adds the built-in sample sites if they are not already present.',
        responses: {
          201: {
            description: 'Demo sites created or returned',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.siteList,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/sites/{siteId}': {
      get: {
        tags: ['Sites'],
        summary: 'Get site detail',
        parameters: [
          {
            name: 'siteId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
          },
        ],
        responses: {
          200: {
            description: 'Site detail',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    site: { $ref: '#/components/schemas/Site' },
                  },
                },
                examples: {
                  default: {
                    value: { site: examples.site },
                  },
                },
              },
            },
          },
          404: {
            description: 'Site not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: { error: 'Site not found' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/switches': {
      get: {
        tags: ['Switches'],
        summary: 'List managed switches',
        parameters: [
          {
            name: 'siteId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            example: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
          },
        ],
        responses: {
          200: {
            description: 'Managed switch list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    switches: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SwitchDevice' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: { switches: [examples.managedSwitch] },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/switches/{switchId}': {
      get: {
        tags: ['Switches'],
        summary: 'Get managed switch detail',
        parameters: [
          {
            name: 'switchId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d--S426EFTF21001195',
          },
        ],
        responses: {
          200: {
            description: 'Managed switch detail',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    switch: { $ref: '#/components/schemas/SwitchDevice' },
                  },
                },
                examples: {
                  default: {
                    value: { switch: examples.managedSwitch },
                  },
                },
              },
            },
          },
          404: {
            description: 'Switch not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: { error: 'Switch not found' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/aps': {
      get: {
        tags: ['Access Points'],
        summary: 'List managed access points',
        parameters: [
          {
            name: 'siteId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            example: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
          },
        ],
        responses: {
          200: {
            description: 'Managed access point list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessPoints: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AccessPoint' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: { accessPoints: [examples.managedAccessPoint] },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/aps/{accessPointId}': {
      get: {
        tags: ['Access Points'],
        summary: 'Get managed access point detail',
        parameters: [
          {
            name: 'accessPointId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d--FP441KTF24014592',
          },
        ],
        responses: {
          200: {
            description: 'Managed access point detail',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accessPoint: { $ref: '#/components/schemas/AccessPoint' },
                  },
                },
                examples: {
                  default: {
                    value: { accessPoint: examples.managedAccessPoint },
                  },
                },
              },
            },
          },
          404: {
            description: 'Access point not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: { error: 'Access point not found' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/clients': {
      get: {
        tags: ['Clients'],
        summary: 'List discovered clients',
        parameters: [
          {
            name: 'siteId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            example: 'site_0e7d6a46-0402-4d47-9f49-5623b122f27d',
          },
        ],
        responses: {
          200: {
            description: 'Discovered client list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    clients: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Client' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: { clients: [examples.managedClient] },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/gateways': {
      get: {
        tags: ['Gateways'],
        summary: 'List gateways',
        responses: {
          200: {
            description: 'Gateway list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gateways: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Gateway' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.gatewayList,
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Gateways'],
        summary: 'Create gateway',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GatewayCreateRequest' },
              examples: {
                default: {
                  value: {
                    name: 'Austin Edge Firewall',
                    baseUrl: 'https://10.0.0.1',
                    vendor: 'generic',
                    siteName: 'Austin HQ',
                    authHeader: 'Authorization',
                    configPath: '/api/config/export',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Gateway created',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.gatewayCreated,
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: { value: examples.error },
                },
              },
            },
          },
        },
      },
    },
    '/api/gateways/{gatewayId}/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List gateway API keys',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        responses: {
          200: {
            description: 'API key list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    apiKeys: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ApiKey' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.apiKeyList,
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create gateway API key',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiKeyCreateRequest' },
              examples: {
                default: {
                  value: {
                    name: 'Primary Admin Key',
                    apiKey: 'replace-with-real-key',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'API key created',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.apiKeyCreated,
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: { value: { error: 'name and apiKey are required' } },
                },
              },
            },
          },
          404: {
            description: 'Gateway not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: { value: examples.notFound },
                },
              },
            },
          },
        },
      },
    },
    '/api/gateways/{gatewayId}/sync-config': {
      post: {
        tags: ['Config Cache'],
        summary: 'Sync gateway config into cache',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SyncConfigRequest' },
              examples: {
                default: {
                  value: {
                    apiKeyId: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Config cache row created',
            content: {
              'application/json': {
                examples: {
                  success: {
                    value: examples.cacheEntryCreated,
                  },
                },
              },
            },
          },
          400: {
            description: 'Sync failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  noKey: { value: { error: 'No API key is available for this gateway' } },
                  gatewayMissing: { value: { error: 'Gateway not found' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/gateways/{gatewayId}/config-cache': {
      get: {
        tags: ['Config Cache'],
        summary: 'List cached configs for gateway',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        responses: {
          200: {
            description: 'Cached config list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CacheEntry' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.cacheEntryList,
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/gateways/{gatewayId}/config-cache/latest': {
      get: {
        tags: ['Config Cache'],
        summary: 'Get latest cached config for gateway',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        responses: {
          200: {
            description: 'Latest cached config',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.cacheEntryCreated,
                  },
                },
              },
            },
          },
          404: {
            description: 'No cached config found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: examples.noCache,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
