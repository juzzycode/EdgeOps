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

const databaseClient = String(process.env.EDGEOPS_DB_CLIENT ?? 'sqlite').trim().toLowerCase();

export const serverConfig = {
  apiHost: process.env.EDGEOPS_API_HOST ?? '127.0.0.1',
  apiPort: Number(process.env.EDGEOPS_API_PORT ?? process.env.EDGEOPS_PORT ?? 8787),
  apiPrefix: normalizeApiPrefix(process.env.EDGEOPS_API_PREFIX),
  database: {
    client: databaseClient === 'mysql' ? 'mysql' : 'sqlite',
    mysql: {
      uri: process.env.EDGEOPS_MYSQL_URI ?? '',
      host: process.env.EDGEOPS_MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.EDGEOPS_MYSQL_PORT ?? 3306),
      user: process.env.EDGEOPS_MYSQL_USER ?? 'edgeops',
      password: process.env.EDGEOPS_MYSQL_PASSWORD ?? '',
      database: process.env.EDGEOPS_MYSQL_DATABASE ?? 'edgeops',
      ssl: process.env.EDGEOPS_MYSQL_SSL === 'true',
      connectionLimit: Number(process.env.EDGEOPS_MYSQL_CONNECTION_LIMIT ?? 10),
    },
  },
  dbPath: path.resolve(process.cwd(), process.env.EDGEOPS_DB_PATH ?? path.join(dataDir, 'edgeops-cache.sqlite')),
  secret: process.env.EDGEOPS_SECRET ?? '',
  corsOrigin: process.env.EDGEOPS_CORS_ORIGIN ?? '',
  fortiGateRequestTimeoutMs: Number(process.env.EDGEOPS_FORTIGATE_TIMEOUT_MS ?? 15000),
  historyPollingIntervalMs: Number(process.env.EDGEOPS_HISTORY_POLLING_INTERVAL_MS ?? 15 * 60 * 1000),
  email: {
    host: process.env.EDGEOPS_SMTP_HOST ?? '',
    port: Number(process.env.EDGEOPS_SMTP_PORT ?? 587),
    secure: process.env.EDGEOPS_SMTP_SECURE === 'true',
    user: process.env.EDGEOPS_SMTP_USER ?? '',
    password: process.env.EDGEOPS_SMTP_PASSWORD ?? '',
    from: process.env.EDGEOPS_SMTP_FROM ?? process.env.EDGEOPS_SMTP_USER ?? '',
  },
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
