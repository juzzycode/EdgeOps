# Features

## Overview

EdgeOps Cloud is designed as an original, modern network operations UI focused on clarity, fast visibility, and clean device workflows for distributed environments.

## Dashboard

The dashboard includes:

- Total sites
- Total switches
- Total APs
- Total clients
- Device health summary
- Offline device count
- Bandwidth usage chart
- Top sites by client count
- Recent alerts
- Firmware compliance snapshot
- PoE usage summary
- SSID distribution summary
- Topology placeholder

## Switch Management

Implemented capabilities:

- Inventory table
- Search
- Status filtering
- Bulk selection UI
- Export and refresh actions
- Detail page
- Summary cards
- Port map visualization
- Port status list
- VLAN and neighbor view
- Event history
- Config summary
- Simulated actions:
  - reboot
  - blink LED
  - sync config
  - change port description
  - enable or disable port
  - assign VLAN profile

## Wireless AP Management

Implemented capabilities:

- AP inventory table
- Search
- Bulk selection UI
- Export and refresh actions
- Detail page
- Radio status
- SSID summary
- Neighbor AP view
- Event history
- Config summary
- Simulated actions:
  - reboot AP
  - blink LED
  - rename AP
  - assign profile
  - enable or disable radio

## Site Management

Implemented capabilities:

- Site card grid
- Site health and WAN state summary
- Device count rollups
- Site detail page
- Local switch summary
- Local AP summary
- Local alerts
- Map placeholder for future geospatial views

## Clients

Implemented capabilities:

- Wired and wireless client inventory
- Search by hostname, MAC, IP, and username
- Client detail drawer
- Usage and status visibility
- Historical connection placeholder

## Alerts

Implemented capabilities:

- Alert center view
- Severity filtering
- Time-window filtering
- Device-type filtering
- Recent alert list
- Alert detail drawer
- Live generated alerts from FortiGate-backed signals including:
  - site connectivity degraded
  - device offline
  - switch uplink degraded
  - switch port errors
  - AP high channel utilization
  - wireless client health degradation

## Profiles

Implemented capabilities:

- Device profiles
- VLAN profiles
- Port profiles
- Live derived profile catalog based on current switch, AP, SSID, VLAN, and port assignments
- Site-aware filtering through the global site selector

Planned next step:

- Add create, edit, duplicate, assign, and delete flows

## Firmware Lifecycle

Implemented capabilities:

- Compliance summary
- Current vs target version table
- Upgrade group view
- Eligibility indicators
- Live site-aware compliance records for switches and APs

Planned next step:

- Add staged rollout creation and approval workflows

## Settings

Implemented capabilities:

- Real password change flow
- User management for super admins
- Site-scoped user assignment
- Session-backed role display
- Workspace and telemetry preferences
- Live platform posture snapshot

## Platform Features

Shared platform features already in place:

- React + TypeScript architecture
- Tailwind-based design system
- Zustand UI state
- React Router navigation
- Recharts widgets
- Lucide icons
- Real login page and session-backed logout
- Cookie-based API session enforcement
- SQLite-backed operator database
- Dark and light theme support
- Responsive desktop-first layout
- Mobile navigation support
- Reusable tables, panels, badges, drawers, and charts
- Mock live refresh tick

## Future Expansion Areas

- Real backend API integration
- External identity provider or SSO integration
- Global command palette behavior
- Live websocket updates
- Table pagination and server-side filtering
- Real topology graph
- Map integration
- Audit logging
- Config diffing
- Firmware rollout orchestration
