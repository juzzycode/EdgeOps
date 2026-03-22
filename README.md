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

### Frontend Plus Gateway API

If you also want the local backend running, start it in a second terminal:

```bash
npm run server
```

The backend automatically reads `.env` for `EDGEOPS_PORT`, `EDGEOPS_DB_PATH`, and `EDGEOPS_SECRET`.
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

## Implemented Pages

- `/dashboard`
- `/sites`
- `/sites/:id`
- `/switches`
- `/switches/:id`
- `/aps`
- `/aps/:id`
- `/clients`
- `/alerts`
- `/profiles`
- `/firmware`
- `/settings`
- `/login`

## Architecture Overview

- `src/app`
  - Top-level app composition and route wiring.
- `src/components`
  - Reusable layout, panel, chart, table, drawer, and status UI components.
- `src/features`
  - Page-oriented feature modules for dashboard, switches, APs, sites, clients, alerts, profiles, firmware, and settings.
- `src/mocks`
  - Seed data for demo fallback behavior plus optional demo sites where live inventory is not available.
- `src/services`
  - Async API service functions that bridge the frontend to live site, alert, profile, and firmware routes plus demo fallbacks.
- `src/store`
  - Lightweight global UI state for theme, authenticated session user, site selection, command palette state, and live refresh ticks.
- `src/types`
  - Shared TypeScript interfaces for realistic network-management data models.

## Real API Integration Seams

- Site onboarding and FortiGate summaries already flow through `server/routes/sites.js` and `src/services/api.ts`.
- Site records support create, edit, and delete flows through the same `/api/sites` backend.
- Live alert generation now flows through `/api/alerts`, combining site reachability, switch state, and AP health into a shared alert feed for the dashboard and alert center.
- Live derived profile catalogs now flow through `/api/profiles`, grouping observed switch, AP, SSID, VLAN, and port policy data by the selected site scope.
- Live firmware compliance now flows through `/api/firmware`, organizing switch and AP versions into rollout-ready groups.
- Authentication now flows through `/api/auth/*`, with session cookies protecting live inventory routes and `/api/users` handling operator management.
- Each live site can now archive a full FortiGate configuration once per day, expose downloadable daily snapshots, and render diffs between archived days directly from the site detail view.
  This archive is controlled per site and can be enabled or disabled from the site create/edit workflow.
- Expand the FortiGate client in `server/lib/fortigate-client.js` with more endpoints as device inventory moves off mock data.
- Use `server/index.js` plus the SQLite-backed gateway cache for real firewall or gateway config retrieval.
- Keep page components unchanged where possible by preserving return shapes from the mock service layer.
- Add websocket or SSE subscriptions in `src/app/App.tsx` or a dedicated live data provider.
- Swap mock entity IDs with backend-generated identifiers and pagination metadata.

## Notes

- The UI supports light and dark themes.
- The UI now has a real login page, session-backed logout, and three enforced roles: `super_admin`, `site_admin`, and `read_only`.
- Site detail now includes a config archive section with daily FortiGate backups, downloadable config files, and diffs between snapshot days.
- Mock device actions like reboot, blink LED, port toggle, and profile assignment are routed through a service function so they can later call backend command endpoints.
- Tables, drawers, summary panels, and charts are reusable and structured for future expansion.
- Gateway config caching is documented in `docs/GATEWAYS.md`.
- The optional site admin username/password fields are stored today but not used for polling yet. They are reserved for future SSH or CLI-assisted collection flows, such as commands that can expose live PoE draw not present in the current REST endpoints.
