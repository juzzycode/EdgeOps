import express from 'express';
import { getScopedSiteId } from '../lib/auth.js';

export const createAlertsRouter = ({ alertService }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const siteId = getScopedSiteId(request) ?? undefined;
    if (request.auth?.user?.siteId && typeof request.query.siteId === 'string' && request.query.siteId !== request.auth.user.siteId) {
      response.status(403).json({ error: 'This account is scoped to a different site' });
      return;
    }
    const severity = typeof request.query.severity === 'string' ? request.query.severity : undefined;
    const hours = typeof request.query.hours === 'string' ? request.query.hours : undefined;

    const alerts = await alertService.listAlerts({
      siteId,
      severity,
      hours,
    });

    response.json({ alerts });
  });

  return router;
};
