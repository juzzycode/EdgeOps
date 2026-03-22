import express from 'express';

export const createApsRouter = ({ siteStore, fortiGateClient }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const requestedSiteId = typeof request.query.siteId === 'string' ? request.query.siteId : null;
    const sites = requestedSiteId
      ? [await siteStore.getSiteById(requestedSiteId)].filter(Boolean)
      : await siteStore.listSites();

    const apLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        accessPoints: await fortiGateClient.listManagedAccessPointsForSite(site).catch((error) => {
          console.error(`[aps] Failed to load APs for site ${site.id}:`, error);
          return [];
        }),
      })),
    );

    response.json({ accessPoints: apLists.flatMap((entry) => entry.accessPoints) });
  });

  router.get('/:id', async (request, response) => {
    const sites = await siteStore.listSites();

    for (const site of sites) {
      const device = await fortiGateClient.getManagedAccessPointDetailForSite(site, request.params.id).catch(() => null);
      if (device) {
        response.json({ accessPoint: device });
        return;
      }
    }

    response.status(404).json({ error: 'Access point not found' });
  });

  return router;
};
