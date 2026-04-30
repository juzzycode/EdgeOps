import express from 'express';
import { getScopedSiteId, requireOperator } from '../lib/auth.js';

export const createApsRouter = ({ siteStore, fortiGateClient, deviceActionService, inventoryCacheService }) => {
  const router = express.Router();

  router.get('/rogues', async (request, response) => {
    const requestedSiteId = getScopedSiteId(request);
    if (request.auth?.user?.siteId && typeof request.query.siteId === 'string' && request.query.siteId !== request.auth.user.siteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }
    const sites = requestedSiteId
      ? [await siteStore.getSiteById(requestedSiteId)].filter(Boolean)
      : await siteStore.listSites();

    const rogueLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        rogueAccessPoints: await inventoryCacheService.listCachedOrRefresh(site, 'rogueAccessPoints', () => fortiGateClient.listRogueAccessPointsForSite(site), {
          logLabel: 'aps',
        }),
      })),
    );

    response.json({ rogueAccessPoints: rogueLists.flatMap((entry) => entry.rogueAccessPoints) });
  });

  router.get('/', async (request, response) => {
    const requestedSiteId = getScopedSiteId(request);
    if (request.auth?.user?.siteId && typeof request.query.siteId === 'string' && request.query.siteId !== request.auth.user.siteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }
    const sites = requestedSiteId
      ? [await siteStore.getSiteById(requestedSiteId)].filter(Boolean)
      : await siteStore.listSites();

    const apLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        accessPoints: await inventoryCacheService.listCachedOrRefresh(site, 'accessPoints', () => fortiGateClient.listManagedAccessPointsForSite(site), {
          logLabel: 'aps',
        }),
      })),
    );

    response.json({ accessPoints: apLists.flatMap((entry) => entry.accessPoints) });
  });

  router.get('/:id', async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const sites = scopedSiteId ? [await siteStore.getSiteById(scopedSiteId)].filter(Boolean) : await siteStore.listSites();

    for (const site of sites) {
      const cachedDevice = await inventoryCacheService.findCachedItem(site.id, 'accessPoints', request.params.id);
      if (cachedDevice) {
        void inventoryCacheService.refreshCache(site, 'accessPoints', () => fortiGateClient.listManagedAccessPointsForSite(site), {
          logLabel: 'aps',
        }).catch(() => null);
        response.json({ accessPoint: cachedDevice });
        return;
      }

      void inventoryCacheService.refreshCache(site, 'accessPoints', () => fortiGateClient.listManagedAccessPointsForSite(site), {
        logLabel: 'aps',
      }).catch(() => null);
    }

    response.status(404).json({ error: 'Access point not found' });
  });

  router.post('/:id/actions', requireOperator, async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const siteId = request.params.id.split('--')[0];

    if (scopedSiteId && siteId !== scopedSiteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }

    const action = typeof request.body?.action === 'string' ? request.body.action : '';
    if (!action) {
      response.status(400).json({ error: 'action is required' });
      return;
    }

    const result = await deviceActionService.execute({
      targetType: 'ap',
      targetId: request.params.id,
      action,
      payload: request.body?.payload ?? null,
      actorUsername: request.auth.user.username,
    });

    response.status(201).json({ action: result });
  });

  return router;
};
