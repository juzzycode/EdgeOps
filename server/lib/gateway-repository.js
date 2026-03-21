import crypto from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.js';

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

export const createGatewayRepository = ({ db, secret }) => {
  return {
    async listGateways() {
      return db.all(`
        SELECT
          g.*,
          (SELECT COUNT(*) FROM gateway_api_keys k WHERE k.gateway_id = g.id) AS api_key_count,
          (
            SELECT c.fetched_at
            FROM gateway_config_cache c
            WHERE c.gateway_id = g.id
            ORDER BY c.fetched_at DESC
            LIMIT 1
          ) AS last_cached_at
        FROM gateways g
        ORDER BY g.name
      `);
    },

    async getGateway(gatewayId) {
      return (await db.get(`SELECT * FROM gateways WHERE id = ?`, gatewayId)) ?? null;
    },

    async createGateway(input) {
      const row = {
        id: makeId('gate'),
        name: input.name,
        base_url: input.baseUrl,
        vendor: input.vendor ?? 'generic',
        site_name: input.siteName ?? '',
        auth_header: input.authHeader ?? 'Authorization',
        config_path: input.configPath ?? '/api/config/export',
        created_at: nowIso(),
        updated_at: nowIso(),
      };

      await db.run(
        `
          INSERT INTO gateways (id, name, base_url, vendor, site_name, auth_header, config_path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        row.id,
        row.name,
        row.base_url,
        row.vendor,
        row.site_name,
        row.auth_header,
        row.config_path,
        row.created_at,
        row.updated_at,
      );
      return this.getGateway(row.id);
    },

    async listApiKeys(gatewayId) {
      return db.all(`
        SELECT id, gateway_id, name, created_at, last_used_at
        FROM gateway_api_keys
        WHERE gateway_id = ?
        ORDER BY created_at DESC
      `, gatewayId);
    },

    async getApiKey(apiKeyId) {
      return (await db.get(`SELECT * FROM gateway_api_keys WHERE id = ?`, apiKeyId)) ?? null;
    },

    async createApiKey(gatewayId, input) {
      const row = {
        id: makeId('key'),
        gateway_id: gatewayId,
        name: input.name,
        encrypted_key: encryptSecret(input.apiKey, secret),
        created_at: nowIso(),
      };

      await db.run(
        `
          INSERT INTO gateway_api_keys (id, gateway_id, name, encrypted_key, created_at)
          VALUES (?, ?, ?, ?, ?)
        `,
        row.id,
        row.gateway_id,
        row.name,
        row.encrypted_key,
        row.created_at,
      );
      return this.getApiKey(row.id);
    },

    async resolveApiKey(gatewayId, apiKeyId) {
      const keyRow = apiKeyId
        ? await db.get(`SELECT * FROM gateway_api_keys WHERE id = ? AND gateway_id = ?`, apiKeyId, gatewayId)
        : await db.get(`
            SELECT *
            FROM gateway_api_keys
            WHERE gateway_id = ?
            ORDER BY created_at DESC
            LIMIT 1
          `, gatewayId);

      if (!keyRow) return null;

      return {
        ...keyRow,
        api_key: decryptSecret(keyRow.encrypted_key, secret),
      };
    },

    async markApiKeyUsed(apiKeyId) {
      await db.run(`UPDATE gateway_api_keys SET last_used_at = ? WHERE id = ?`, nowIso(), apiKeyId);
    },

    async cacheConfig(input) {
      const row = {
        id: makeId('cfg'),
        gateway_id: input.gatewayId,
        api_key_id: input.apiKeyId,
        status: input.status,
        config_sha256: input.configSha256 ?? null,
        config_blob: input.configBlob ?? null,
        metadata_json: JSON.stringify(input.metadata ?? {}),
        error_text: input.errorText ?? null,
        fetched_at: nowIso(),
      };

      await db.run(
        `
          INSERT INTO gateway_config_cache (
            id, gateway_id, api_key_id, status, config_sha256, config_blob, metadata_json, error_text, fetched_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        row.id,
        row.gateway_id,
        row.api_key_id,
        row.status,
        row.config_sha256,
        row.config_blob,
        row.metadata_json,
        row.error_text,
        row.fetched_at,
      );
      return db.get(`SELECT * FROM gateway_config_cache WHERE id = ?`, row.id);
    },

    async listCachedConfigs(gatewayId) {
      return db.all(`
        SELECT id, gateway_id, api_key_id, status, config_sha256, metadata_json, error_text, fetched_at
        FROM gateway_config_cache
        WHERE gateway_id = ?
        ORDER BY fetched_at DESC
      `, gatewayId);
    },

    async getLatestCachedConfig(gatewayId) {
      return (
        await db.get(`
        SELECT *
        FROM gateway_config_cache
        WHERE gateway_id = ?
        ORDER BY fetched_at DESC
        LIMIT 1
      `, gatewayId)
      ) ?? null;
    },
  };
};
