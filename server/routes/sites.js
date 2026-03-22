import express from 'express';
import { ensureSiteAccess, requireOperator, requireSuperAdmin } from '../lib/auth.js';

const demoSites = [
  { name: 'Austin HQ', address: '701 Congress Ave, Austin, TX', timezone: 'America/Chicago', region: 'Central' },
  { name: 'Denver Branch', address: '1801 California St, Denver, CO', timezone: 'America/Denver', region: 'Mountain' },
  { name: 'Raleigh Lab', address: '4242 Six Forks Rd, Raleigh, NC', timezone: 'America/New_York', region: 'East' },
  { name: 'Seattle Warehouse', address: '301 Elliott Ave W, Seattle, WA', timezone: 'America/Los_Angeles', region: 'West' },
];

export const createSitesRouter = ({ siteStore, fortiGateClient, siteConfigArchiveService }) => {
  const router = express.Router();

  router.get('/', async (_request, response) => {
    const scopedSiteId = _request.auth?.user?.siteId ?? null;
    const rows = scopedSiteId ? [await siteStore.getSiteById(scopedSiteId)].filter(Boolean) : await siteStore.listSites();
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

  router.post('/', requireSuperAdmin, async (request, response) => {
    const { name, address, timezone, region, fortigateName, fortigateIp, fortigateApiKey, adminUsername, adminPassword, configArchiveEnabled } = request.body ?? {};

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
      configArchiveEnabled,
      isDemo: false,
    });

    response.status(201).json({ site: await fortiGateClient.summarizeSite(site) });
  });

  router.post('/load-demo', requireSuperAdmin, async (_request, response) => {
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
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }
    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    response.json({ site: await fortiGateClient.summarizeSite(site) });
  });

  router.get('/:id/config-snapshots', async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }

    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    response.json({
      snapshots: await siteConfigArchiveService.listSnapshots(request.params.id),
    });
  });

  router.post('/:id/config-snapshots/sync', requireOperator, async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }

    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    try {
      const snapshot = await siteConfigArchiveService.ensureDailySnapshot(request.params.id, {
        force: Boolean(request.body?.force),
      });
      response.status(201).json({ snapshot });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : 'Unable to sync site config snapshot',
      });
    }
  });

  router.get('/:id/config-snapshots/:snapshotId/download', async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }

    const download = await siteConfigArchiveService.getSnapshotDownload(request.params.id, request.params.snapshotId);
    if (!download) {
      response.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${download.filename}"`);
    response.send(download.content);
  });

  router.get('/:id/config-diffs', async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }

    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    const diff = await siteConfigArchiveService.getDiff(
      request.params.id,
      typeof request.query.fromSnapshotId === 'string' ? request.query.fromSnapshotId : undefined,
      typeof request.query.toSnapshotId === 'string' ? request.query.toSnapshotId : undefined,
    );

    if (!diff) {
      response.status(404).json({ error: 'Not enough successful snapshots to build a diff' });
      return;
    }

    response.json({ diff });
  });

  router.patch('/:id', requireOperator, async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }
    const { name, address, timezone, region, fortigateName, fortigateIp, fortigateApiKey, adminUsername, adminPassword, configArchiveEnabled } = request.body ?? {};
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
      configArchiveEnabled,
    });

    response.json({ site: await fortiGateClient.summarizeSite(site) });
  });

  router.delete('/:id', requireSuperAdmin, async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }
    const removed = await siteStore.deleteSite(request.params.id);
    if (!removed) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    response.status(204).send();
  });

  return router;
};
