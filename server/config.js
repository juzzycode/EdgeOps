import 'dotenv/config';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), './data');
const setupDir = path.resolve(dataDir, './setup');

const normalizeApiPrefix = (value) => {
  const trimmed = String(value ?? '/api').trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');

  return normalized || '/api';
};

export const serverConfig = {
  apiHost: process.env.EDGEOPS_API_HOST ?? '127.0.0.1',
  apiPort: Number(process.env.EDGEOPS_API_PORT ?? process.env.EDGEOPS_PORT ?? 8787),
  apiPrefix: normalizeApiPrefix(process.env.EDGEOPS_API_PREFIX),
  dbPath: path.resolve(process.cwd(), process.env.EDGEOPS_DB_PATH ?? path.join(dataDir, 'edgeops-cache.sqlite')),
  secret: process.env.EDGEOPS_SECRET ?? '',
  corsOrigin: process.env.EDGEOPS_CORS_ORIGIN ?? '*',
  fortiGateRequestTimeoutMs: Number(process.env.EDGEOPS_FORTIGATE_TIMEOUT_MS ?? 15000),
  sitesDbPath: path.resolve(dataDir, 'sites.sqlite'),
  authDbPath: path.resolve(dataDir, 'auth.sqlite'),
  sessionTtlHours: Number(process.env.EDGEOPS_SESSION_TTL_HOURS ?? 12),
  defaultAdminUsername: process.env.EDGEOPS_DEFAULT_ADMIN_USERNAME ?? 'admin',
  defaultAdminPassword: process.env.EDGEOPS_DEFAULT_ADMIN_PASSWORD ?? 'edgeops-admin',
  setupFiles: {
    username: path.resolve(setupDir, 'username.sqlite'),
    password: path.resolve(setupDir, 'password.sqlite'),
    fortigateIp: path.resolve(setupDir, 'fortigate-ip.sqlite'),
    fortigateApiKey: path.resolve(setupDir, 'fortigate-api-key.sqlite'),
  },
};
