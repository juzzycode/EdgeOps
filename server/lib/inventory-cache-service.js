const staleDownWindowMs = 30 * 60 * 1000;
const refreshThrottleMs = 60 * 1000;
const inFlightRefreshes = new Map();

const siteRecentlyMarkedDown = (site) => {
  const checkedAt = new Date(site.monitor_checked_at || '').getTime();
  if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > staleDownWindowMs) {
    return false;
  }

  return (
    site.monitor_status === 'offline' ||
    site.monitor_wan_status === 'offline' ||
    site.monitor_api_reachable === 0 ||
    Number(site.latency_packet_loss) === 100
  );
};

export const createInventoryCacheService = ({ siteStore }) => ({
  siteRecentlyMarkedDown,

  async refreshCache(site, cacheKey, loadLive, { logLabel, force = false } = {}) {
    if (!force && siteRecentlyMarkedDown(site)) {
      return null;
    }

    const refreshKey = `${site.id}:${cacheKey}`;
    if (inFlightRefreshes.has(refreshKey)) {
      return inFlightRefreshes.get(refreshKey);
    }

    const cached = await siteStore.getInventoryCache(site.id, cacheKey);
    const updatedAt = new Date(cached?.updatedAt || '').getTime();
    if (!force && Number.isFinite(updatedAt) && Date.now() - updatedAt < refreshThrottleMs) {
      return cached?.payload ?? null;
    }

    const refresh = (async () => {
      try {
        const livePayload = await loadLive();
        await siteStore.setInventoryCache(site.id, cacheKey, livePayload);
        return livePayload;
      } catch (error) {
        console.error(`[${logLabel}] Failed to refresh ${cacheKey} cache for site ${site.id}:`, error);
        await siteStore.markSiteNonResponsive(site.id, error);
        return cached?.payload ?? null;
      } finally {
        inFlightRefreshes.delete(refreshKey);
      }
    })();

    inFlightRefreshes.set(refreshKey, refresh);
    return refresh;
  },

  async listCachedOrRefresh(site, cacheKey, loadLive, { logLabel } = {}) {
    const cached = await siteStore.getInventoryCache(site.id, cacheKey);
    if (!siteRecentlyMarkedDown(site)) {
      void this.refreshCache(site, cacheKey, loadLive, { logLabel }).catch(() => null);
    }

    return cached?.payload ?? [];
  },

  async refreshSiteInventories(site, fortiGateClient, { force = false } = {}) {
    if (!force && siteRecentlyMarkedDown(site)) return;

    const switches = await this.refreshCache(site, 'switches', () => fortiGateClient.listManagedSwitchesForSite(site), {
      logLabel: 'inventory-cache',
      force,
    });

    await Promise.allSettled([
      this.refreshCache(site, 'accessPoints', () => fortiGateClient.listManagedAccessPointsForSite(site), {
        logLabel: 'inventory-cache',
        force,
      }),
      this.refreshCache(site, 'rogueAccessPoints', () => fortiGateClient.listRogueAccessPointsForSite(site), {
        logLabel: 'inventory-cache',
        force,
      }),
      this.refreshCache(site, 'clients', () => fortiGateClient.listClientsForSite(site), {
        logLabel: 'inventory-cache',
        force,
      }),
    ]);

    await Promise.allSettled(
      (Array.isArray(switches) ? switches : []).map((device) =>
        this.refreshCache(site, `switchVlans:${device.id}`, () => fortiGateClient.listManagedSwitchVlansForSite(site, device.id), {
          logLabel: 'inventory-cache',
          force,
        }),
      ),
    );
  },

  async findCachedItem(siteId, cacheKey, itemId) {
    const cached = await siteStore.getInventoryCache(siteId, cacheKey);
    const payload = Array.isArray(cached?.payload) ? cached.payload : [];
    return payload.find((item) => item?.id === itemId) ?? null;
  },
});
