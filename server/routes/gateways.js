import express from 'express';
import { requireOperator } from '../lib/auth.js';

export const createGatewayRouter = ({ repository, gatewayConfigService }) => {
  const router = express.Router();

  router.get('/', async (_request, response) => {
    response.json({ gateways: await repository.listGateways() });
  });

  router.post('/', async (request, response) => {
    const { name, baseUrl, vendor, siteName, authHeader, configPath } = request.body ?? {};

    if (!name || !baseUrl) {
      response.status(400).json({ error: 'name and baseUrl are required' });
      return;
    }

    const gateway = await repository.createGateway({
      name,
      baseUrl,
      vendor,
      siteName,
      authHeader,
      configPath,
    });

    response.status(201).json({ gateway });
  });

  router.get('/:gatewayId/api-keys', async (request, response) => {
    response.json({
      apiKeys: await repository.listApiKeys(request.params.gatewayId),
    });
  });

  router.post('/:gatewayId/api-keys', async (request, response) => {
    const gateway = await repository.getGateway(request.params.gatewayId);
    if (!gateway) {
      response.status(404).json({ error: 'Gateway not found' });
      return;
    }

    const { name, apiKey } = request.body ?? {};
    if (!name || !apiKey) {
      response.status(400).json({ error: 'name and apiKey are required' });
      return;
    }

    const created = await repository.createApiKey(request.params.gatewayId, { name, apiKey });
    response.status(201).json({
      apiKey: {
        id: created.id,
        gateway_id: created.gateway_id,
        name: created.name,
        created_at: created.created_at,
      },
    });
  });

  router.post('/:gatewayId/sync-config', requireOperator, async (request, response) => {
    try {
      const cacheRow = await gatewayConfigService.syncGatewayConfig(
        request.params.gatewayId,
        request.body?.apiKeyId,
      );

      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.status(201).json({ cacheEntry: cacheRow });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : 'Unable to sync gateway config',
      });
    }
  });

  router.get('/:gatewayId/config-cache', async (request, response) => {
    response.json({
      entries: await repository.listCachedConfigs(request.params.gatewayId),
    });
  });

  router.get('/:gatewayId/config-cache/latest', requireOperator, async (request, response) => {
    const latest = await repository.getLatestCachedConfig(request.params.gatewayId);
    if (!latest) {
      response.status(404).json({ error: 'No cached config found for this gateway' });
      return;
    }

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.json({ cacheEntry: latest });
  });

  return router;
};
