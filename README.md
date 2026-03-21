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

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

4. Start the gateway cache API:

```bash
npm run server
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
  - Seed data for sites, switches, APs, clients, alerts, firmware, profiles, and event logs.
- `src/services`
  - Mock API service functions that intentionally mirror future async REST calls.
- `src/store`
  - Lightweight global UI state for theme, role, site selection, command palette state, and live refresh ticks.
- `src/types`
  - Shared TypeScript interfaces for realistic network-management data models.

## Real API Integration Seams

- Replace `src/services/api.ts` mock functions with real REST client calls.
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
