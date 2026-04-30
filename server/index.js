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
import { createHostScanService } from './lib/host-scan-service.js';
import { createInventoryService } from './lib/inventory-service.js';
import { createInventoryCacheService } from './lib/inventory-cache-service.js';
import { createEmailService } from './lib/email-service.js';
import { createSiteMonitorNotificationService } from './lib/site-monitor-notification-service.js';
import { createSiteConfigArchiveService } from './lib/site-config-archive-service.js';
import { createAlertService } from './lib/alert-service.js';
import { createSiteStore } from './lib/site-store.js';
import { createSetupStore } from './lib/setup-store.js';
import { createTopologyService } from './lib/topology-service.js';
import { createVendorLookupService } from './lib/vendor-lookup-service.js';
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
  const db = await createDatabase(serverConfig.dbPath, serverConfig.database);
  const sitesDb = await createDatabase(serverConfig.sitesDbPath, serverConfig.database);
  const authDb = await createDatabase(serverConfig.authDbPath, serverConfig.database);
  const setupStore = await createSetupStore({
    files: serverConfig.setupFiles,
    db: serverConfig.database.client === 'mysql' ? authDb : null,
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
  const vendorLookupService = createVendorLookupService({ siteStore });
  const fortiGateClient = createFortiGateClient({ siteStore, vendorLookupService });
  const siteConfigArchiveService = createSiteConfigArchiveService({ siteStore });
  const inventoryCacheService = createInventoryCacheService({ siteStore });
  const inventoryService = createInventoryService({ siteStore, fortiGateClient, inventoryCacheService });
  const alertService = createAlertService({ siteStore, fortiGateClient, inventoryCacheService });
  const emailService = createEmailService({ config: serverConfig.email });
  const siteMonitorNotificationService = createSiteMonitorNotificationService({ emailService });
  const historyService = createHistoryService({ siteStore, fortiGateClient, alertService, historyStore, siteMonitorNotificationService, inventoryCacheService });
  const hostScanService = createHostScanService();
  const topologyService = createTopologyService({ siteStore, fortiGateClient });
  const deviceActionService = createDeviceActionService({ siteStore, fortiGateClient, historyStore });
  const gatewayConfigService = createGatewayConfigService({ repository });
  const apiPath = (path = '') => `${serverConfig.apiPrefix}${path}`;
  const openApiDocument = createOpenApiDocument({
    host: serverConfig.apiHost,
    port: serverConfig.apiPort,
    apiPrefix: serverConfig.apiPrefix,
    setupFiles: serverConfig.setupFiles,
  });
  const requireSession = createAuthMiddleware({ authStore });

  app.set('trust proxy', true);
  app.use(express.json());
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use(
    cors({
      origin: serverConfig.corsOrigin ? (serverConfig.corsOrigin === '*' ? true : serverConfig.corsOrigin) : false,
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

  app.get('/', requireSession, (_request, response) => {
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
          <li><a href="${apiPath()}">JSON API index</a> <code>GET ${apiPath()}</code></li>
          <li><a href="${apiPath('/docs')}">Swagger UI</a> <code>GET ${apiPath('/docs')}</code></li>
          <li><a href="${apiPath('/openapi.json')}">OpenAPI spec</a> <code>GET ${apiPath('/openapi.json')}</code></li>
          <li><a href="${apiPath('/health')}">Health check</a> <code>GET ${apiPath('/health')}</code></li>
          <li><a href="${apiPath('/auth/session')}">Current session</a> <code>GET ${apiPath('/auth/session')}</code></li>
          <li><a href="${apiPath('/sites')}">Sites</a> <code>GET ${apiPath('/sites')}</code></li>
          <li><a href="${apiPath('/topology')}">Topology</a> <code>GET ${apiPath('/topology')}</code></li>
          <li><a href="${apiPath('/sites')}">Site Config Archive</a> <code>GET ${apiPath('/sites/:id/config-snapshots')}</code></li>
          <li><a href="${apiPath('/events')}">Events</a> <code>GET ${apiPath('/events')}</code></li>
          <li><a href="${apiPath('/alerts')}">Alerts</a> <code>GET ${apiPath('/alerts')}</code></li>
          <li><a href="${apiPath('/profiles')}">Profiles</a> <code>GET ${apiPath('/profiles')}</code></li>
          <li><a href="${apiPath('/firmware')}">Firmware</a> <code>GET ${apiPath('/firmware')}</code></li>
          <li><a href="${apiPath('/fortigates')}">FortiGates</a> <code>GET ${apiPath('/fortigates')}</code></li>
          <li><a href="${apiPath('/switches')}">Switches</a> <code>GET ${apiPath('/switches')}</code></li>
          <li><a href="${apiPath('/aps')}">Access Points</a> <code>GET ${apiPath('/aps')}</code></li>
          <li><a href="${apiPath('/aps/rogues')}">Rogue APs</a> <code>GET ${apiPath('/aps/rogues')}</code></li>
          <li><a href="${apiPath('/clients')}">Clients</a> <code>GET ${apiPath('/clients')}</code></li>
          <li><a href="${apiPath('/gateways')}">Gateway list</a> <code>GET ${apiPath('/gateways')}</code></li>
        </ul>
        <p>Configured bind: <code>${serverConfig.apiHost}:${serverConfig.apiPort}</code></p>
        <p>API prefix: <code>${serverConfig.apiPrefix}</code></p>
      </div>
    </main>
  </body>
</html>`);
  });

  app.get(apiPath(), requireSession, (_request, response) => {
    response.json({
      name: 'EdgeOps Cloud API',
      version: '1.0.0',
      docs: apiPath('/docs'),
      openApi: apiPath('/openapi.json'),
      routes: {
        health: apiPath('/health'),
        login: apiPath('/auth/login'),
        session: apiPath('/auth/session'),
        logout: apiPath('/auth/logout'),
        users: apiPath('/users'),
        setupStatus: apiPath('/setup/status'),
        setupWizard: apiPath('/setup/wizard'),
        sites: apiPath('/sites'),
        siteDetail: apiPath('/sites/:id'),
        siteHistory: apiPath('/sites/:id/history'),
        siteTopology: apiPath('/sites/:id/topology'),
        siteConfigSnapshots: apiPath('/sites/:id/config-snapshots'),
        siteConfigSync: apiPath('/sites/:id/config-snapshots/sync'),
        siteConfigDownload: apiPath('/sites/:id/config-snapshots/:snapshotId/download'),
        siteConfigDiff: apiPath('/sites/:id/config-diffs'),
        alerts: apiPath('/alerts'),
        events: apiPath('/events'),
        profiles: apiPath('/profiles'),
        firmware: apiPath('/firmware'),
        fortiGates: apiPath('/fortigates'),
        fortiGateDetail: apiPath('/fortigates/:id'),
        topology: apiPath('/topology'),
        switches: apiPath('/switches'),
        switchDetail: apiPath('/switches/:id'),
        switchActions: apiPath('/switches/:id/actions'),
        accessPoints: apiPath('/aps'),
        rogueAccessPoints: apiPath('/aps/rogues'),
        accessPointDetail: apiPath('/aps/:id'),
        accessPointActions: apiPath('/aps/:id/actions'),
        clients: apiPath('/clients'),
        gateways: apiPath('/gateways'),
        gatewayApiKeys: apiPath('/gateways/:gatewayId/api-keys'),
        syncConfig: apiPath('/gateways/:gatewayId/sync-config'),
        configCache: apiPath('/gateways/:gatewayId/config-cache'),
        latestConfigCache: apiPath('/gateways/:gatewayId/config-cache/latest'),
      },
    });
  });

  app.get(apiPath('/health'), (_request, response) => {
    response.json({
      ok: true,
      storage: serverConfig.database.client,
    });
  });

  app.get(apiPath('/openapi.json'), requireSession, (_request, response) => {
    response.json(openApiDocument);
  });

  app.use(apiPath('/docs'), requireSession, swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(apiPath('/auth'), createAuthRouter({ authStore, sessionTtlHours: serverConfig.sessionTtlHours }));
  app.post(apiPath('/logout'), requireSession, async (request, response) => {
    await authStore.deleteSessionByToken(request.auth.token);
    clearSessionCookie(response, request);
    response.status(204).send();
  });
  app.use(apiPath(), requireSession);
  app.use(apiPath('/setup'), createSetupRouter({ setupStore }));
  app.use(apiPath('/sites'), createSitesRouter({ siteStore, fortiGateClient, siteConfigArchiveService, historyService, topologyService }));
  app.use(apiPath('/alerts'), createAlertsRouter({ alertService }));
  app.use(apiPath('/events'), createEventsRouter({ historyStore }));
  app.use(apiPath('/profiles'), createProfilesRouter({ inventoryService }));
  app.use(apiPath('/firmware'), createFirmwareRouter({ inventoryService }));
  app.use(apiPath('/fortigates'), createFortiGatesRouter({ siteStore, fortiGateClient, hostScanService }));
  app.use(apiPath('/topology'), createTopologyRouter({ topologyService }));
  app.use(apiPath('/switches'), createSwitchesRouter({ siteStore, fortiGateClient, deviceActionService, inventoryCacheService }));
  app.use(apiPath('/aps'), createApsRouter({ siteStore, fortiGateClient, deviceActionService, inventoryCacheService }));
  app.use(apiPath('/clients'), createClientsRouter({ siteStore, fortiGateClient, inventoryCacheService }));
  app.use(apiPath('/users'), createUsersRouter({ authStore, siteStore }));

  app.use(
    apiPath('/gateways'),
    createGatewayRouter({
      repository,
      gatewayConfigService,
    }),
  );

  const server = app.listen(serverConfig.apiPort, serverConfig.apiHost, () => {
    console.log(`EdgeOps gateway cache API listening on http://${serverConfig.apiHost}:${serverConfig.apiPort}${serverConfig.apiPrefix}`);
    if (verboseLogging) {
      console.log('[api] Verbose request logging enabled');
    }
  });

  siteConfigArchiveService.startScheduler();
  historyService.startScheduler();

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${serverConfig.apiPort} is already in use. Check your .env value for EDGEOPS_API_PORT or stop the existing process.`,
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
