const toArray = (value) => (Array.isArray(value) ? value : []);

const titleizeProfileName = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const buildVersion = (items) => {
  const versions = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  if (!versions.length) return 'Observed';
  if (versions.length === 1) return versions[0];
  return `${versions.length} observed`;
};

const buildSiteMap = (sites) => new Map(sites.map((site) => [site.id, site]));
const buildFortiGateDeviceId = (siteId) => `fortigate--${siteId}`;

const isGenericTargetLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || ['no staged target', 'latest staged target', 'managed by fortigate', 'unknown'].includes(normalized);
};

export const createInventoryService = ({ siteStore, fortiGateClient }) => ({
  async listProfiles({ siteId } = {}) {
    const sites = siteId ? [await siteStore.getSiteById(siteId)].filter(Boolean) : await siteStore.listSites();
    const switchResults = await Promise.allSettled(sites.map((site) => fortiGateClient.listManagedSwitchesForSite(site)));
    const apResults = await Promise.allSettled(sites.map((site) => fortiGateClient.listManagedAccessPointsForSite(site)));

    const switches = switchResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const accessPoints = apResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    const deviceProfilesMap = new Map();
    const vlanProfilesMap = new Map();
    const portProfilesMap = new Map();

    for (const device of switches) {
      const profileKey = `switch:${device.profileId}`;
      const existingProfile = deviceProfilesMap.get(profileKey) ?? {
        id: profileKey,
        type: 'switch',
        name: titleizeProfileName(device.profileId, 'Switch Profile'),
        description: 'Derived from live FortiGate managed-switch inventory.',
        assignedCount: 0,
        versions: [],
      };
      existingProfile.assignedCount += 1;
      existingProfile.versions.push(device.firmware);
      deviceProfilesMap.set(profileKey, existingProfile);

      for (const port of toArray(device.ports)) {
        const portProfileKey = port.profileId || 'default';
        const existingPortProfile = portProfilesMap.get(portProfileKey) ?? {
          id: portProfileKey,
          name: titleizeProfileName(portProfileKey, 'Default Port Policy'),
          poeMode: port.tags?.includes('PoE') ? 'auto' : 'disabled',
          voiceVlan: 'not specified',
          accessVlan: port.vlan || 'unassigned',
          stormControl: 'Inherited from FortiGate policy',
          sortRank: 0,
        };
        portProfilesMap.set(portProfileKey, existingPortProfile);

        const vlanKey = port.vlan || 'unassigned';
        const existingVlan = vlanProfilesMap.get(vlanKey) ?? {
          id: `vlan:${vlanKey}`,
          name: vlanKey,
          vlanId: Number.NaN,
          purpose: 'Observed on managed switch ports.',
          qos: port.isTrunk ? 'trunk' : 'access',
        };
        vlanProfilesMap.set(vlanKey, existingVlan);
      }
    }

    for (const device of accessPoints) {
      const profileKey = `ap:${device.profileId}`;
      const existingProfile = deviceProfilesMap.get(profileKey) ?? {
        id: profileKey,
        type: 'ap',
        name: titleizeProfileName(device.profileId, 'AP Profile'),
        description: 'Derived from live FortiGate AP controller inventory.',
        assignedCount: 0,
        versions: [],
      };
      existingProfile.assignedCount += 1;
      existingProfile.versions.push(device.firmware);
      deviceProfilesMap.set(profileKey, existingProfile);

      for (const ssid of toArray(device.ssids)) {
        const ssidKey = `ssid:${ssid.name}`;
        const existingSsid = deviceProfilesMap.get(ssidKey) ?? {
          id: ssidKey,
          type: 'ssid',
          name: ssid.name,
          description: `Observed on ${device.name} and managed by FortiGate WLAN policy.`,
          assignedCount: 0,
          versions: [],
        };
        existingSsid.assignedCount += 1;
        existingSsid.versions.push(ssid.authMode);
        deviceProfilesMap.set(ssidKey, existingSsid);

        const vlanKey = ssid.vlan || 'FortiGate WLAN';
        const existingVlan = vlanProfilesMap.get(vlanKey) ?? {
          id: `vlan:${vlanKey}`,
          name: vlanKey,
          vlanId: Number.NaN,
          purpose: 'Observed on FortiGate-managed WLANs.',
          qos: 'wireless',
        };
        vlanProfilesMap.set(vlanKey, existingVlan);
      }
    }

    const deviceProfiles = [...deviceProfilesMap.values()]
      .map((profile) => ({
        id: profile.id,
        type: profile.type,
        name: profile.name,
        description: profile.description,
        assignedCount: profile.assignedCount,
        version: buildVersion(profile.versions),
      }))
      .sort((left, right) => left.type.localeCompare(right.type) || right.assignedCount - left.assignedCount);

    const vlanProfiles = [...vlanProfilesMap.values()]
      .map((profile) => ({
        id: profile.id,
        name: profile.name,
        vlanId: Number.isFinite(profile.vlanId) ? profile.vlanId : 0,
        purpose: profile.purpose,
        qos: profile.qos,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    const portProfiles = [...portProfilesMap.values()].sort((left, right) => left.name.localeCompare(right.name));

    return { deviceProfiles, vlanProfiles, portProfiles };
  },

  async listFirmwareStatuses({ siteId } = {}) {
    const sites = siteId ? [await siteStore.getSiteById(siteId)].filter(Boolean) : await siteStore.listSites();
    const siteMap = buildSiteMap(sites);
    const siteSummaryResults = await Promise.allSettled(sites.map((site) => fortiGateClient.summarizeSite(site)));
    const switchResults = await Promise.allSettled(sites.map((site) => fortiGateClient.listManagedSwitchesForSite(site)));
    const apResults = await Promise.allSettled(sites.map((site) => fortiGateClient.listManagedAccessPointsForSite(site)));

    const summarizedSites = siteSummaryResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    const switches = switchResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
    const accessPoints = apResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    const mapFirmwareRow = (deviceType, device) => {
      const site = siteMap.get(device.siteId);
      const current = String(device.firmware || 'Unknown');
      const target = String(device.targetFirmware || current);
      const compliant = isGenericTargetLabel(target) || current === target;
      const blocked = device.status === 'offline';
      const compliance = compliant ? 'compliant' : blocked ? 'blocked' : 'pending';
      const eligible = !blocked;

      return {
        id: `fw-${device.id}`,
        deviceType,
        deviceId: device.id,
        deviceName: deviceType === 'switch' ? device.hostname : device.name,
        serial: device.serial,
        siteId: device.siteId,
        siteName: site?.name ?? device.siteId,
        current,
        target,
        compliance,
        eligible,
        rolloutGroup: blocked
          ? 'Hold'
          : site?.region
            ? `${site.region} Wave`
            : deviceType === 'switch'
              ? 'Switch Wave'
              : 'AP Wave',
      };
    };

    const fortiGates = summarizedSites
      .filter((site) => site.fortigateIp || site.fortigateName || site.fortigateVersion || site.fortigateSerial)
      .map((site) => {
        const current = String(site.fortigateVersion || 'Unknown');
        const blocked = !site.fortigateVersion;

        return {
          id: `fw-fortigate-${site.id}`,
          deviceType: 'fortigate',
          deviceId: buildFortiGateDeviceId(site.id),
          deviceName: site.fortigateName || site.name,
          serial: site.fortigateSerial || undefined,
          siteId: site.id,
          siteName: site.name,
          current,
          target: current,
          compliance: blocked ? 'blocked' : 'compliant',
          eligible: false,
          rolloutGroup: site.region ? `${site.region} Wave` : 'Gateway Wave',
        };
      });

    return [
      ...fortiGates,
      ...switches.map((device) => mapFirmwareRow('switch', device)),
      ...accessPoints.map((device) => mapFirmwareRow('ap', device)),
    ].sort((left, right) => left.siteName.localeCompare(right.siteName) || left.deviceType.localeCompare(right.deviceType));
  },
});
