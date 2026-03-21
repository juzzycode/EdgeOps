import express from 'express';

export const createGatewayRouter = ({ repository, gatewayConfigService }) => {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.json({ gateways: repository.listGateways() });
  });

  router.post('/', (request, response) => {
    const { name, baseUrl, vendor, siteName, authHeader, configPath } = request.body ?? {};

    if (!name || !baseUrl) {
      response.status(400).json({ error: 'name and baseUrl are required' });
      return;
    }

    const gateway = repository.createGateway({
      name,
      baseUrl,
      vendor,
      siteName,
      authHeader,
      configPath,
    });

    response.status(201).json({ gateway });
  });

  router.get('/:gatewayId/api-keys', (request, response) => {
    response.json({
      apiKeys: repository.listApiKeys(request.params.gatewayId),
    });
  });

  router.post('/:gatewayId/api-keys', (request, response) => {
    const gateway = repository.getGateway(request.params.gatewayId);
    if (!gateway) {
      response.status(404).json({ error: 'Gateway not found' });
      return;
    }

    const { name, apiKey } = request.body ?? {};
    if (!name || !apiKey) {
      response.status(400).json({ error: 'name and apiKey are required' });
      return;
    }

    const created = repository.createApiKey(request.params.gatewayId, { name, apiKey });
    response.status(201).json({
      apiKey: {
        id: created.id,
        gateway_id: created.gateway_id,
        name: created.name,
        created_at: created.created_at,
      },
    });
  });

  router.post('/:gatewayId/sync-config', async (request, response) => {
    try {
      const cacheRow = await gatewayConfigService.syncGatewayConfig(
        request.params.gatewayId,
        request.body?.apiKeyId,
      );

      response.status(201).json({ cacheEntry: cacheRow });
    } catch (error) {
      response.status(400).json({
        error: error instanceof Error ? error.message : 'Unable to sync gateway config',
      });
    }
  });

  router.get('/:gatewayId/config-cache', (request, response) => {
    response.json({
      entries: repository.listCachedConfigs(request.params.gatewayId),
    });
  });

  router.get('/:gatewayId/config-cache/latest', (request, response) => {
    const latest = repository.getLatestCachedConfig(request.params.gatewayId);
    if (!latest) {
      response.status(404).json({ error: 'No cached config found for this gateway' });
      return;
    }

    response.json({ cacheEntry: latest });
  });

  return router;
};
