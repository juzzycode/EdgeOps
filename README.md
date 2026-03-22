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
Sites are now onboarded from the UI with an Add Site wizard under `/sites`, where you can enter the site metadata plus FortiGate connection details.
Sites can also be edited or deleted from the Sites UI, which is the preferred way to manage them because the backend keeps the SQLite file in memory while it is running.
If your frontend cannot reach the backend on the same origin, set `VITE_API_BASE_URL`, for example `VITE_API_BASE_URL=http://192.168.1.10:18787`.
If you accidentally use `http://localhost:18787` while opening the UI from another device, the frontend now rewrites that to the current browser host automatically.
The backend also allows cross-origin requests by default for this flow.

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

## Architecture Overview

- `src/app`
  - Top-level app composition and route wiring.
- `src/components`
  - Reusable layout, panel, chart, table, drawer, and status UI components.
- `src/features`
  - Page-oriented feature modules for dashboard, switches, APs, sites, clients, alerts, profiles, firmware, and settings.
- `src/mocks`
  - Seed data for switches, APs, clients, alerts, firmware, profiles, and event logs plus optional demo sites.
- `src/services`
  - Async API service functions with live site calls and mock inventory modules for the rest of the UI.
- `src/store`
  - Lightweight global UI state for theme, role, site selection, command palette state, and live refresh ticks.
- `src/types`
  - Shared TypeScript interfaces for realistic network-management data models.

## Real API Integration Seams

- Site onboarding and FortiGate summaries already flow through `server/routes/sites.js` and `src/services/api.ts`.
- Site records support create, edit, and delete flows through the same `/api/sites` backend.
- Expand the FortiGate client in `server/lib/fortigate-client.js` with more endpoints as device inventory moves off mock data.
- Use `server/index.js` plus the SQLite-backed gateway cache for real firewall or gateway config retrieval.
- Keep page components unchanged where possible by preserving return shapes from the mock service layer.
- Add websocket or SSE subscriptions in `src/app/App.tsx` or a dedicated live data provider.
- Extend role gating from `src/store/useAppStore.ts` into route guards and action permission checks.
- Swap mock entity IDs with backend-generated identifiers and pagination metadata.

## Notes

- The UI supports light and dark themes.
- Mock device actions like reboot, blink LED, port toggle, and profile assignment are routed through a service function so they can later call backend command endpoints.
- Tables, drawers, summary panels, and charts are reusable and structured for future expansion.
- Gateway config caching is documented in `docs/GATEWAYS.md`.
- The optional site admin username/password fields are stored today but not used for polling yet. They are reserved for future SSH or CLI-assisted collection flows, such as commands that can expose live PoE draw not present in the current REST endpoints.
