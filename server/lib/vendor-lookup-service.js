import https from 'node:https';

const fallbackIntervalMs = 550;
let lastFallbackRequestAt = 0;

const normalizeMac = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '');

const formatMac = (value) => {
  const normalized = normalizeMac(value);
  if (normalized.length < 12) return value;
  return normalized.match(/.{1,2}/g)?.join(':') || value;
};

const requestText = (url) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        headers: {
          Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
          'User-Agent': 'EdgeOps-Cloud/0.9',
        },
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`Vendor lookup failed with HTTP ${response.statusCode}`));
            return;
          }
          resolve(body);
        });
      },
    );

    request.setTimeout(8_000, () => {
      reject(new Error('Vendor lookup timed out'));
      request.destroy();
    });
    request.on('error', reject);
    request.end();
  });

const waitForFallbackSlot = async () => {
  const delayMs = Math.max(0, lastFallbackRequestAt + fallbackIntervalMs - Date.now());
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  lastFallbackRequestAt = Date.now();
};

const parseMacVendorLookupResponse = (text) => {
  const payload = JSON.parse(text);
  if (!Array.isArray(payload) || !payload.length) return null;
  const company = String(payload[0]?.company || '').trim();
  return company || null;
};

const decodeHtml = (value) =>
  String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const parseMacLookupHtml = (text) => {
  const titleMatch = String(text).match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
  if (titleMatch) {
    const vendor = decodeHtml(titleMatch[1]).trim();
    if (vendor && !/^mac address/i.test(vendor)) return vendor;
  }

  const vendorMatch = String(text).match(/Vendor name:\s*<\/[^>]+>\s*([^<]+)</i);
  if (vendorMatch) {
    const vendor = decodeHtml(vendorMatch[1]).trim();
    if (vendor) return vendor;
  }

  return null;
};

export const createVendorLookupService = ({ siteStore }) => ({
  async lookupByMac(mac) {
    const normalized = normalizeMac(mac);
    if (normalized.length < 12) {
      return null;
    }

    const cached = await siteStore.getMacVendorLookup(normalized);
    if (cached?.vendor_name) {
      return cached.vendor_name;
    }

    const formattedMac = formatMac(normalized);

    try {
      const responseText = await requestText(`https://www.macvendorlookup.com/api/v2/${formattedMac}`);
      const vendor = parseMacVendorLookupResponse(responseText);
      if (vendor) {
        await siteStore.upsertMacVendorLookup({
          macAddress: normalized,
          vendorName: vendor,
          source: 'macvendorlookup',
        });
        return vendor;
      }
    } catch {
      // Fall through to backup provider.
    }

    try {
      await waitForFallbackSlot();
      const responseText = await requestText(`https://maclookup.app/search/result?mac=${encodeURIComponent(formattedMac)}`);
      const vendor = parseMacLookupHtml(responseText);
      if (vendor) {
        await siteStore.upsertMacVendorLookup({
          macAddress: normalized,
          vendorName: vendor,
          source: 'maclookup',
        });
        return vendor;
      }
    } catch {
      // Ignore lookup failures and keep the client name unresolved.
    }

    return null;
  },
});
