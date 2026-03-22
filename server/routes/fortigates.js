import express from 'express';
import { ensureSiteAccess, getScopedSiteId } from '../lib/auth.js';

export const createFortiGatesRouter = ({ siteStore, fortiGateClient }) => {
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

  return router;
};
