import express from 'express';
import { getScopedSiteId } from '../lib/auth.js';

export const createProfilesRouter = ({ inventoryService }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const siteId = getScopedSiteId(request) ?? undefined;
    if (request.auth?.user?.siteId && typeof request.query.siteId === 'string' && request.query.siteId !== request.auth.user.siteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }
    const profiles = await inventoryService.listProfiles({ siteId });
    response.json(profiles);
  });

  return router;
};
