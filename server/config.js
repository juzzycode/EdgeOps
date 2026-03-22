import 'dotenv/config';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), './data');
const setupDir = path.resolve(dataDir, './setup');

export const serverConfig = {
  port: Number(process.env.EDGEOPS_PORT ?? 8787),
  dbPath: path.resolve(process.cwd(), process.env.EDGEOPS_DB_PATH ?? path.join(dataDir, 'edgeops-cache.sqlite')),
  secret: process.env.EDGEOPS_SECRET ?? '',
  corsOrigin: process.env.EDGEOPS_CORS_ORIGIN ?? '*',
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
