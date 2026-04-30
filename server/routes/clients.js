import express from 'express';
import { getScopedSiteId } from '../lib/auth.js';

export const createClientsRouter = ({ siteStore, fortiGateClient, inventoryCacheService }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const requestedSiteId = getScopedSiteId(request);
    if (request.auth?.user?.siteId && typeof request.query.siteId === 'string' && request.query.siteId !== request.auth.user.siteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }
    const sites = requestedSiteId
      ? [await siteStore.getSiteById(requestedSiteId)].filter(Boolean)
      : await siteStore.listSites();

    const clientLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        clients: await inventoryCacheService.listCachedOrRefresh(site, 'clients', () => fortiGateClient.listClientsForSite(site), {
          logLabel: 'clients',
        }),
      })),
    );

    response.json({ clients: clientLists.flatMap((entry) => entry.clients) });
  });

  return router;
};
