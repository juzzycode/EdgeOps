# EdgeOps Cloud

EdgeOps Cloud is an original React + TypeScript network operations UI for distributed switching and wireless management. It is inspired by the general usability goals of modern cloud-managed networking products, but it does not copy proprietary branding, code, screenshots, or design elements from any vendor platform.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand
- Recharts
- lucide-react

## Run

You do not need every command for normal development.

### Frontend Only

Install dependencies once:

```bash
npm install
```

Start the frontend dev server:

```bash
npm run dev -- --host 0.0.0.0
```

Use this when you only want to work on the React UI.

To run the backend plus the Vite frontend together through the launcher:

```bash
./start.sh dev
```

Add `--detach` if you want the launcher to start the processes and return immediately:

```bash
./start.sh dev -d
```

### Frontend Plus Gateway API

If you also want the local backend running, start it in a second terminal:

```bash
npm run server
```

The backend automatically reads `.env` for `EDGEOPS_API_HOST`, `EDGEOPS_API_PORT`, `EDGEOPS_API_PREFIX`, `EDGEOPS_DB_PATH`, and `EDGEOPS_SECRET`.
It also reads `EDGEOPS_DEFAULT_ADMIN_USERNAME`, `EDGEOPS_DEFAULT_ADMIN_PASSWORD`, and `EDGEOPS_SESSION_TTL_HOURS` for the built-in bootstrap admin and session lifetime.
Sites are now onboarded from the UI with an Add Site wizard under `/sites`, where you can enter the site metadata plus FortiGate connection details.
The FortiGate address field accepts either a host/IP like `192.0.2.14` or a host with explicit port like `192.0.2.14:8443`.
Sites can also be edited or deleted from the Sites UI, which is the preferred way to manage them because the backend keeps the SQLite file in memory while it is running.
If your frontend cannot reach the backend on the same origin, set `VITE_API_BASE_URL`, for example `VITE_API_BASE_URL=http://192.168.1.10:18787`.
If you accidentally use `http://localhost:18787` while opening the UI from another device, the frontend now rewrites that to the current browser host automatically.
The backend also allows cross-origin requests by default for this flow.

When the backend starts with an empty auth database, it seeds a bootstrap super admin from `.env`:

- username: `EDGEOPS_DEFAULT_ADMIN_USERNAME`
- password: `EDGEOPS_DEFAULT_ADMIN_PASSWORD`

The shipped fallback is `admin` / `edgeops-admin`, and you should change that after first sign-in.

Then run the frontend dev server:

```bash
npm run dev -- --host 0.0.0.0
```

Optional backend request logging:

```bash
npm run server -- -v
```

### Production Build Check

Only run this when you want to verify a production build:

```bash
npm run build
```

### Production Start

To build the frontend and run both production processes together:

```bash
chmod +x ./start.sh
./start.sh
```

The production frontend serves `dist/` and proxies `/api` to the backend automatically.
It also writes runtime state under `.run/edgeops/` so you can stop it from another shell:

```bash
chmod +x ./stop.sh
./stop.sh
```

Use `./start.sh -d` if you want the stack started in the background instead of supervised in the foreground.

## Implemented Pages

- `/dashboard`
- `/sites`
- `/sites/:id`
- `/switches`
- `/switches/:id`
- `/aps`
- `/aps/:id`
- `/clients`
- `/fortigates`
- `/fortigates/:id`
- `/alerts`
- `/profiles`
- `/firmware`
- `/settings`
- `/login`

## Additional Docs

- `docs/QUICKSTART.md`
- `docs/DEPLOYMENT.md`
- `docs/SITES.md`
- `docs/GATEWAYS.md`
- `docs/FEATURES.md`
- `docs/TODO.md`

## Architecture Overview

- `src/app`
  - Top-level app composition and route wiring.
- `src/components`
  - Reusable layout, panel, chart, table, drawer, and status UI components.
- `src/features`
  - Page-oriented feature modules for dashboard, switches, APs, sites, clients, alerts, profiles, firmware, and settings.
- `src/services`
  - Async API service functions that bridge the frontend to live site, alert, profile, and firmware routes.
- `src/store`
  - Lightweight global UI state for theme, authenticated session user, site selection, command palette state, and live refresh ticks.
- `src/types`
  - Shared TypeScript interfaces for realistic network-management data models.

## Real API Integration Seams

- Site onboarding and FortiGate summaries already flow through `server/routes/sites.js` and `src/services/api.ts`.
- Site records support create, edit, and delete flows through the same `/api/sites` backend.
- Live alert generation now flows through `/api/alerts`, combining site reachability, switch state, and AP health into a shared alert feed for the dashboard and alert center.
- Persisted site history now flows through `/api/sites/:id/history`, storing scheduled snapshots of client counts, switch/AP counts, latency, and alert observations for trend views.
- Live topology now flows through `/api/topology` and `/api/sites/:id/topology`, turning FortiGate-derived site, switch, AP, and client relationships into a rendered topology graph.
- Device operations now flow through `/api/switches/:id/actions` and `/api/aps/:id/actions`, with backend validation, role checks, and persistent audit history exposed through `/api/events`.
- Live derived profile catalogs now flow through `/api/profiles`, grouping observed switch, AP, SSID, VLAN, and port policy data by the selected site scope.
- Live firmware compliance now flows through `/api/firmware`, organizing switch and AP versions into rollout-ready groups.
- FortiGate inventory and detail now flow through `/api/fortigates`, including interfaces, VPNs, policies, DHCP leases, HA status, and host-scan actions from DHCP lease drawers.
- Authentication now flows through `/api/auth/*`, with session cookies protecting live inventory routes and `/api/users` handling operator management.
- Each live site can now archive a full FortiGate configuration once per day, expose downloadable daily snapshots, and render diffs between archived days directly from the site detail view.
  This archive is controlled per site and can be enabled or disabled from the site create/edit workflow.
- Expand the FortiGate client in `server/lib/fortigate-client.js` with more endpoints as device inventory coverage grows.
- Use `server/index.js` plus the SQLite-backed gateway cache for real firewall or gateway config retrieval.
- Keep page components unchanged where possible by preserving return shapes from the live service layer.
- Add websocket or SSE subscriptions in `src/app/App.tsx` or a dedicated live data provider.
- Extend backend-generated identifiers and pagination metadata where needed.

## Notes

- The UI supports light and dark themes.
- The UI now has a real login page, session-backed logout, and three enforced roles: `super_admin`, `site_admin`, and `read_only`.
- The FortiGate section includes live interfaces, VPNs, firewall policies, DHCP leases, HA status, and host scan drawers from lease IPs.
- Unknown clients and DHCP leases can now be enriched with cached MAC vendor lookups using free vendor APIs.
- DHCP lease drawers can run cached basic or deep `nmap` scans through the backend when `nmap` is installed on the server host.
- Site onboarding, FortiGate API key guidance, role behavior, scope enforcement, ping expectations, and config archive restrictions are documented in `docs/SITES.md`.
- Site detail now includes a config archive section with daily FortiGate backups, downloadable config files, and diffs between snapshot days.
- Switch and AP action buttons now go through authenticated backend action endpoints, and every request is written into the shared event history feed.
- The dashboard and site detail pages now use live topology graphs plus persisted site history instead of the earlier topology placeholder and purely point-in-time telemetry.
- Tables, drawers, summary panels, and charts are reusable and structured for future expansion.
- Gateway config caching is documented in `docs/GATEWAYS.md`.
- The optional site admin username/password fields are stored today but not used for polling yet. They are reserved for future SSH or CLI-assisted collection flows, such as commands that can expose live PoE draw not present in the current REST endpoints.
