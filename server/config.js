import 'dotenv/config';
import path from 'node:path';

export const serverConfig = {
  port: Number(process.env.EDGEOPS_PORT ?? 8787),
  dbPath: path.resolve(process.cwd(), process.env.EDGEOPS_DB_PATH ?? './data/edgeops-cache.sqlite'),
  secret: process.env.EDGEOPS_SECRET ?? '',
};
