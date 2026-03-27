import crypto from 'node:crypto';
import https from 'node:https';
import { createTwoFilesPatch } from 'diff';

const dailyCheckIntervalMs = 60 * 60 * 1000;
const requestTimeoutMs = 20_000;

const toSnapshotDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
};

const toHash = (content) => crypto.createHash('sha256').update(content).digest('hex');
const rollingKeyLinePattern = /^[A-Za-z0-9+/=]{32,}$/;

const parseFortiGateTarget = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return { authority: '' };

  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return { authority: parsed.host };
  } catch {
    return { authority: raw };
  }
};

const fortiGateBaseUrl = (value) => {
  const target = parseFortiGateTarget(value);
  return target.authority ? `https://${target.authority}` : '';
};

const resolveSiteVdom = (site) => String(site?.fortigate_vdom || '').trim() || 'root';

const requestText = (url, apiKey) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const request = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'text/plain, application/octet-stream, */*',
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (settled) return;
          settled = true;

          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`FortiGate config backup failed with HTTP ${response.statusCode}`));
            return;
          }

          resolve(body);
        });
      },
    );

    request.setTimeout(requestTimeoutMs, () => {
      if (settled) return;
      settled = true;
      reject(new Error(`FortiGate config backup timed out after ${requestTimeoutMs / 1000}s`));
      request.destroy();
    });

    request.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    request.end();
  });

const buildDiffStats = (patchText) => {
  const lines = patchText.split('\n');
  let addedLines = 0;
  let removedLines = 0;

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) addedLines += 1;
    if (line.startsWith('-')) removedLines += 1;
  }

  return {
    addedLines,
    removedLines,
    hasChanges: addedLines > 0 || removedLines > 0,
  };
};

const serializeSnapshot = (snapshot) => ({
  id: snapshot.id,
  siteId: snapshot.site_id,
  snapshotDate: snapshot.snapshot_date,
  status: snapshot.status,
  configSha256: snapshot.config_sha256 || null,
  diffSha256: snapshot.diff_sha256 || null,
  changeSummary: snapshot.change_summary_json ? JSON.parse(snapshot.change_summary_json) : null,
  errorText: snapshot.error_text || null,
  fetchedAt: snapshot.fetched_at,
  updatedAt: snapshot.updated_at,
});

const serializeDiff = ({ fromSnapshot, toSnapshot, patchText, stats }) => ({
  fromSnapshot: serializeSnapshot(fromSnapshot),
  toSnapshot: serializeSnapshot(toSnapshot),
  diffText: patchText,
  stats,
});

const isRollingKeyLine = (line) => {
  const trimmed = String(line || '').trim();
  return trimmed.startsWith('set passphrase ENC ') || rollingKeyLinePattern.test(trimmed);
};

const stripRollingKeys = (content) =>
  String(content || '')
    .split(/\r?\n/)
    .filter((line) => !isRollingKeyLine(line))
    .join('\n');

export const createSiteConfigArchiveService = ({ siteStore }) => {
  const buildDiffFromSnapshots = (fromSnapshot, toSnapshot, { filterRollingKeys = false } = {}) => {
    const fromContent = filterRollingKeys ? stripRollingKeys(fromSnapshot.config_blob) : fromSnapshot.config_blob || '';
    const toContent = filterRollingKeys ? stripRollingKeys(toSnapshot.config_blob) : toSnapshot.config_blob || '';
    const patchText = createTwoFilesPatch(
      `${fromSnapshot.snapshot_date}.conf`,
      `${toSnapshot.snapshot_date}.conf`,
      fromContent,
      toContent,
      fromSnapshot.snapshot_date,
      toSnapshot.snapshot_date,
      { context: 3 },
    );
    const stats = buildDiffStats(patchText);
    return {
      patchText,
      stats,
      diffSha256: stats.hasChanges ? toHash(patchText) : null,
    };
  };

  const fetchSiteConfig = async (site) => {
    if (!site.fortigate_ip || !site.fortigate_api_key) {
      throw new Error('FortiGate IP or API key is missing for this site.');
    }

    const requestUrl = `${fortiGateBaseUrl(site.fortigate_ip)}/api/v2/monitor/system/config/backup?scope=global&vdom=${encodeURIComponent(resolveSiteVdom(site))}`;
    return requestText(requestUrl, site.fortigate_api_key);
  };

  return {
    async enforceRetention(siteId) {
      const site = await siteStore.getSiteById(siteId);
      if (!site) return;

      const keepCount = site.config_backups_to_keep;
      const snapshots = await siteStore.listSiteConfigSnapshots(siteId);

      if (keepCount === null || keepCount === undefined) {
        return;
      }

      if (keepCount <= 0) {
        await Promise.all(snapshots.map((snapshot) => siteStore.deleteSiteConfigSnapshot(siteId, snapshot.id)));
        return;
      }

      const snapshotsToDelete = snapshots.slice(keepCount);
      await Promise.all(snapshotsToDelete.map((snapshot) => siteStore.deleteSiteConfigSnapshot(siteId, snapshot.id)));
    },

    async ensureDailySnapshot(siteId, { force = false } = {}) {
      const site = await siteStore.getSiteById(siteId);
      if (!site) {
        throw new Error('Site is not eligible for config archiving');
      }
      if (!site.config_archive_enabled || site.config_backups_to_keep === 0) {
        throw new Error('Config archive is disabled for this site');
      }

      const snapshotDate = toSnapshotDate();
      const existing = await siteStore.getSiteConfigSnapshotByDate(siteId, snapshotDate);
      if (existing && existing.status === 'success' && !force) {
        return serializeSnapshot(existing);
      }

      try {
        const configBlob = await fetchSiteConfig(site);
        const configSha256 = toHash(configBlob);
        const previousSnapshot = await siteStore.getPreviousSuccessfulSiteConfigSnapshot(siteId, snapshotDate);
        const diff = previousSnapshot
          ? buildDiffFromSnapshots(previousSnapshot, { snapshot_date: snapshotDate, config_blob: configBlob })
          : { patchText: '', stats: { addedLines: 0, removedLines: 0, hasChanges: false }, diffSha256: null };

        const snapshot = await siteStore.upsertSiteConfigSnapshot({
          siteId,
          snapshotDate,
          status: 'success',
          configSha256,
          configBlob,
          diffSha256: diff.diffSha256,
          changeSummary: previousSnapshot
            ? {
                comparedToDate: previousSnapshot.snapshot_date,
                ...diff.stats,
              }
            : {
                comparedToDate: null,
                ...diff.stats,
              },
          errorText: null,
        });

        await this.enforceRetention(siteId);
        return serializeSnapshot(snapshot);
      } catch (error) {
        const snapshot = await siteStore.upsertSiteConfigSnapshot({
          siteId,
          snapshotDate,
          status: 'failed',
          configSha256: null,
          configBlob: null,
          diffSha256: null,
          changeSummary: null,
          errorText: error instanceof Error ? error.message : 'Unable to archive FortiGate config',
        });

        await this.enforceRetention(siteId);
        return serializeSnapshot(snapshot);
      }
    },

    async listSnapshots(siteId) {
      const snapshots = await siteStore.listSiteConfigSnapshots(siteId);
      return snapshots.map(serializeSnapshot);
    },

    async getSnapshot(siteId, snapshotId) {
      const snapshot = await siteStore.getSiteConfigSnapshot(siteId, snapshotId);
      return snapshot ? serializeSnapshot(snapshot) : null;
    },

    async getSnapshotDownload(siteId, snapshotId) {
      const snapshot = await siteStore.getSiteConfigSnapshot(siteId, snapshotId);
      if (!snapshot || snapshot.status !== 'success' || !snapshot.config_blob) {
        return null;
      }

      return {
        filename: `${siteId}-${snapshot.snapshot_date}.conf`,
        content: snapshot.config_blob,
        snapshot: serializeSnapshot(snapshot),
      };
    },

    async getDiff(siteId, fromSnapshotId, toSnapshotId, { filterRollingKeys = false } = {}) {
      const snapshots = await siteStore.listSiteConfigSnapshots(siteId);
      const successfulSnapshots = snapshots.filter((snapshot) => snapshot.status === 'success' && snapshot.config_blob);

      const resolveById = (snapshotId) => successfulSnapshots.find((snapshot) => snapshot.id === snapshotId) || null;

      const toSnapshot =
        (toSnapshotId ? resolveById(toSnapshotId) : successfulSnapshots[0]) || null;
      const fromSnapshot =
        (fromSnapshotId ? resolveById(fromSnapshotId) : successfulSnapshots.find((snapshot) => snapshot.id !== toSnapshot?.id)) || null;

      if (!fromSnapshot || !toSnapshot) {
        return null;
      }

      const diff = buildDiffFromSnapshots(fromSnapshot, toSnapshot, { filterRollingKeys });
      return serializeDiff({
        fromSnapshot,
        toSnapshot,
        patchText: diff.patchText,
        stats: diff.stats,
      });
    },

    startScheduler() {
      const run = async () => {
        const sites = await siteStore.listSites();
        for (const site of sites) {
          if (!site.config_archive_enabled || !site.fortigate_ip || !site.fortigate_api_key) continue;
          try {
            await this.ensureDailySnapshot(site.id);
          } catch (error) {
            console.error(`[site-config-archive] Failed daily snapshot for ${site.id}:`, error);
          }
        }
      };

      setTimeout(() => {
        void run();
      }, 5_000);

      return setInterval(() => {
        void run();
      }, dailyCheckIntervalMs);
    },
  };
};
