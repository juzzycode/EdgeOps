# Quickstart

## What This Is

EdgeOps Cloud is a frontend-first network management UI for:

- Switches
- Wireless access points
- Sites
- Clients
- Alerts
- Profiles
- Firmware lifecycle

The site onboarding flow, live inventory views, alerts, profiles, and firmware lifecycle pages now use backend API calls, with demo data still available as a fallback for empty environments.

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

## Install

From the project root:

```bash
npm install
```

## Start The App

For normal frontend work:

```bash
npm run dev -- --host 0.0.0.0
```

Then open the local Vite URL shown in the terminal.

Important:

- Use `npm run dev -- --host 0.0.0.0`
- Not `npm run dev --host 0.0.0.0`
- The extra `--` tells npm to pass `--host` through to Vite

## Start The Gateway Cache API

Only run this if you want the local backend running too:

```bash
npm run server
```

With the backend running, open `/sites` and use `Add Site` to enter:

- Site name
- Address
- Timezone
- Region
- FortiGate name
- FortiGate IP or `host:port`
- FortiGate API key

The backend generates a shorthand site id like `site-den` automatically and then polls the FortiGate for a live summary.

You can later edit or delete a site directly from the Sites page. That is the preferred workflow over editing `data/sites.sqlite` by hand while the API is running.

If you want sample locations instead, use `Load Demo Data` from the Sites page.

## Sign In

The UI now requires a real session.

When the backend auth database is empty, it creates a bootstrap super admin from `.env`:

- `EDGEOPS_DEFAULT_ADMIN_USERNAME`
- `EDGEOPS_DEFAULT_ADMIN_PASSWORD`

If you do not override them, the default login is:

- username: `admin`
- password: `edgeops-admin`

After the first login:

- use `Settings` to change the password
- use `Settings` to create `super_admin`, `site_admin`, and `read_only` operators
- use site assignment on users when you want the backend to scope them to a single site

## Daily FortiGate Config Archive

Each live site can now archive the full FortiGate configuration once per day.

How it works:

- each site has its own `Enable daily FortiGate config archive` setting
- the backend checks for a daily snapshot in the background while it is running
- successful snapshots are stored per site in the site database
- failed daily attempts are retried on later scheduler passes until a successful snapshot exists for that date
- the site detail page shows the archive, daily download links, and diffs between successful days

You can also force a fresh pull for today from the site detail page with `Refresh Today's Snapshot`.

## Build

Only run this when you want to test a production build:

```bash
npm run build
```

## Typical Workflows

### Frontend only

```bash
npm install
npm run dev -- --host 0.0.0.0
```

### Frontend plus backend

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run dev -- --host 0.0.0.0
```

## Main Folders

- `src/app`
  - App composition and route registration
- `src/components`
  - Reusable UI building blocks
- `src/features`
  - Page-level modules
- `src/mocks`
  - Demo fallback seed data
- `src/services`
  - Frontend API client and backend integration helpers
- `src/store`
  - Global UI state
- `src/types`
  - Shared domain models

## Important Routes

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

## Mock API Integration

Today the UI reads from `src/services/api.ts`.

To connect real backend APIs later:

1. Expand the existing live site HTTP calls in `src/services/api.ts`.
2. Preserve returned data shapes where possible.
3. Add websocket or SSE subscriptions for live updates.
4. Extend the existing session and role enforcement with finer-grained permissions or identity providers later.

## Notes

- Theme switching is already wired in.
- Role enforcement is now real for `super_admin`, `site_admin`, and `read_only`.
- Device actions like reboot and blink LED are simulated through the service layer.
- The optional site admin username/password fields are reserved for future SSH or CLI-assisted collection and are not used by the current REST polling flow.
