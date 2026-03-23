import express from 'express';
import { ensureSiteAccess, getScopedSiteId, requireOperator } from '../lib/auth.js';

const normalizeScanRow = (row) => {
  if (!row) return null;
  return {
    target: row.target_ip,
    targetMac: row.target_mac || null,
    scannedAt: row.scanned_at,
    status: row.status,
    hostState: row.host_state,
    summary: row.summary,
    openPorts: JSON.parse(row.open_ports_json || '[]'),
    rawOutput: row.raw_output || '',
    error: row.error_text || null,
    scanMode: row.scan_mode,
  };
};

export const createFortiGatesRouter = ({ siteStore, fortiGateClient, hostScanService }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const requestedSiteId = getScopedSiteId(request);
    if (
      request.auth?.user?.siteId &&
      typeof request.query.siteId === 'string' &&
      request.query.siteId !== request.auth.user.siteId
    ) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }

    const sites = requestedSiteId
      ? [await siteStore.getSiteById(requestedSiteId)].filter(Boolean)
      : await siteStore.listSites();

    const deviceLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        fortiGates: await fortiGateClient.listFortiGatesForSite(site).catch((error) => {
          console.error(`[fortigates] Failed to load FortiGate inventory for site ${site.id}:`, error);
          return [];
        }),
      })),
    );

    response.json({ fortiGates: deviceLists.flatMap((entry) => entry.fortiGates) });
  });

  router.get('/:id', async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const sites = scopedSiteId ? [await siteStore.getSiteById(scopedSiteId)].filter(Boolean) : await siteStore.listSites();

    for (const site of sites) {
      if (!ensureSiteAccess(request, response, site.id)) {
        return;
      }

      const device = await fortiGateClient.getFortiGateDetailForSite(site, request.params.id).catch(() => null);
      if (device) {
        response.json({ fortiGate: device });
        return;
      }
    }

    response.status(404).json({ error: 'FortiGate not found' });
  });

  router.post('/:id/scan-host', requireOperator, async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const sites = scopedSiteId ? [await siteStore.getSiteById(scopedSiteId)].filter(Boolean) : await siteStore.listSites();

    for (const site of sites) {
      if (!ensureSiteAccess(request, response, site.id)) {
        return;
      }

      const device = await fortiGateClient.getFortiGateDetailForSite(site, request.params.id).catch(() => null);
      if (!device) {
        continue;
      }

      const targetIp = typeof request.body?.ip === 'string' ? request.body.ip.trim() : '';
      const targetMac = typeof request.body?.mac === 'string' ? request.body.mac.trim() : '';
      const scanMode = Boolean(request.body?.deep) ? 'deep' : 'basic';
      if (!targetIp) {
        response.status(400).json({ error: 'ip is required' });
        return;
      }

      const scan = await hostScanService.scanTarget(targetIp, {
        deep: Boolean(request.body?.deep),
      });
      await siteStore.upsertHostScan({
        siteId: site.id,
        targetIp,
        targetMac,
        scanMode,
        status: scan.status,
        hostState: scan.hostState,
        summary: scan.summary,
        openPorts: scan.openPorts,
        rawOutput: scan.rawOutput,
        error: scan.error ?? null,
        scannedAt: scan.scannedAt,
      });
      response.status(200).json({ scan });
      return;
    }

    response.status(404).json({ error: 'FortiGate not found' });
  });

  router.get('/:id/scan-host', async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const sites = scopedSiteId ? [await siteStore.getSiteById(scopedSiteId)].filter(Boolean) : await siteStore.listSites();

    for (const site of sites) {
      if (!ensureSiteAccess(request, response, site.id)) {
        return;
      }

      const device = await fortiGateClient.getFortiGateDetailForSite(site, request.params.id).catch(() => null);
      if (!device) {
        continue;
      }

      const targetIp = typeof request.query.ip === 'string' ? request.query.ip.trim() : '';
      const targetMac = typeof request.query.mac === 'string' ? request.query.mac.trim() : '';
      const scanMode = request.query.deep === 'true' ? 'deep' : 'basic';
      if (!targetIp && !targetMac) {
        response.status(400).json({ error: 'ip or mac is required' });
        return;
      }

      const scan = normalizeScanRow(await siteStore.getHostScan(site.id, { targetIp, targetMac, scanMode }));
      response.json({ scan });
      return;
    }

    response.status(404).json({ error: 'FortiGate not found' });
  });

  return router;
};
