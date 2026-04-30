import express from 'express';
import { ensureSiteAccess, requireOperator, requireSuperAdmin } from '../lib/auth.js';

export const createSitesRouter = ({ siteStore, fortiGateClient, siteConfigArchiveService, historyService, topologyService }) => {
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
            fortigateVdom: site.fortigate_vdom || 'root',
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
            configArchiveEnabled: site.config_backups_to_keep === 0 ? false : site.config_archive_enabled === undefined ? true : Boolean(site.config_archive_enabled),
            configBackupsToKeep:
              site.config_backups_to_keep === undefined || site.config_backups_to_keep === null
                ? null
                : Number(site.config_backups_to_keep),
            siteAlertEmailEnabled: Boolean(site.site_alert_email_enabled),
            siteAlertEmailRecipients: site.site_alert_email_recipients || '',
            source: 'live',
          };
        }),
      ),
    );
    response.json({ sites });
  });

  router.post('/', requireSuperAdmin, async (request, response) => {
    const { name, address, timezone, region, fortigateName, fortigateIp, fortigateApiKey, fortigateVdom, adminUsername, adminPassword, configBackupsToKeep, siteAlertEmailEnabled, siteAlertEmailRecipients } = request.body ?? {};

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
      fortigateVdom,
      adminUsername,
      adminPassword,
      configBackupsToKeep,
      siteAlertEmailEnabled,
      siteAlertEmailRecipients,
    });

    response.status(201).json({ site: await fortiGateClient.summarizeSite(site) });
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

  router.get('/:id/history', async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }

    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    const limit = Number(request.query.limit);
    const history = await historyService.getSiteHistory(request.params.id, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : 48,
      refresh: request.query.refresh === 'true',
    });

    response.json(history);
  });

  router.get('/:id/topology', async (request, response) => {
    if (!ensureSiteAccess(request, response, request.params.id)) {
      return;
    }

    const site = await siteStore.getSiteById(request.params.id);
    if (!site) {
      response.status(404).json({ error: 'Site not found' });
      return;
    }

    const topology = await topologyService.getTopology({ siteId: request.params.id });
    response.json({ topology });
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

  router.get('/:id/config-snapshots/:snapshotId/download', requireOperator, async (request, response) => {
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
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(download.content);
  });

  router.get('/:id/config-diffs', requireOperator, async (request, response) => {
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
      {
        filterRollingKeys: request.query.filterRollingKeys === 'true',
      },
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
    const { name, address, timezone, region, fortigateName, fortigateIp, fortigateApiKey, fortigateVdom, adminUsername, adminPassword, configBackupsToKeep, siteAlertEmailEnabled, siteAlertEmailRecipients } = request.body ?? {};
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
      fortigateVdom,
      adminUsername,
      adminPassword,
      configBackupsToKeep,
      siteAlertEmailEnabled,
      siteAlertEmailRecipients,
    });

    await siteConfigArchiveService.enforceRetention(request.params.id);

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
