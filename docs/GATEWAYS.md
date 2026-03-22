# Gateway Config Caching

## Purpose

The backend scaffold supports storing firewall or gateway connection metadata, attaching multiple API keys per gateway, and downloading each gateway configuration into a local SQLite cache.

It also includes site onboarding endpoints for storing site metadata and FortiGate connection details.
Site summaries now cache a `ping` probe as well, so the UI can show average latency, packet loss, and the last ping timestamp alongside FortiGate API reachability.

## Storage Model

SQLite tables:

- `gateways`
- `gateway_api_keys`
- `gateway_config_cache`

## What Gets Stored

For each gateway:

- Name
- Base URL
- Vendor label
- Site name
- Auth header name
- Config export path

For each API key:

- Friendly name
- Gateway association
- Encrypted or encoded key value
- Created timestamp
- Last used timestamp

For each cached config:

- Sync status
- SHA-256 hash
- Full config payload
- Metadata JSON
- Error text if sync failed
- Fetch timestamp

## Multiple Gates And Keys

The API is designed so one deployment can manage:

- Many gateways
- Many API keys per gateway
- Many cached config snapshots per gateway

By default, sync uses the newest key for a gateway unless a specific `apiKeyId` is supplied.

## Security Note

If `EDGEOPS_SECRET` is set, API keys are stored with AES-256-GCM encryption.

If `EDGEOPS_SECRET` is not set, keys fall back to local base64 encoding so development is unblocked. That fallback is not suitable for production.

## Backend Endpoints

### API Index

`GET /`

`GET /api`

### Sites

`GET /api/sites`

`POST /api/sites`

`GET /api/sites/:id`

`PATCH /api/sites/:id`

`DELETE /api/sites/:id`

`POST /api/sites/load-demo`

Example create-site body:

```json
{
  "name": "Denver Branch",
  "address": "1801 California St, Denver, CO",
  "timezone": "America/Denver",
  "region": "Mountain",
  "fortigateName": "DEN-BRANCH-FGT",
  "fortigateIp": "192.0.2.14:8443",
  "fortigateApiKey": "replace-with-real-fortigate-key",
  "adminUsername": "admin",
  "adminPassword": "replace-if-needed"
}
```

Notes:

- The generated shorthand site id stays stable after creation even if you rename the site later.
- `fortigateIp` can be either a plain host/IP or `host:port` for non-default HTTPS ports.
- `adminUsername` and `adminPassword` are currently stored only as optional future SSH/CLI credentials. They are not used by the current FortiGate REST polling flow.

### Setup Compatibility

`GET /api/setup/status`

`POST /api/setup/wizard`

These older bootstrap endpoints are still present for compatibility, but the preferred workflow is now the `Add Site` flow in the Sites UI.

### Interactive API Docs

`GET /api/docs`

### OpenAPI JSON

`GET /api/openapi.json`

### Health

`GET /api/health`

### Gateways

`GET /api/gateways`

`POST /api/gateways`

Example body:

```json
{
  "name": "Austin Edge Firewall",
  "baseUrl": "https://10.0.0.1",
  "vendor": "generic",
  "siteName": "Austin HQ",
  "authHeader": "Authorization",
  "configPath": "/api/config/export"
}
```

### API Keys

`GET /api/gateways/:gatewayId/api-keys`

`POST /api/gateways/:gatewayId/api-keys`

Example body:

```json
{
  "name": "Primary Admin Key",
  "apiKey": "replace-with-real-key"
}
```

### Config Sync

`POST /api/gateways/:gatewayId/sync-config`

Optional body:

```json
{
  "apiKeyId": "key_123"
}
```

### Config Cache

`GET /api/gateways/:gatewayId/config-cache`

`GET /api/gateways/:gatewayId/config-cache/latest`

## Run

Recommended runtime:

- Node.js 20 or newer

This backend uses `sql.js` so it keeps a SQLite database file without requiring a native `sqlite3` binary. That avoids common glibc and platform mismatch issues on Linux hosts.

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm run server
```

The server automatically loads values from `.env` in the project root.

Important:

- Use the site edit/delete API or UI while the server is running.
- Avoid editing `data/sites.sqlite` manually until the API is stopped, because the in-memory database will otherwise overwrite on-disk changes during the next write.

## Production Recommendations

- Replace local key storage with a real secret manager
- Add authentication and authorization middleware
- Add audit logging for key creation and config downloads
- Add scheduled background sync jobs
- Add certificate and TLS validation controls where needed
