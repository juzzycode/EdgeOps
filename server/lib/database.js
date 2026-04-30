import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const longTextColumns = [
  'admin_password',
  'change_summary_json',
  'config_blob',
  'context_json',
  'description',
  'encrypted_key',
  'error_text',
  'fortigate_api_key',
  'last_sync_error',
  'message',
  'metadata_json',
  'monitor_last_sync_error',
  'open_ports_json',
  'payload_json',
  'password_hash',
  'raw_output',
  'result_json',
  'site_alert_email_recipients',
  'summary',
  'value',
];

const splitStatements = (sql) =>
  String(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

const normalizeParams = (params) => {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
};

const transformMysqlSql = (sql) => {
  let transformed = String(sql).trim();
  if (!transformed || transformed.toUpperCase().startsWith('PRAGMA ')) {
    return '';
  }

  transformed = transformed
    .replace(/\bINSERT OR IGNORE\b/gi, 'INSERT IGNORE')
    .replace(/\bCREATE INDEX IF NOT EXISTS\b/gi, 'CREATE INDEX')
    .replace(/\bREAL\b/g, 'DOUBLE')
    .replace(/\bORDER BY username COLLATE NOCASE\b/g, 'ORDER BY LOWER(username)');

  for (const column of longTextColumns) {
    transformed = transformed.replace(new RegExp(`\\b${column}\\s+TEXT\\b`, 'g'), `${column} LONGTEXT`);
  }

  return transformed.replace(/\bTEXT\b/g, 'VARCHAR(191)');
};

const inlineMysqlLimitParams = (sql, params) => {
  const normalizedParams = [...params];
  const transformedSql = sql.replace(/\bLIMIT\s+\?/gi, () => {
    const rawLimit = normalizedParams.pop();
    const limit = Math.trunc(Number(rawLimit));
    if (!Number.isFinite(limit) || limit < 0) {
      throw new Error(`Invalid MySQL LIMIT value: ${rawLimit}`);
    }

    return `LIMIT ${limit}`;
  });

  return [transformedSql, normalizedParams];
};

const createSqliteDatabase = async (dbPath) => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const SQL = await initSqlJs({
    locateFile: (file) => path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });
  const existingFile = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined;
  const sqliteDb = new SQL.Database(existingFile);

  const persist = () => {
    const data = sqliteDb.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  };

  const db = {
    async exec(sql) {
      sqliteDb.exec(sql);
      persist();
    },

    async run(sql, ...params) {
      sqliteDb.run(sql, normalizeParams(params));
      persist();
      return { changes: sqliteDb.getRowsModified() };
    },

    async get(sql, ...params) {
      const statement = sqliteDb.prepare(sql, normalizeParams(params));
      try {
        return statement.step() ? statement.getAsObject() : undefined;
      } finally {
        statement.free();
      }
    },

    async all(sql, ...params) {
      const statement = sqliteDb.prepare(sql, normalizeParams(params));
      try {
        const rows = [];
        while (statement.step()) {
          rows.push(statement.getAsObject());
        }
        return rows;
      } finally {
        statement.free();
      }
    },
  };

  await db.exec(`PRAGMA foreign_keys = ON;`);
  await db.exec(`PRAGMA journal_mode = WAL;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS gateways (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      vendor TEXT NOT NULL DEFAULT 'generic',
      site_name TEXT,
      auth_header TEXT NOT NULL DEFAULT 'Authorization',
      config_path TEXT NOT NULL DEFAULT '/api/config/export',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gateway_api_keys (
      id TEXT PRIMARY KEY,
      gateway_id TEXT NOT NULL,
      name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY(gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gateway_config_cache (
      id TEXT PRIMARY KEY,
      gateway_id TEXT NOT NULL,
      api_key_id TEXT NOT NULL,
      status TEXT NOT NULL,
      config_sha256 TEXT,
      config_blob TEXT,
      metadata_json TEXT,
      error_text TEXT,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY(gateway_id) REFERENCES gateways(id) ON DELETE CASCADE,
      FOREIGN KEY(api_key_id) REFERENCES gateway_api_keys(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gateway_api_keys_gateway_id
      ON gateway_api_keys(gateway_id);

    CREATE INDEX IF NOT EXISTS idx_gateway_config_cache_gateway_id
      ON gateway_config_cache(gateway_id, fetched_at DESC);
  `);

  return db;
};

const createMysqlPool = async (config) => {
  const mysql = await import('mysql2/promise');
  if (config.uri) {
    return mysql.createPool({
      uri: config.uri,
      waitForConnections: true,
      connectionLimit: config.connectionLimit,
    });
  }

  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? {} : undefined,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
  });
};

const createMysqlDatabase = async (config) => {
  const pool = await createMysqlPool(config);

  const execute = async (sql, params = []) => {
    const transformed = transformMysqlSql(sql);
    if (!transformed) return [[], []];
    const [preparedSql, preparedParams] = inlineMysqlLimitParams(transformed, params);

    try {
      return await pool.execute(preparedSql, preparedParams);
    } catch (error) {
      if (error?.code === 'ER_DUP_KEYNAME' || error?.code === 'ER_TABLE_EXISTS_ERROR') {
        return [[], []];
      }

      throw error;
    }
  };

  const db = {
    async exec(sql) {
      for (const statement of splitStatements(sql)) {
        await execute(statement);
      }
    },

    async run(sql, ...params) {
      const [result] = await execute(sql, normalizeParams(params));
      return { changes: Number(result?.affectedRows ?? 0) };
    },

    async get(sql, ...params) {
      const rows = await this.all(sql, ...params);
      return rows[0];
    },

    async all(sql, ...params) {
      const pragmaMatch = String(sql).trim().match(/^PRAGMA\s+table_info\((\w+)\)$/i);
      if (pragmaMatch) {
        const tableName = pragmaMatch[1];
        const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        return rows.map((row) => ({ name: row.Field }));
      }

      const [rows] = await execute(sql, normalizeParams(params));
      return Array.isArray(rows) ? rows : [];
    },
  };

  await db.exec(`
    CREATE TABLE IF NOT EXISTS gateways (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      vendor TEXT NOT NULL DEFAULT 'generic',
      site_name TEXT,
      auth_header TEXT NOT NULL DEFAULT 'Authorization',
      config_path TEXT NOT NULL DEFAULT '/api/config/export',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gateway_api_keys (
      id TEXT PRIMARY KEY,
      gateway_id TEXT NOT NULL,
      name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY(gateway_id) REFERENCES gateways(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gateway_config_cache (
      id TEXT PRIMARY KEY,
      gateway_id TEXT NOT NULL,
      api_key_id TEXT NOT NULL,
      status TEXT NOT NULL,
      config_sha256 TEXT,
      config_blob TEXT,
      metadata_json TEXT,
      error_text TEXT,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY(gateway_id) REFERENCES gateways(id) ON DELETE CASCADE,
      FOREIGN KEY(api_key_id) REFERENCES gateway_api_keys(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gateway_api_keys_gateway_id
      ON gateway_api_keys(gateway_id);

    CREATE INDEX IF NOT EXISTS idx_gateway_config_cache_gateway_id
      ON gateway_config_cache(gateway_id, fetched_at DESC);
  `);

  return db;
};

export const createDatabase = async (dbPath, config = { client: 'sqlite' }) => {
  if (config.client === 'mysql') {
    return createMysqlDatabase(config.mysql);
  }

  return createSqliteDatabase(dbPath);
};
