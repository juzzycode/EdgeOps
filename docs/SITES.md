# Sites And Access

## Purpose

This guide covers:

- how to add a FortiGate-backed site
- what kind of FortiGate API key works best
- what each EdgeOps Cloud user role can do
- site scoping rules
- ping and config archive requirements

## Adding A Site

Open `Sites` and use `Add Site`.

Required fields:

- Site name
- Address
- Timezone
- Region

Typical FortiGate fields:

- FortiGate name
- FortiGate IP or `host:port`
- FortiGate API key

Optional fields:

- Admin username
- Admin password

Current behavior:

- EdgeOps generates a shorthand id like `site-den`
- the shorthand id stays stable after site creation
- non-default FortiGate HTTPS ports are supported, for example `66.11.224.253:8443`
- optional admin username/password are stored for future SSH or CLI-assisted collection, but are not used by the current REST polling flow

## Creating A FortiGate API Key

EdgeOps uses a FortiGate REST API administrator token per site.

General FortiGate workflow:

1. Create or edit a REST API administrator on the FortiGate.
2. Assign the access profile you want that site to use.
3. Generate the API token from the FortiGate admin UI.
4. Paste that token into the site's `FortiGate API Key` field.

Use a dedicated API admin per site when possible instead of reusing a human admin token.

## FortiGate Permission Guidance

Recommended profile by feature:

- `read_only` style FortiGate API admin
  - enough for most status, inventory, and monitor calls
- elevated FortiGate API admin with backup-capable permissions
  - needed for daily config archive and config download endpoints

Important restriction:

- a FortiGate key with a read-only profile may still work for site summary, switch inventory, AP inventory, alerts, and clients
- that same key may fail with `HTTP 403` for config backup
- if config archive is enabled and you see `FortiGate config backup failed with HTTP 403`, the key likely needs broader FortiGate permissions

Practical recommendation:

- use the least privilege token that supports the feature set you actually want on that site
- if you only want monitoring, a read-only FortiGate API admin is usually the right choice
- if you want daily config archive and download, use a FortiGate API admin that is allowed to back up configuration

## EdgeOps Roles

EdgeOps has three application roles:

### `super_admin`

Capabilities:

- log in to the full platform
- see all sites
- switch the top site selector to `All sites` or any individual site
- create, edit, and delete sites
- create, edit, and delete users
- change passwords
- run operator actions across the estate
- manage demo data and global settings

### `site_admin`

Capabilities:

- log in normally
- see only the assigned site
- the top site selector is locked to that site
- edit allowed items within that site scope
- run site-scoped operator actions
- view history, topology, alerts, inventory, and config archive for the assigned site

Restrictions:

- cannot see other sites
- cannot create or delete global users or sites
- backend API calls are server-side scoped to the assigned site

### `read_only`

Capabilities:

- log in normally
- view only the assigned site if one is set
- otherwise view the available global scope allowed by the account
- inspect dashboards, inventory, alerts, topology, and history

Restrictions:

- cannot create, edit, or delete sites
- cannot run switch or AP operator actions
- cannot perform mutating API operations in the UI

## Site Scoping

When a user has an assigned site:

- the backend enforces that scope on `/api/sites`, `/api/switches`, `/api/aps`, `/api/clients`, `/api/alerts`, `/api/topology`, and related site detail routes
- forcing a different `siteId` in the browser or API request returns `403`
- the UI also removes `All sites` from the top selector for scoped users

This means site restriction is not just cosmetic. It is enforced server-side.

## User Management

User management lives in `Settings`.

Implemented behavior:

- bootstrap super admin from `.env`
- real login page
- cookie-backed sessions
- logout destroys the session and returns the user to `/login`
- password change flow
- create, edit, and delete users
- assign `site_admin` or `read_only` users to a specific site

Recommended practice:

- keep one emergency `super_admin`
- use `site_admin` for day-to-day site operators
- use `read_only` for visibility-only staff, auditors, or help desk users

## Ping Requirements

EdgeOps runs a cached `ping -c 3` style latency probe for each live site.

What this means:

- the EdgeOps backend host must be able to reach the FortiGate management address over ICMP
- if ICMP is blocked, site inventory can still work through HTTPS API calls, but latency, packet loss, and related WAN health fields may show warnings or unavailable data
- for FortiGates using `host:port`, EdgeOps strips the port and pings the host only

Ping behavior today:

- results are cached briefly and reused
- WAN latency and packet loss on the site pages come from this probe
- alerts can be generated from degraded packet loss or unreachable pings

## Config Archive Restrictions

Per-site config archive is optional and controlled by the `Enable daily FortiGate config archive` setting.

Current behavior:

- one site-level FortiGate config snapshot per day
- background retries if a daily attempt fails
- manual refresh from the site detail page
- download of successful snapshots only
- diffs only between successful snapshots

Important restrictions:

- disabled sites do not participate in the daily archive scheduler
- a site with insufficient FortiGate API permissions can show `403` for archive pulls even if normal monitoring works
- no diff is available until there are at least two successful snapshot days
- failed snapshots stay visible in the archive list with their error text

## Operator Action Notes

Switch and AP action buttons now go through authenticated backend endpoints and are written to the shared event history.

Current behavior:

- role and site scope are enforced
- the target device is validated against live FortiGate inventory
- the action is recorded in audit history

Current limitation:

- several actions are still marked `manual_required` after validation because the direct FortiGate REST mutation path for that specific command has not been finalized yet

## Related Docs

- `README.md`
- `docs/QUICKSTART.md`
- `docs/GATEWAYS.md`
- `docs/FEATURES.md`
