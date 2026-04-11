#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { serverConfig } from '../server/config.js';
import { createAuthStore } from '../server/lib/auth-store.js';
import { createDatabase } from '../server/lib/database.js';
import { createHistoryStore } from '../server/lib/history-store.js';
import { createSetupStore } from '../server/lib/setup-store.js';
import { createSiteStore } from '../server/lib/site-store.js';

const gatewayTables = ['gateways', 'gateway_api_keys', 'gateway_config_cache'];
const siteTables = [
  'sites',
  'site_config_snapshots',
  'switch_port_overrides',
  'host_scan_cache',
  'mac_vendor_cache',
  'site_metric_history',
  'device_action_events',
  'alert_history',
];
const authTables = ['users', 'sessions'];
const setupKeys = ['username', 'password', 'fortigateIp', 'fortigateApiKey'];

const quoteIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));

  return {
    dryRun: args.has('--dry-run'),
  };
};

const readSqliteRows = async (SQL, filePath, tableName) => {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const sqliteDb = new SQL.Database(fs.readFileSync(filePath));
  try {
    const table = sqliteDb.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [tableName],
    );
    try {
      if (!table.step()) return [];
    } finally {
      table.free();
    }

    const rows = [];
    const statement = sqliteDb.prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`);
    try {
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
    } finally {
      statement.free();
    }

    return rows;
  } finally {
    sqliteDb.close();
  }
};

const upsertRow = async (mysqlDb, tableName, row) => {
  const columns = Object.keys(row);
  if (!columns.length) return;

  const assignments = columns.map((column) => `${quoteIdentifier(column)} = VALUES(${quoteIdentifier(column)})`);
  const sql = `
    INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
    ON DUPLICATE KEY UPDATE ${assignments.join(', ')}
  `;

  await mysqlDb.run(sql, ...columns.map((column) => row[column] ?? null));
};

const importTable = async ({ SQL, mysqlDb, sqliteFile, tableName, dryRun }) => {
  const rows = await readSqliteRows(SQL, sqliteFile, tableName);
  if (!rows.length) {
    return { tableName, count: 0 };
  }

  if (!dryRun) {
    for (const row of rows) {
      await upsertRow(mysqlDb, tableName, row);
    }
  }

  return { tableName, count: rows.length };
};

const importSetupValues = async ({ SQL, mysqlDb, dryRun }) => {
  let count = 0;

  for (const key of setupKeys) {
    const filePath = serverConfig.setupFiles[key];
    const rows = await readSqliteRows(SQL, filePath, 'setup_values');
    for (const row of rows) {
      const imported = {
        setup_key: row.key || key,
        value: row.value,
        updated_at: row.updated_at,
      };
      count += 1;

      if (!dryRun) {
        await upsertRow(mysqlDb, 'setup_values', imported);
      }
    }
  }

  return { tableName: 'setup_values', count };
};

const logResults = (title, results) => {
  console.log(`\n${title}`);
  for (const result of results) {
    console.log(`  ${result.tableName}: ${result.count}`);
  }
};

const main = async () => {
  const { dryRun } = parseArgs();

  if (serverConfig.database.client !== 'mysql') {
    console.error('Set EDGEOPS_DB_CLIENT=mysql before running this importer.');
    process.exit(1);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });

  const mysqlDb = await createDatabase(serverConfig.dbPath, serverConfig.database);
  const siteStore = createSiteStore({ db: mysqlDb });
  await siteStore.init();
  const historyStore = createHistoryStore({ db: mysqlDb });
  await historyStore.init();
  await createAuthStore({
    db: mysqlDb,
    sessionTtlHours: serverConfig.sessionTtlHours,
    defaultAdminUsername: serverConfig.defaultAdminUsername,
    defaultAdminPassword: serverConfig.defaultAdminPassword,
    seedDefaultAdmin: false,
  });
  await createSetupStore({
    files: serverConfig.setupFiles,
    db: mysqlDb,
    secret: serverConfig.secret,
  });

  console.log(`Importing SQLite data into MySQL database "${serverConfig.database.mysql.database}".`);
  if (dryRun) {
    console.log('Dry run only. No MySQL rows will be written.');
  }

  const gatewayResults = [];
  for (const tableName of gatewayTables) {
    gatewayResults.push(await importTable({
      SQL,
      mysqlDb,
      sqliteFile: serverConfig.dbPath,
      tableName,
      dryRun,
    }));
  }

  const siteResults = [];
  for (const tableName of siteTables) {
    siteResults.push(await importTable({
      SQL,
      mysqlDb,
      sqliteFile: serverConfig.sitesDbPath,
      tableName,
      dryRun,
    }));
  }

  const authResults = [];
  for (const tableName of authTables) {
    authResults.push(await importTable({
      SQL,
      mysqlDb,
      sqliteFile: serverConfig.authDbPath,
      tableName,
      dryRun,
    }));
  }

  const setupResult = await importSetupValues({ SQL, mysqlDb, dryRun });

  logResults('Gateway cache', gatewayResults);
  logResults('Sites and history', siteResults);
  logResults('Auth', authResults);
  logResults('Setup', [setupResult]);

  console.log('\nImport complete. Keep EDGEOPS_SECRET unchanged so encrypted values continue to decrypt.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
