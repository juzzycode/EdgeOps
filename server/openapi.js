const examples = {
  apiIndex: {
    name: 'EdgeOps Gateway Cache API',
    version: '1.0.0',
    docs: '/api/docs',
    openApi: '/api/openapi.json',
    routes: {
      health: '/api/health',
      gateways: '/api/gateways',
      gatewayApiKeys: '/api/gateways/:gatewayId/api-keys',
      syncConfig: '/api/gateways/:gatewayId/sync-config',
      configCache: '/api/gateways/:gatewayId/config-cache',
      latestConfigCache: '/api/gateways/:gatewayId/config-cache/latest',
    },
  },
  health: {
    ok: true,
    dbPath: '/app/data/edgeops-cache.sqlite',
  },
  gateway: {
    id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
    name: 'Austin Edge Firewall',
    base_url: 'https://10.0.0.1',
    vendor: 'generic',
    site_name: 'Austin HQ',
    auth_header: 'Authorization',
    config_path: '/api/config/export',
    created_at: '2026-03-21T20:12:14.116Z',
    updated_at: '2026-03-21T20:12:14.116Z',
    api_key_count: 2,
    last_cached_at: '2026-03-21T20:18:20.002Z',
  },
  gatewayCreated: {
    gateway: {
      id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
      name: 'Austin Edge Firewall',
      base_url: 'https://10.0.0.1',
      vendor: 'generic',
      site_name: 'Austin HQ',
      auth_header: 'Authorization',
      config_path: '/api/config/export',
      created_at: '2026-03-21T20:12:14.116Z',
      updated_at: '2026-03-21T20:12:14.116Z',
    },
  },
  gatewayList: {
    gateways: [
      {
        id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
        name: 'Austin Edge Firewall',
        base_url: 'https://10.0.0.1',
        vendor: 'generic',
        site_name: 'Austin HQ',
        auth_header: 'Authorization',
        config_path: '/api/config/export',
        created_at: '2026-03-21T20:12:14.116Z',
        updated_at: '2026-03-21T20:12:14.116Z',
        api_key_count: 2,
        last_cached_at: '2026-03-21T20:18:20.002Z',
      },
    ],
  },
  apiKey: {
    id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
    gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
    name: 'Primary Admin Key',
    created_at: '2026-03-21T20:14:42.442Z',
    last_used_at: '2026-03-21T20:18:18.921Z',
  },
  apiKeyCreated: {
    apiKey: {
      id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
      gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
      name: 'Primary Admin Key',
      created_at: '2026-03-21T20:14:42.442Z',
    },
  },
  apiKeyList: {
    apiKeys: [
      {
        id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
        gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
        name: 'Primary Admin Key',
        created_at: '2026-03-21T20:14:42.442Z',
        last_used_at: '2026-03-21T20:18:18.921Z',
      },
    ],
  },
  cacheEntry: {
    id: 'cfg_9154fef2-8f7f-4512-898a-c4feef88f190',
    gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
    api_key_id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
    status: 'success',
    config_sha256: '4e0ec6ae57e2f8a2fe9f859167dcb0dddaf09caff9dcb8fe441e5888eacbd9c5',
    config_blob: 'config system interface\\n  edit wan1\\n    set ip 203.0.113.10 255.255.255.248\\n  next\\nend',
    metadata_json: '{"requestUrl":"https://10.0.0.1/api/config/export","responseStatus":200,"contentLength":94}',
    error_text: null,
    fetched_at: '2026-03-21T20:18:20.002Z',
  },
  cacheEntryCreated: {
    cacheEntry: {
      id: 'cfg_9154fef2-8f7f-4512-898a-c4feef88f190',
      gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
      api_key_id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
      status: 'success',
      config_sha256: '4e0ec6ae57e2f8a2fe9f859167dcb0dddaf09caff9dcb8fe441e5888eacbd9c5',
      config_blob: 'config system interface\\n  edit wan1\\n    set ip 203.0.113.10 255.255.255.248\\n  next\\nend',
      metadata_json: '{"requestUrl":"https://10.0.0.1/api/config/export","responseStatus":200,"contentLength":94}',
      error_text: null,
      fetched_at: '2026-03-21T20:18:20.002Z',
    },
  },
  cacheEntryList: {
    entries: [
      {
        id: 'cfg_9154fef2-8f7f-4512-898a-c4feef88f190',
        gateway_id: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
        api_key_id: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
        status: 'success',
        config_sha256: '4e0ec6ae57e2f8a2fe9f859167dcb0dddaf09caff9dcb8fe441e5888eacbd9c5',
        metadata_json: '{"requestUrl":"https://10.0.0.1/api/config/export","responseStatus":200,"contentLength":94}',
        error_text: null,
        fetched_at: '2026-03-21T20:18:20.002Z',
      },
    ],
  },
  error: {
    error: 'name and baseUrl are required',
  },
  notFound: {
    error: 'Gateway not found',
  },
  noCache: {
    error: 'No cached config found for this gateway',
  },
};

const components = {
  schemas: {
    ErrorResponse: {
      type: 'object',
      required: ['error'],
      properties: {
        error: { type: 'string' },
      },
    },
    Gateway: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        base_url: { type: 'string' },
        vendor: { type: 'string' },
        site_name: { type: 'string' },
        auth_header: { type: 'string' },
        config_path: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        api_key_count: { type: 'integer' },
        last_cached_at: { type: 'string', format: 'date-time', nullable: true },
      },
      example: examples.gateway,
    },
    GatewayCreateRequest: {
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
    ApiKey: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        gateway_id: { type: 'string' },
        name: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        last_used_at: { type: 'string', format: 'date-time', nullable: true },
      },
      example: examples.apiKey,
    },
    ApiKeyCreateRequest: {
      type: 'object',
      required: ['name', 'apiKey'],
      properties: {
        name: { type: 'string', example: 'Primary Admin Key' },
        apiKey: { type: 'string', example: 'replace-with-real-key' },
      },
    },
    CacheEntry: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        gateway_id: { type: 'string' },
        api_key_id: { type: 'string' },
        status: { type: 'string', enum: ['success', 'failed'] },
        config_sha256: { type: 'string', nullable: true },
        config_blob: { type: 'string', nullable: true },
        metadata_json: { type: 'string', nullable: true },
        error_text: { type: 'string', nullable: true },
        fetched_at: { type: 'string', format: 'date-time' },
      },
      example: examples.cacheEntry,
    },
    SyncConfigRequest: {
      type: 'object',
      properties: {
        apiKeyId: { type: 'string', example: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf' },
      },
    },
  },
};

export const createOpenApiDocument = ({ port }) => ({
  openapi: '3.0.3',
  info: {
    title: 'EdgeOps Gateway Cache API',
    version: '1.1.0',
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
  components,
  paths: {
    '/api': {
      get: {
        tags: ['Health'],
        summary: 'API index',
        description: 'Returns the primary API routes and documentation links.',
        responses: {
          200: {
            description: 'API index',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.apiIndex,
                  },
                },
              },
            },
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
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.health,
                  },
                },
              },
            },
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
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    gateways: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Gateway' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.gatewayList,
                  },
                },
              },
            },
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
              schema: { $ref: '#/components/schemas/GatewayCreateRequest' },
              examples: {
                default: {
                  value: {
                    name: 'Austin Edge Firewall',
                    baseUrl: 'https://10.0.0.1',
                    vendor: 'generic',
                    siteName: 'Austin HQ',
                    authHeader: 'Authorization',
                    configPath: '/api/config/export',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Gateway created',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.gatewayCreated,
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: { value: examples.error },
                },
              },
            },
          },
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
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        responses: {
          200: {
            description: 'API key list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    apiKeys: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ApiKey' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.apiKeyList,
                  },
                },
              },
            },
          },
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
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiKeyCreateRequest' },
              examples: {
                default: {
                  value: {
                    name: 'Primary Admin Key',
                    apiKey: 'replace-with-real-key',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'API key created',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.apiKeyCreated,
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: { value: { error: 'name and apiKey are required' } },
                },
              },
            },
          },
          404: {
            description: 'Gateway not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: { value: examples.notFound },
                },
              },
            },
          },
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
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SyncConfigRequest' },
              examples: {
                default: {
                  value: {
                    apiKeyId: 'key_3304f2f4-df33-48e1-9af1-d8fa3c970ccf',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Config cache row created',
            content: {
              'application/json': {
                examples: {
                  success: {
                    value: examples.cacheEntryCreated,
                  },
                },
              },
            },
          },
          400: {
            description: 'Sync failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  noKey: { value: { error: 'No API key is available for this gateway' } },
                  gatewayMissing: { value: { error: 'Gateway not found' } },
                },
              },
            },
          },
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
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        responses: {
          200: {
            description: 'Cached config list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/CacheEntry' },
                    },
                  },
                },
                examples: {
                  default: {
                    value: examples.cacheEntryList,
                  },
                },
              },
            },
          },
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
            example: 'gate_9aab5705-847d-45f4-9bd1-5077bdb57f92',
          },
        ],
        responses: {
          200: {
            description: 'Latest cached config',
            content: {
              'application/json': {
                examples: {
                  default: {
                    value: examples.cacheEntryCreated,
                  },
                },
              },
            },
          },
          404: {
            description: 'No cached config found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  default: {
                    value: examples.noCache,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
