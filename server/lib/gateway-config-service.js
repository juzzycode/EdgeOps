import crypto from 'node:crypto';

const toConfigHash = (content) => crypto.createHash('sha256').update(content).digest('hex');

export const createGatewayConfigService = ({ repository }) => ({
  async syncGatewayConfig(gatewayId, apiKeyId) {
    const gateway = repository.getGateway(gatewayId);
    const resolvedGateway = await gateway;
    if (!resolvedGateway) {
      throw new Error('Gateway not found');
    }

    const resolvedApiKey = await repository.resolveApiKey(gatewayId, apiKeyId);
    if (!resolvedApiKey) {
      throw new Error('No API key is available for this gateway');
    }

    const requestUrl = new URL(resolvedGateway.config_path, resolvedGateway.base_url).toString();
    const headers = {
      [resolvedGateway.auth_header]: resolvedApiKey.api_key,
      Accept: 'application/json, text/plain, */*',
    };

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers,
    });

    await repository.markApiKeyUsed(resolvedApiKey.id);

    if (!response.ok) {
      const errorText = await response.text();
      return repository.cacheConfig({
        gatewayId,
        apiKeyId: resolvedApiKey.id,
        status: 'failed',
        errorText: `HTTP ${response.status}: ${errorText.slice(0, 4000)}`,
        metadata: {
          requestUrl,
          responseStatus: response.status,
        },
      });
    }

    const configBlob = await response.text();

    return repository.cacheConfig({
      gatewayId,
      apiKeyId: resolvedApiKey.id,
      status: 'success',
      configBlob,
      configSha256: toConfigHash(configBlob),
      metadata: {
        requestUrl,
        responseStatus: response.status,
        contentLength: configBlob.length,
      },
    });
  },
});
