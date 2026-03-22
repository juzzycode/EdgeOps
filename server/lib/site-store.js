import crypto from 'node:crypto';

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

const baseShorthand = (name) => {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return cleaned[0]?.slice(0, 3) || 'site';
};

export const createSiteStore = ({ db }) => ({
  async init() {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        shorthand_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        timezone TEXT NOT NULL,
        region TEXT NOT NULL,
        fortigate_name TEXT,
        fortigate_ip TEXT,
        fortigate_api_key TEXT,
        admin_username TEXT,
        admin_password TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    const columns = await db.all(`PRAGMA table_info(sites)`);
    const columnNames = new Set(columns.map((column) => String(column.name)));
    const migrations = [
      ['latency_avg_ms', 'ALTER TABLE sites ADD COLUMN latency_avg_ms REAL'],
      ['latency_min_ms', 'ALTER TABLE sites ADD COLUMN latency_min_ms REAL'],
      ['latency_max_ms', 'ALTER TABLE sites ADD COLUMN latency_max_ms REAL'],
      ['latency_packet_loss', 'ALTER TABLE sites ADD COLUMN latency_packet_loss REAL'],
      ['latency_checked_at', 'ALTER TABLE sites ADD COLUMN latency_checked_at TEXT'],
      ['latency_error', 'ALTER TABLE sites ADD COLUMN latency_error TEXT'],
      ['config_archive_enabled', 'ALTER TABLE sites ADD COLUMN config_archive_enabled INTEGER NOT NULL DEFAULT 1'],
    ];

    for (const [columnName, sql] of migrations) {
      if (!columnNames.has(columnName)) {
        await db.exec(sql);
      }
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS site_config_snapshots (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        status TEXT NOT NULL,
        config_sha256 TEXT,
        config_blob TEXT,
        diff_sha256 TEXT,
        change_summary_json TEXT,
        error_text TEXT,
        fetched_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(site_id, snapshot_date),
        FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_site_config_snapshots_site_date
        ON site_config_snapshots(site_id, snapshot_date DESC);

      CREATE TABLE IF NOT EXISTS switch_port_overrides (
        id TEXT PRIMARY KEY,
        site_id TEXT NOT NULL,
        switch_id TEXT NOT NULL,
        port_number TEXT NOT NULL,
        description_override TEXT,
        vlan_override TEXT,
        enabled_override INTEGER,
        updated_by TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(switch_id, port_number),
        FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_switch_port_overrides_switch
        ON switch_port_overrides(switch_id, port_number);
    `);
  },

  async listSites() {
    return db.all(`SELECT * FROM sites ORDER BY name ASC`);
  },

  async getSiteById(id) {
    return (await db.get(`SELECT * FROM sites WHERE id = ?`, id)) ?? null;
  },

  async nextShorthandId(name) {
    const root = `site-${baseShorthand(name)}`;
    let candidate = root;
    let counter = 2;

    while (await db.get(`SELECT shorthand_id FROM sites WHERE shorthand_id = ?`, candidate)) {
      candidate = `${root}-${counter}`;
      counter += 1;
    }

    return candidate;
  },

  async createSite(input) {
    const shorthandId = await this.nextShorthandId(input.name);
    const row = {
      id: makeId('site'),
      shorthand_id: shorthandId,
      name: input.name,
      address: input.address,
      timezone: input.timezone,
      region: input.region,
      fortigate_name: input.fortigateName ?? '',
      fortigate_ip: input.fortigateIp ?? '',
      fortigate_api_key: input.fortigateApiKey ?? '',
      admin_username: input.adminUsername ?? '',
      admin_password: input.adminPassword ?? '',
      config_archive_enabled: input.configArchiveEnabled === false ? 0 : 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    await db.run(
      `
        INSERT INTO sites (
          id, shorthand_id, name, address, timezone, region, fortigate_name, fortigate_ip,
          fortigate_api_key, admin_username, admin_password, config_archive_enabled, is_demo, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `,
      row.id,
      row.shorthand_id,
      row.name,
      row.address,
      row.timezone,
      row.region,
      row.fortigate_name,
      row.fortigate_ip,
      row.fortigate_api_key,
      row.admin_username,
      row.admin_password,
      row.config_archive_enabled,
      row.created_at,
      row.updated_at,
    );

    return this.getSiteById(row.id);
  },

  async updateSite(id, input) {
    const current = await this.getSiteById(id);
    if (!current) return null;

    const row = {
      ...current,
      name: input.name ?? current.name,
      address: input.address ?? current.address,
      timezone: input.timezone ?? current.timezone,
      region: input.region ?? current.region,
      fortigate_name: input.fortigateName ?? current.fortigate_name,
      fortigate_ip: input.fortigateIp ?? current.fortigate_ip,
      fortigate_api_key: input.fortigateApiKey ?? current.fortigate_api_key,
      admin_username: input.adminUsername ?? current.admin_username,
      admin_password: input.adminPassword ?? current.admin_password,
      config_archive_enabled: input.configArchiveEnabled !== undefined ? (input.configArchiveEnabled ? 1 : 0) : current.config_archive_enabled,
      updated_at: nowIso(),
    };

    await db.run(
      `
        UPDATE sites
        SET name = ?, address = ?, timezone = ?, region = ?, fortigate_name = ?, fortigate_ip = ?,
            fortigate_api_key = ?, admin_username = ?, admin_password = ?, config_archive_enabled = ?, updated_at = ?
        WHERE id = ?
      `,
      row.name,
      row.address,
      row.timezone,
      row.region,
      row.fortigate_name,
      row.fortigate_ip,
      row.fortigate_api_key,
      row.admin_username,
      row.admin_password,
      row.config_archive_enabled,
      row.updated_at,
      id,
    );

    return this.getSiteById(id);
  },

  async deleteSite(id) {
    const current = await this.getSiteById(id);
    if (!current) return false;

    await db.run(`DELETE FROM sites WHERE id = ?`, id);
    return true;
  },

  async updateLatencyCache(id, latency) {
    await db.run(
      `
        UPDATE sites
        SET latency_avg_ms = ?, latency_min_ms = ?, latency_max_ms = ?, latency_packet_loss = ?,
            latency_checked_at = ?, latency_error = ?, updated_at = ?
        WHERE id = ?
      `,
      latency.avgMs,
      latency.minMs,
      latency.maxMs,
      latency.packetLoss,
      latency.checkedAt,
      latency.error,
      nowIso(),
      id,
    );

    return this.getSiteById(id);
  },

  async listSiteConfigSnapshots(siteId) {
    return db.all(
      `
        SELECT *
        FROM site_config_snapshots
        WHERE site_id = ?
        ORDER BY snapshot_date DESC, fetched_at DESC
      `,
      siteId,
    );
  },

  async getSiteConfigSnapshot(siteId, snapshotId) {
    return (
      (await db.get(
        `
          SELECT *
          FROM site_config_snapshots
          WHERE site_id = ? AND id = ?
        `,
        siteId,
        snapshotId,
      )) ?? null
    );
  },

  async getSiteConfigSnapshotByDate(siteId, snapshotDate) {
    return (
      (await db.get(
        `
          SELECT *
          FROM site_config_snapshots
          WHERE site_id = ? AND snapshot_date = ?
        `,
        siteId,
        snapshotDate,
      )) ?? null
    );
  },

  async getPreviousSuccessfulSiteConfigSnapshot(siteId, snapshotDate) {
    return (
      (await db.get(
        `
          SELECT *
          FROM site_config_snapshots
          WHERE site_id = ? AND status = 'success' AND snapshot_date < ?
          ORDER BY snapshot_date DESC, fetched_at DESC
          LIMIT 1
        `,
        siteId,
        snapshotDate,
      )) ?? null
    );
  },

  async upsertSiteConfigSnapshot(input) {
    const existing = await this.getSiteConfigSnapshotByDate(input.siteId, input.snapshotDate);
    const now = nowIso();

    if (!existing) {
      const id = makeId('cfgsnap');
      await db.run(
        `
          INSERT INTO site_config_snapshots (
            id, site_id, snapshot_date, status, config_sha256, config_blob, diff_sha256,
            change_summary_json, error_text, fetched_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        id,
        input.siteId,
        input.snapshotDate,
        input.status,
        input.configSha256,
        input.configBlob,
        input.diffSha256,
        input.changeSummary ? JSON.stringify(input.changeSummary) : null,
        input.errorText,
        now,
        now,
      );

      return this.getSiteConfigSnapshot(input.siteId, id);
    }

    await db.run(
      `
        UPDATE site_config_snapshots
        SET status = ?, config_sha256 = ?, config_blob = ?, diff_sha256 = ?, change_summary_json = ?,
            error_text = ?, fetched_at = ?, updated_at = ?
        WHERE id = ?
      `,
      input.status,
      input.configSha256,
      input.configBlob,
      input.diffSha256,
      input.changeSummary ? JSON.stringify(input.changeSummary) : null,
      input.errorText,
      now,
      now,
      existing.id,
    );

    return this.getSiteConfigSnapshot(input.siteId, existing.id);
  },

  async listSwitchPortOverrides(switchId) {
    return db.all(
      `
        SELECT *
        FROM switch_port_overrides
        WHERE switch_id = ?
        ORDER BY port_number ASC
      `,
      switchId,
    );
  },

  async upsertSwitchPortOverride({ siteId, switchId, portNumber, description, vlan, enabled, updatedBy }) {
    const existing = await db.get(
      `
        SELECT *
        FROM switch_port_overrides
        WHERE switch_id = ? AND port_number = ?
      `,
      switchId,
      portNumber,
    );

    const updatedAt = nowIso();
    if (!existing) {
      await db.run(
        `
          INSERT INTO switch_port_overrides (
            id, site_id, switch_id, port_number, description_override, vlan_override, enabled_override, updated_by, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        makeId('portoverride'),
        siteId,
        switchId,
        portNumber,
        description ?? null,
        vlan ?? null,
        enabled === undefined ? null : enabled ? 1 : 0,
        updatedBy ?? null,
        updatedAt,
      );
    } else {
      await db.run(
        `
          UPDATE switch_port_overrides
          SET description_override = ?, vlan_override = ?, enabled_override = ?, updated_by = ?, updated_at = ?
          WHERE id = ?
        `,
        description ?? null,
        vlan ?? null,
        enabled === undefined ? null : enabled ? 1 : 0,
        updatedBy ?? null,
        updatedAt,
        existing.id,
      );
    }

    return db.get(
      `
        SELECT *
        FROM switch_port_overrides
        WHERE switch_id = ? AND port_number = ?
      `,
      switchId,
      portNumber,
    );
  },
});
