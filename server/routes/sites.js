import express from 'express';

const demoSites = [
  { name: 'Austin HQ', address: '701 Congress Ave, Austin, TX', timezone: 'America/Chicago', region: 'Central' },
  { name: 'Denver Branch', address: '1801 California St, Denver, CO', timezone: 'America/Denver', region: 'Mountain' },
  { name: 'Raleigh Lab', address: '4242 Six Forks Rd, Raleigh, NC', timezone: 'America/New_York', region: 'East' },
  { name: 'Seattle Warehouse', address: '301 Elliott Ave W, Seattle, WA', timezone: 'America/Los_Angeles', region: 'West' },
];

export const createSitesRouter = ({ siteStore, fortiGateClient }) => {
  const router = express.Router();

  router.get('/', async (_request, response) => {
    const rows = await siteStore.listSites();
    const sites = await Promise.all(
      rows.map((site) =>
        fortiGateClient.summarizeSite(site).catch((error) => {
          console.error(`[sites] Failed to summarize site ${site.id}:`, error);
          return {
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
            fortigateVersion: null,
            fortigateSerial: null,
            addressObjectCount: 0,
            apiReachable: false,
            lastSyncError: error instanceof Error ? error.message : 'Unable to summarize site',
            latencyAvgMs: null,
            latencyMinMs: null,
            latencyMaxMs: null,
            latencyPacketLoss: null,
            latencyCheckedAt: null,
            latencyError: null,
            source: site.is_demo ? 'demo' : 'live',
          };
        }),
      ),
    );
    response.json({ sites });
  });

  router.post('/', async (request, response) => {
    const { name, address, timezone, region, fortigateName, fortigateIp, fortigateApiKey, adminUsername, adminPassword } = request.body ?? {};

    if (!name || !address || !timezone || !region) {
      response.status(400).json({ error: 'name, address, timezone, and region are required' });
      return;
    }

    const site = await siteStore.createSite({
      name,
      address,
      timezone,
      region,
      fortigateName,
      fortigateIp,
      fortigateApiKey,
      adminUsername,
      adminPassword,
      isDemo: false,
    });

    response.status(201).json({ site: await fortiGateClient.summarizeSite(site) });
  });

  router.post('/load-demo', async (_request, response) => {
    const existing = await siteStore.listSites();
    const existingNames = new Set(existing.map((site) => site.name));

    for (const demoSite of demoSites) {
      if (!existingNames.has(demoSite.name)) {
        await siteStore.createSite({
          name: demoSite.name,
          address: demoSite.address,
          timezone: demoSite.timezone,
          region: demoSite.region,
          fortigateName: `${demoSite.name} FortiGate`,
          isDemo: true,
        });
      }
    }

    const rows = await siteStore.listSites();
    const sites = await Promise.all(rows.map((site) => fortiGateClient.summarizeSite(site)));
    response.status(201).json({ sites });
  });

  router.get('/:id', async (request, response) => {
    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    response.json({ site: await fortiGateClient.summarizeSite(site) });
  });

  router.patch('/:id', async (request, response) => {
    const { name, address, timezone, region, fortigateName, fortigateIp, fortigateApiKey, adminUsername, adminPassword } = request.body ?? {};
    const existing = await siteStore.getSiteById(request.params.id);

    if (!existing) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    if ((name !== undefined && !String(name).trim()) || (address !== undefined && !String(address).trim()) || (timezone !== undefined && !String(timezone).trim()) || (region !== undefined && !String(region).trim())) {
      response.status(400).json({ error: 'name, address, timezone, and region cannot be empty when provided' });
      return;
    }

    const site = await siteStore.updateSite(request.params.id, {
      name,
      address,
      timezone,
      region,
      fortigateName,
      fortigateIp,
      fortigateApiKey,
      adminUsername,
      adminPassword,
    });

    response.json({ site: await fortiGateClient.summarizeSite(site) });
  });

  router.delete('/:id', async (request, response) => {
    const removed = await siteStore.deleteSite(request.params.id);
    if (!removed) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    response.status(204).send();
  });

  return router;
};
