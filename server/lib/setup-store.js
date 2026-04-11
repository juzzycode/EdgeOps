import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { decryptSecret, encryptSecret } from './crypto.js';

const locateSqlJsFile = (file) => path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
const REQUIRED_KEYS = ['username', 'password', 'fortigateIp', 'fortigateApiKey'];

const createSqlHelpers = async () => {
  const SQL = await initSqlJs({ locateFile: locateSqlJsFile });

  const openDb = async (filePath, createIfMissing = false) => {
    const exists = fs.existsSync(filePath);
    if (!exists && !createIfMissing) return null;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const sqliteDb = new SQL.Database(exists ? fs.readFileSync(filePath) : undefined);

    const persist = () => {
      fs.writeFileSync(filePath, Buffer.from(sqliteDb.export()));
    };

    const run = (sql, params = []) => {
      sqliteDb.run(sql, params);
      persist();
    };

    const get = (sql, params = []) => {
      const statement = sqliteDb.prepare(sql, params);
      try {
        return statement.step() ? statement.getAsObject() : undefined;
      } finally {
        statement.free();
      }
    };

    run(`
      CREATE TABLE IF NOT EXISTS setup_values (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    return {
      get,
      run,
    };
  };

  return { openDb };
};

export const createSetupStore = async ({ files, db = null, secret }) => {
  const fieldConfig = {
    username: { filePath: files.username, encrypted: false, label: 'Username' },
    password: { filePath: files.password, encrypted: true, label: 'Password' },
    fortigateIp: { filePath: files.fortigateIp, encrypted: false, label: 'FortiGate IP' },
    fortigateApiKey: { filePath: files.fortigateApiKey, encrypted: true, label: 'FortiGate API Key' },
  };

  if (db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS setup_values (
        setup_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const getValue = async (key) => {
      const config = fieldConfig[key];
      const row = await db.get(`SELECT value, updated_at FROM setup_values WHERE setup_key = ?`, key);
      if (!row) return null;

      return {
        value: config.encrypted ? decryptSecret(String(row.value), secret) : String(row.value),
        updatedAt: String(row.updated_at),
      };
    };

    return {
      files,

      async getStatus() {
        const checks = await Promise.all(
          REQUIRED_KEYS.map(async (key) => {
            const config = fieldConfig[key];
            const stored = await getValue(key);

            return {
              key,
              label: config.label,
              filePath: `mysql:setup_values:${key}`,
              fileExists: Boolean(stored),
              hasValue: Boolean(stored?.value),
              updatedAt: stored?.updatedAt ?? null,
            };
          }),
        );

        return {
          complete: checks.every((check) => check.fileExists && check.hasValue),
          checks,
        };
      },

      async saveSetup(input) {
        const now = new Date().toISOString();

        await Promise.all(
          REQUIRED_KEYS.map(async (key) => {
            const config = fieldConfig[key];
            const value = config.encrypted ? encryptSecret(input[key], secret) : input[key];

            await db.run(
              `
                INSERT INTO setup_values (setup_key, value, updated_at)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  value = VALUES(value),
                  updated_at = VALUES(updated_at)
              `,
              key,
              value,
              now,
            );
          }),
        );

        return this.getStatus();
      },
    };
  }

  const { openDb } = await createSqlHelpers();

  const getValue = async (key) => {
    const config = fieldConfig[key];
    const db = await openDb(config.filePath, false);
    if (!db) return null;

    const row = db.get(`SELECT value, updated_at FROM setup_values WHERE key = ?`, [key]);
    if (!row) return null;

    return {
      value: config.encrypted ? decryptSecret(String(row.value), secret) : String(row.value),
      updatedAt: String(row.updated_at),
    };
  };

  return {
    files,

    async getStatus() {
      const checks = await Promise.all(
        REQUIRED_KEYS.map(async (key) => {
          const config = fieldConfig[key];
          const fileExists = fs.existsSync(config.filePath);
          const stored = fileExists ? await getValue(key) : null;

          return {
            key,
            label: config.label,
            filePath: config.filePath,
            fileExists,
            hasValue: Boolean(stored?.value),
            updatedAt: stored?.updatedAt ?? null,
          };
        }),
      );

      return {
        complete: checks.every((check) => check.fileExists && check.hasValue),
        checks,
      };
    },

    async saveSetup(input) {
      const now = new Date().toISOString();

      await Promise.all(
        REQUIRED_KEYS.map(async (key) => {
          const config = fieldConfig[key];
          const db = await openDb(config.filePath, true);
          const value = config.encrypted ? encryptSecret(input[key], secret) : input[key];

          db.run(
            `
              INSERT INTO setup_values (key, value, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            `,
            [key, value, now],
          );
        }),
      );

      return this.getStatus();
    },
  };
};
