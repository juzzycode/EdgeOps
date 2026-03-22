export const createOpenApiDocument = ({ port }) => ({
  openapi: '3.0.3',
  info: {
    title: 'EdgeOps Gateway Cache API',
    version: '1.0.0',
    description:
      'Gateway inventory, API key management, and cached configuration retrieval for EdgeOps Cloud.',
  },
  servers: [
    {
      url: `http://localhost:${port}`,
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health and discovery endpoints' },
    { name: 'Gateways', description: 'Gateway inventory and metadata management' },
    { name: 'API Keys', description: 'Gateway API key storage and listing' },
    { name: 'Config Cache', description: 'Gateway config sync and cached config retrieval' },
  ],
  paths: {
    '/api': {
      get: {
        tags: ['Health'],
        summary: 'API index',
        description: 'Returns the primary API routes and documentation links.',
        responses: {
          200: {
            description: 'API index',
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Server is running',
          },
        },
      },
    },
    '/api/gateways': {
      get: {
        tags: ['Gateways'],
        summary: 'List gateways',
        responses: {
          200: {
            description: 'Gateway list',
          },
        },
      },
      post: {
        tags: ['Gateways'],
        summary: 'Create gateway',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'baseUrl'],
                properties: {
                  name: { type: 'string', example: 'Austin Edge Firewall' },
                  baseUrl: { type: 'string', example: 'https://10.0.0.1' },
                  vendor: { type: 'string', example: 'generic' },
                  siteName: { type: 'string', example: 'Austin HQ' },
                  authHeader: { type: 'string', example: 'Authorization' },
                  configPath: { type: 'string', example: '/api/config/export' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Gateway created' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/api/gateways/{gatewayId}/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List gateway API keys',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'API key list' },
        },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create gateway API key',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'apiKey'],
                properties: {
                  name: { type: 'string', example: 'Primary Admin Key' },
                  apiKey: { type: 'string', example: 'replace-with-real-key' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'API key created' },
          400: { description: 'Validation error' },
          404: { description: 'Gateway not found' },
        },
      },
    },
    '/api/gateways/{gatewayId}/sync-config': {
      post: {
        tags: ['Config Cache'],
        summary: 'Sync gateway config into cache',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  apiKeyId: { type: 'string', example: 'key_123' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Config cache row created' },
          400: { description: 'Sync failed' },
        },
      },
    },
    '/api/gateways/{gatewayId}/config-cache': {
      get: {
        tags: ['Config Cache'],
        summary: 'List cached configs for gateway',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Cached config list' },
        },
      },
    },
    '/api/gateways/{gatewayId}/config-cache/latest': {
      get: {
        tags: ['Config Cache'],
        summary: 'Get latest cached config for gateway',
        parameters: [
          {
            name: 'gatewayId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Latest cached config' },
          404: { description: 'No cached config found' },
        },
      },
    },
  },
});
