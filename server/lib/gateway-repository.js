import crypto from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.js';

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

export const createGatewayRepository = ({ db, secret }) => {
  const insertGateway = db.prepare(`
    INSERT INTO gateways (id, name, base_url, vendor, site_name, auth_header, config_path, created_at, updated_at)
    VALUES (@id, @name, @base_url, @vendor, @site_name, @auth_header, @config_path, @created_at, @updated_at)
  `);

  const insertApiKey = db.prepare(`
    INSERT INTO gateway_api_keys (id, gateway_id, name, encrypted_key, created_at)
    VALUES (@id, @gateway_id, @name, @encrypted_key, @created_at)
  `);

  const insertConfigCache = db.prepare(`
    INSERT INTO gateway_config_cache (
      id, gateway_id, api_key_id, status, config_sha256, config_blob, metadata_json, error_text, fetched_at
    )
    VALUES (
      @id, @gateway_id, @api_key_id, @status, @config_sha256, @config_blob, @metadata_json, @error_text, @fetched_at
    )
  `);

  return {
    listGateways() {
      return db.prepare(`
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
      `).all();
    },

    getGateway(gatewayId) {
      return db.prepare(`SELECT * FROM gateways WHERE id = ?`).get(gatewayId) ?? null;
    },

    createGateway(input) {
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

      insertGateway.run(row);
      return this.getGateway(row.id);
    },

    listApiKeys(gatewayId) {
      return db.prepare(`
        SELECT id, gateway_id, name, created_at, last_used_at
        FROM gateway_api_keys
        WHERE gateway_id = ?
        ORDER BY created_at DESC
      `).all(gatewayId);
    },

    getApiKey(apiKeyId) {
      return db.prepare(`SELECT * FROM gateway_api_keys WHERE id = ?`).get(apiKeyId) ?? null;
    },

    createApiKey(gatewayId, input) {
      const row = {
        id: makeId('key'),
        gateway_id: gatewayId,
        name: input.name,
        encrypted_key: encryptSecret(input.apiKey, secret),
        created_at: nowIso(),
      };

      insertApiKey.run(row);
      return this.getApiKey(row.id);
    },

    resolveApiKey(gatewayId, apiKeyId) {
      const keyRow = apiKeyId
        ? db.prepare(`SELECT * FROM gateway_api_keys WHERE id = ? AND gateway_id = ?`).get(apiKeyId, gatewayId)
        : db.prepare(`
            SELECT *
            FROM gateway_api_keys
            WHERE gateway_id = ?
            ORDER BY created_at DESC
            LIMIT 1
          `).get(gatewayId);

      if (!keyRow) return null;

      return {
        ...keyRow,
        api_key: decryptSecret(keyRow.encrypted_key, secret),
      };
    },

    markApiKeyUsed(apiKeyId) {
      db.prepare(`UPDATE gateway_api_keys SET last_used_at = ? WHERE id = ?`).run(nowIso(), apiKeyId);
    },

    cacheConfig(input) {
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

      insertConfigCache.run(row);
      return db.prepare(`SELECT * FROM gateway_config_cache WHERE id = ?`).get(row.id);
    },

    listCachedConfigs(gatewayId) {
      return db.prepare(`
        SELECT id, gateway_id, api_key_id, status, config_sha256, metadata_json, error_text, fetched_at
        FROM gateway_config_cache
        WHERE gateway_id = ?
        ORDER BY fetched_at DESC
      `).all(gatewayId);
    },

    getLatestCachedConfig(gatewayId) {
      return db.prepare(`
        SELECT *
        FROM gateway_config_cache
        WHERE gateway_id = ?
        ORDER BY fetched_at DESC
        LIMIT 1
      `).get(gatewayId) ?? null;
    },
  };
};
