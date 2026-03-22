import express from 'express';
import { ensureSiteAccess, getScopedSiteId, requireOperator } from '../lib/auth.js';

export const createSwitchesRouter = ({ siteStore, fortiGateClient, deviceActionService }) => {
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

    const switchLists = await Promise.all(
      sites.map(async (site) => ({
        siteId: site.id,
        switches: await fortiGateClient.listManagedSwitchesForSite(site).catch((error) => {
          console.error(`[switches] Failed to load switches for site ${site.id}:`, error);
          return [];
        }),
      })),
    );

    response.json({ switches: switchLists.flatMap((entry) => entry.switches) });
  });

  router.get('/:id', async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const sites = scopedSiteId ? [await siteStore.getSiteById(scopedSiteId)].filter(Boolean) : await siteStore.listSites();

    for (const site of sites) {
      if (!ensureSiteAccess(request, response, site.id)) {
        return;
      }
      const device = await fortiGateClient.getManagedSwitchDetailForSite(site, request.params.id).catch(() => null);
      if (device) {
        response.json({ switch: device });
        return;
      }
    }

    response.status(404).json({ error: 'Switch not found' });
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
      targetType: 'switch',
      targetId: request.params.id,
      action,
      payload: request.body?.payload ?? null,
      actorUsername: request.auth.user.username,
    });

    response.status(201).json({ action: result });
  });

  router.put('/:id/ports/:portNumber', requireOperator, async (request, response) => {
    const scopedSiteId = request.auth?.user?.siteId ?? null;
    const siteId = request.params.id.split('--')[0];

    if (scopedSiteId && siteId !== scopedSiteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }

    const { description, vlan, enabled } = request.body ?? {};
    const action = await deviceActionService.updateSwitchPortOverride({
      switchId: request.params.id,
      portNumber: request.params.portNumber,
      payload: {
        description,
        vlan,
        enabled,
      },
      actorUsername: request.auth.user.username,
    });

    response.status(200).json({ action });
  });

  return router;
};
