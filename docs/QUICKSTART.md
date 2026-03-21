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

This project currently uses mocked data and a mock async service layer so real APIs can be connected later without rewriting the UI.

## Prerequisites

- Node.js 20+ recommended
- npm 10+ recommended

## Install

From the project root:

```bash
npm install
```

## Start The App

```bash
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Main Folders

- `src/app`
  - App composition and route registration
- `src/components`
  - Reusable UI building blocks
- `src/features`
  - Page-level modules
- `src/mocks`
  - Seed data
- `src/services`
  - Mock API functions
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

1. Replace mock functions with real HTTP client calls.
2. Preserve returned data shapes where possible.
3. Add websocket or SSE subscriptions for live updates.
4. Move role rules from UI hints into real authorization checks.

## Notes

- Theme switching is already wired in.
- Role switching is mocked for `super_admin`, `site_admin`, and `read_only`.
- Device actions like reboot and blink LED are simulated through the service layer.
