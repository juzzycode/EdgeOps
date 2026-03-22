import express from 'express';

export const createClientsRouter = ({ siteStore, fortiGateClient }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const requestedSiteId = typeof request.query.siteId === 'string' ? request.query.siteId : null;
    const sites = requestedSiteId
      ? [await siteStore.getSiteById(requestedSiteId)].filter(Boolean)
      : await siteStore.listSites();

    const clientLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        clients: await fortiGateClient.listClientsForSite(site).catch((error) => {
          console.error(`[clients] Failed to load clients for site ${site.id}:`, error);
          return [];
        }),
      })),
    );

    response.json({ clients: clientLists.flatMap((entry) => entry.clients) });
  });

  return router;
};
