# Gateway Config Caching

## Purpose

The backend scaffold supports storing firewall or gateway connection metadata, attaching multiple API keys per gateway, and downloading each gateway configuration into a local SQLite cache.

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

This backend uses the `sqlite` and `sqlite3` packages so it works on Node 20, including environments where `node:sqlite` is not available.

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm run server
```

The server automatically loads values from `.env` in the project root.

## Production Recommendations

- Replace local key storage with a real secret manager
- Add authentication and authorization middleware
- Add audit logging for key creation and config downloads
- Add scheduled background sync jobs
- Add certificate and TLS validation controls where needed
