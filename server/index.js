import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { serverConfig } from './config.js';
import { clearSessionCookie, createAuthMiddleware } from './lib/auth.js';
import { createAuthStore } from './lib/auth-store.js';
import { createDatabase } from './lib/database.js';
import { createDeviceActionService } from './lib/device-action-service.js';
import { createFortiGateClient } from './lib/fortigate-client.js';
import { createGatewayConfigService } from './lib/gateway-config-service.js';
import { createGatewayRepository } from './lib/gateway-repository.js';
import { createHistoryService } from './lib/history-service.js';
import { createHistoryStore } from './lib/history-store.js';
import { createInventoryService } from './lib/inventory-service.js';
import { createSiteConfigArchiveService } from './lib/site-config-archive-service.js';
import { createAlertService } from './lib/alert-service.js';
import { createSiteStore } from './lib/site-store.js';
import { createSetupStore } from './lib/setup-store.js';
import { createTopologyService } from './lib/topology-service.js';
import { createOpenApiDocument } from './openapi.js';
import { createAuthRouter } from './routes/auth.js';
import { createAlertsRouter } from './routes/alerts.js';
import { createEventsRouter } from './routes/events.js';
import { createFortiGatesRouter } from './routes/fortigates.js';
import { createGatewayRouter } from './routes/gateways.js';
import { createApsRouter } from './routes/aps.js';
import { createClientsRouter } from './routes/clients.js';
import { createFirmwareRouter } from './routes/firmware.js';
import { createProfilesRouter } from './routes/profiles.js';
import { createSetupRouter } from './routes/setup.js';
import { createSitesRouter } from './routes/sites.js';
import { createSwitchesRouter } from './routes/switches.js';
import { createTopologyRouter } from './routes/topology.js';
import { createUsersRouter } from './routes/users.js';

const verboseLogging = process.argv.includes('-v') || process.argv.includes('--verbose');

const start = async () => {
  const app = express();
  const db = await createDatabase(serverConfig.dbPath);
  const sitesDb = await createDatabase(serverConfig.sitesDbPath);
  const authDb = await createDatabase(serverConfig.authDbPath);
  const setupStore = await createSetupStore({
    files: serverConfig.setupFiles,
    secret: serverConfig.secret,
  });
  const siteStore = createSiteStore({ db: sitesDb });
  await siteStore.init();
  const historyStore = createHistoryStore({ db: sitesDb });
  await historyStore.init();
  const authStore = await createAuthStore({
    db: authDb,
    sessionTtlHours: serverConfig.sessionTtlHours,
    defaultAdminUsername: serverConfig.defaultAdminUsername,
    defaultAdminPassword: serverConfig.defaultAdminPassword,
  });
  const repository = createGatewayRepository({
    db,
    secret: serverConfig.secret,
  });
  const fortiGateClient = createFortiGateClient({ siteStore });
  const siteConfigArchiveService = createSiteConfigArchiveService({ siteStore });
  const inventoryService = createInventoryService({ siteStore, fortiGateClient });
  const alertService = createAlertService({ siteStore, fortiGateClient });
  const historyService = createHistoryService({ siteStore, fortiGateClient, alertService, historyStore });
  const topologyService = createTopologyService({ siteStore, fortiGateClient });
  const deviceActionService = createDeviceActionService({ siteStore, fortiGateClient, historyStore });
  const gatewayConfigService = createGatewayConfigService({ repository });
  const openApiDocument = createOpenApiDocument({ port: serverConfig.port, setupFiles: serverConfig.setupFiles });
  const requireSession = createAuthMiddleware({ authStore });

  app.use(express.json());
  app.use(
    cors({
      origin: serverConfig.corsOrigin === '*' ? true : serverConfig.corsOrigin,
      credentials: true,
    }),
  );

  if (verboseLogging) {
    app.use((request, response, next) => {
      const startedAt = Date.now();
      response.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        console.log(
          `[api] ${request.method} ${request.originalUrl} -> ${response.statusCode} ${durationMs}ms`,
        );
      });
      next();
    });
  }

  app.get('/', (_request, response) => {
    response.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EdgeOps Cloud API</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #09111d;
        --panel: #111c2e;
        --border: #223149;
        --text: #ecf3ff;
        --muted: #9bb0c9;
        --accent: #2dd4bf;
      }
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background: radial-gradient(circle at top left, rgba(45,212,191,0.14), transparent 26%), var(--bg);
        color: var(--text);
      }
      main {
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 20px 64px;
      }
      .panel {
        background: rgba(17, 28, 46, 0.92);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 18px 50px rgba(0,0,0,0.24);
      }
      h1 { margin: 0 0 8px; font-size: 2rem; }
      p { color: var(--muted); line-height: 1.6; }
      ul { padding-left: 18px; }
      li { margin: 10px 0; }
      a { color: var(--accent); text-decoration: none; }
      a:hover { text-decoration: underline; }
      code {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 2px 8px;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="panel">
        <h1>EdgeOps Cloud API</h1>
        <p>Site onboarding, live FortiGate summaries, gateway key storage, and cached configuration retrieval for EdgeOps Cloud.</p>
        <ul>
          <li><a href="/api">JSON API index</a> <code>GET /api</code></li>
          <li><a href="/api/docs">Swagger UI</a> <code>GET /api/docs</code></li>
          <li><a href="/api/openapi.json">OpenAPI spec</a> <code>GET /api/openapi.json</code></li>
          <li><a href="/api/health">Health check</a> <code>GET /api/health</code></li>
          <li><a href="/api/auth/session">Current session</a> <code>GET /api/auth/session</code></li>
          <li><a href="/api/sites">Sites</a> <code>GET /api/sites</code></li>
          <li><a href="/api/topology">Topology</a> <code>GET /api/topology</code></li>
          <li><a href="/api/sites">Site Config Archive</a> <code>GET /api/sites/:id/config-snapshots</code></li>
          <li><a href="/api/events">Events</a> <code>GET /api/events</code></li>
          <li><a href="/api/alerts">Alerts</a> <code>GET /api/alerts</code></li>
          <li><a href="/api/profiles">Profiles</a> <code>GET /api/profiles</code></li>
          <li><a href="/api/firmware">Firmware</a> <code>GET /api/firmware</code></li>
          <li><a href="/api/fortigates">FortiGates</a> <code>GET /api/fortigates</code></li>
          <li><a href="/api/switches">Switches</a> <code>GET /api/switches</code></li>
          <li><a href="/api/aps">Access Points</a> <code>GET /api/aps</code></li>
          <li><a href="/api/aps/rogues">Rogue APs</a> <code>GET /api/aps/rogues</code></li>
          <li><a href="/api/clients">Clients</a> <code>GET /api/clients</code></li>
          <li><a href="/api/gateways">Gateway list</a> <code>GET /api/gateways</code></li>
        </ul>
        <p>Configured port: <code>${serverConfig.port}</code></p>
      </div>
    </main>
  </body>
</html>`);
  });

  app.get('/api', (_request, response) => {
    response.json({
      name: 'EdgeOps Cloud API',
      version: '1.0.0',
      docs: '/api/docs',
      openApi: '/api/openapi.json',
      routes: {
        health: '/api/health',
        login: '/api/auth/login',
        session: '/api/auth/session',
        logout: '/api/auth/logout',
        users: '/api/users',
        setupStatus: '/api/setup/status',
        setupWizard: '/api/setup/wizard',
        sites: '/api/sites',
        siteDetail: '/api/sites/:id',
        siteHistory: '/api/sites/:id/history',
        siteTopology: '/api/sites/:id/topology',
        siteConfigSnapshots: '/api/sites/:id/config-snapshots',
        siteConfigSync: '/api/sites/:id/config-snapshots/sync',
        siteConfigDownload: '/api/sites/:id/config-snapshots/:snapshotId/download',
        siteConfigDiff: '/api/sites/:id/config-diffs',
        alerts: '/api/alerts',
        events: '/api/events',
        profiles: '/api/profiles',
        firmware: '/api/firmware',
        fortiGates: '/api/fortigates',
        fortiGateDetail: '/api/fortigates/:id',
        topology: '/api/topology',
        switches: '/api/switches',
        switchDetail: '/api/switches/:id',
        switchActions: '/api/switches/:id/actions',
        accessPoints: '/api/aps',
        rogueAccessPoints: '/api/aps/rogues',
        accessPointDetail: '/api/aps/:id',
        accessPointActions: '/api/aps/:id/actions',
        clients: '/api/clients',
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
      authDbPath: serverConfig.authDbPath,
    });
  });

  app.get('/api/openapi.json', (_request, response) => {
    response.json(openApiDocument);
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/api/auth', createAuthRouter({ authStore, sessionTtlHours: serverConfig.sessionTtlHours }));
  app.post('/api/logout', requireSession, async (request, response) => {
    await authStore.deleteSessionByToken(request.auth.token);
    clearSessionCookie(response);
    response.status(204).send();
  });
  app.use('/api', requireSession);
  app.use('/api/setup', createSetupRouter({ setupStore }));
  app.use('/api/sites', createSitesRouter({ siteStore, fortiGateClient, siteConfigArchiveService, historyService, topologyService }));
  app.use('/api/alerts', createAlertsRouter({ alertService }));
  app.use('/api/events', createEventsRouter({ historyStore }));
  app.use('/api/profiles', createProfilesRouter({ inventoryService }));
  app.use('/api/firmware', createFirmwareRouter({ inventoryService }));
  app.use('/api/fortigates', createFortiGatesRouter({ siteStore, fortiGateClient }));
  app.use('/api/topology', createTopologyRouter({ topologyService }));
  app.use('/api/switches', createSwitchesRouter({ siteStore, fortiGateClient, deviceActionService }));
  app.use('/api/aps', createApsRouter({ siteStore, fortiGateClient, deviceActionService }));
  app.use('/api/clients', createClientsRouter({ siteStore, fortiGateClient }));
  app.use('/api/users', createUsersRouter({ authStore, siteStore }));

  app.use(
    '/api/gateways',
    createGatewayRouter({
      repository,
      gatewayConfigService,
    }),
  );

  const server = app.listen(serverConfig.port, () => {
    console.log(`EdgeOps gateway cache API listening on http://localhost:${serverConfig.port}`);
    if (verboseLogging) {
      console.log('[api] Verbose request logging enabled');
    }
  });

  siteConfigArchiveService.startScheduler();
  historyService.startScheduler();

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
