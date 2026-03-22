import express from 'express';

export const createAlertsRouter = ({ alertService }) => {
  const router = express.Router();

  router.get('/', async (request, response) => {
    const siteId = typeof request.query.siteId === 'string' ? request.query.siteId : undefined;
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
