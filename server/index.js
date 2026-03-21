import express from 'express';
import { serverConfig } from './config.js';
import { createDatabase } from './lib/database.js';
import { createGatewayConfigService } from './lib/gateway-config-service.js';
import { createGatewayRepository } from './lib/gateway-repository.js';
import { createGatewayRouter } from './routes/gateways.js';

const start = async () => {
  const app = express();
  const db = await createDatabase(serverConfig.dbPath);
  const repository = createGatewayRepository({
    db,
    secret: serverConfig.secret,
  });
  const gatewayConfigService = createGatewayConfigService({ repository });

  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      dbPath: serverConfig.dbPath,
    });
  });

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
