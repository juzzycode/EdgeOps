import express from 'express';
import { getScopedSiteId } from '../lib/auth.js';

export const createFirmwareRouter = ({ inventoryService }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const requestedSiteId = typeof request.query.siteId === 'string' ? request.query.siteId : undefined;
    const siteId = getScopedSiteId(request) ?? requestedSiteId;
    if (request.auth?.user?.siteId && typeof request.query.siteId === 'string' && request.query.siteId !== request.auth.user.siteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }
    const firmware = await inventoryService.listFirmwareStatuses({ siteId });
    response.json({ firmware });
  });

  return router;
};
