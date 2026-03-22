import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { serverConfig } from './config.js';
import { createDatabase } from './lib/database.js';
import { createGatewayConfigService } from './lib/gateway-config-service.js';
import { createGatewayRepository } from './lib/gateway-repository.js';
import { createOpenApiDocument } from './openapi.js';
import { createGatewayRouter } from './routes/gateways.js';

const start = async () => {
  const app = express();
  const db = await createDatabase(serverConfig.dbPath);
  const repository = createGatewayRepository({
    db,
    secret: serverConfig.secret,
  });
  const gatewayConfigService = createGatewayConfigService({ repository });
  const openApiDocument = createOpenApiDocument({ port: serverConfig.port });

  app.use(express.json());

  app.get('/api', (_request, response) => {
    response.json({
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
    });
  });

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      dbPath: serverConfig.dbPath,
    });
  });

  app.get('/api/openapi.json', (_request, response) => {
    response.json(openApiDocument);
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(
    '/api/gateways',
    createGatewayRouter({
      repository,
      gatewayConfigService,
    }),
  );

  const server = app.listen(serverConfig.port, () => {
    console.log(`EdgeOps gateway cache API listening on http://localhost:${serverConfig.port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${serverConfig.port} is already in use. Check your .env value for EDGEOPS_PORT or stop the existing process.`,
      );
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
