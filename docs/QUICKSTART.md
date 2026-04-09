# Quickstart

## What This Is

EdgeOps Cloud is a frontend-first network management UI for:

- Switches
- Wireless access points
- Sites
- FortiGates
- Clients
- Alerts
- Profiles
- Firmware lifecycle

The site onboarding flow, live inventory views, alerts, profiles, and firmware lifecycle pages now use backend API calls.

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

For the full site onboarding guide, role model, FortiGate API key guidance, ping requirements, and config archive restrictions, see `docs/SITES.md`.

You can later edit or delete a site directly from the Sites page. That is the preferred workflow over editing `data/sites.sqlite` by hand while the API is running.

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
- expect `site_admin` and `read_only` users with an assigned site to see only that site in the top selector

## Daily FortiGate Config Archive

Each live site can now archive the full FortiGate configuration once per day.

How it works:

- each site has its own `Enable daily FortiGate config archive` setting
- the backend checks for a daily snapshot in the background while it is running
- successful snapshots are stored per site in the site database
- failed daily attempts are retried on later scheduler passes until a successful snapshot exists for that date
- the site detail page shows the archive, daily download links, and diffs between successful days

You can also force a fresh pull for today from the site detail page with `Refresh Today's Snapshot`.

## FortiGate Detail And Host Scans

With a live site connected, you can open `/fortigates` and drill into a FortiGate detail page.

Implemented there now:

- interfaces
- VPNs
- firewall policies
- DHCP leases
- HA status

DHCP lease behavior:

- lease IPs are clickable
- clicking a lease opens a drawer
- the drawer can show cached host scan results if that host was scanned before
- `Scan Host` runs a basic `nmap` scan
- `Deep Scan` runs a two-stage scan:
  - full TCP port discovery
  - targeted scripted follow-up against only the discovered open ports

Important:

- `nmap` must be installed on the backend host
- scan results are cached in the site database
- cached scans prefer MAC address identity when the lease MAC is available

## Unknown Client Vendor Lookups

Unknown clients and unknown DHCP lease hostnames can now be enriched from cached MAC vendor lookups.

Behavior:

- only unknown or placeholder identities are looked up
- results are cached locally so the same MAC is not looked up repeatedly
- primary provider is `macvendorlookup.com`
- fallback provider is `maclookup.app`
- fallback requests are rate-limited in-process

## Build

Only run this when you want to test a production build:

```bash
npm run build
```

## Production Start

To run both the backend and a production frontend together:

```bash
chmod +x ./start.sh
./start.sh
```

By default this:

- builds `dist/`
- starts the API on `EDGEOPS_PORT` or `8787`
- starts the production frontend on `EDGEOPS_FRONTEND_PORT` or `8080`
- proxies frontend `/api` traffic back to the backend automatically

To stop a running production instance from another shell:

```bash
chmod +x ./stop.sh
./stop.sh
```

For nginx and Apache examples, see `docs/DEPLOYMENT.md` plus the stub files in `docs/deploy/`.

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
- Device actions like reboot and blink LED now go through authenticated backend endpoints with audit history and live target validation.
- Site detail now includes persisted history and a live topology view sourced from the backend.
- Ping-based WAN latency requires the backend host to be able to reach the FortiGate management IP over ICMP.
- Config archive can require broader FortiGate API permissions than normal read-only monitoring.
- The optional site admin username/password fields are reserved for future SSH or CLI-assisted collection and are not used by the current REST polling flow.
