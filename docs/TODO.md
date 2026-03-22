# TODO

## High Priority

- Fix firmware version collection where FortiGate inventory still reports generic values instead of the actual running version.
- Add real switch port VLAN change support from the UI.
- Add SSH or CLI-assisted collection for attributes not exposed well through current REST endpoints.
  This should include live PoE draw, power state, voltage, current, and other low-level switch details.
- Expand backend device actions from audit-only validation into real execution paths where FortiGate supports them cleanly.

## Multi-Vendor Roadmap

- Add Meraki support.
  This should include site onboarding, inventory sync, APs, switches, clients, alerts, topology, and firmware views.
- Add UniFi support.
  This should include site onboarding, inventory sync, APs, switches, clients, alerts, topology, and firmware views.
- Generalize the current FortiGate-first data model into a multi-vendor abstraction layer so the UI can stay consistent across platforms.
- Add vendor-aware onboarding and credentials storage for each platform.

## Switching

- Add real switch port VLAN changes.
- Add port enable and disable actions backed by real device mutations.
- Add port description changes backed by real device mutations.
- Add richer LLDP or CDP neighbor visibility where the controller exposes it.
- Add live PoE telemetry through SSH or alternate APIs.
- Add port error trend history instead of point-in-time counters only.
- Add bulk switch operations for selected devices.

## Wireless

- Improve AP firmware version accuracy.
- Add better per-AP operational state from direct monitor endpoints instead of heuristics where possible.
- Add real AP rename, reboot, LED, and radio enable or disable actions.
- Add richer rogue AP detection and classification if more controller data is available.
- Add RF history such as channel changes, client load over time, and retry or SNR trends.

## Sites

- Add site map integration instead of the current address placeholder.
- Add site edit and delete actions on the site detail page as well as the site list.
- Add optional WAN circuit metadata such as provider, circuit id, speed, and contract notes.
- Add site health SLA-style rollups over time from persisted history.

## Clients

- Add real historical client connection timelines.
- Add richer client profiling such as device type classification, IoT tagging, and OS normalization.
- Add block or quarantine workflows if the underlying platform supports them.
- Add search filters for wired, wireless, vendor, VLAN, SSID, and health.

## Alerts And History

- Add alert acknowledgement and persistence state.
- Add alert suppression or mute rules.
- Add notification delivery such as email, webhook, or Slack.
- Add history retention controls and pruning policies.
- Add operator audit filtering and export.

## Topology

- Improve topology accuracy with stronger device-to-device relationship inference.
- Add click-through topology drilldowns.
- Add path health overlays and link utilization overlays.
- Add topology export or snapshot support.

## Profiles And Firmware

- Add actionable profile assignment from the Profiles page.
- Add staged firmware rollout creation and approval workflows.
- Add upgrade eligibility checks with stronger vendor-specific validation.
- Add config drift views between intended profile state and observed device state.

## Authentication And Access

- Add per-feature permissions beyond the current role tiers.
- Add external identity provider or SSO support.
- Add MFA support.
- Add user audit history for login activity and password changes.

## Backend And Platform

- Add websocket or SSE live updates for inventory, alerts, and actions.
- Add API pagination and server-side filtering where inventories grow large.
- Add scheduled background jobs for more history collectors beyond site summary.
- Add secret-manager integration for production credential storage.
- Add backup and restore flows for the EdgeOps application databases.

## UX Polish

- Add better empty-state guidance for brand-new installations.
- Add in-app diagnostics for backend connectivity and FortiGate reachability.
- Add CSV or JSON export for more inventory and history tables.
- Add mobile-friendly pinned detail panels for hover-heavy views.
