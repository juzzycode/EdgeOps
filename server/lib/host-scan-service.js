import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const runNmap = async (args, timeout) => {
  const { stdout, stderr } = await execFileAsync('nmap', args, {
    timeout,
    windowsHide: true,
  });
  return [stdout, stderr].filter(Boolean).join('\n').trim();
};

const parseOpenPorts = (output) =>
  String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\/(tcp|udp)\s+/.test(line))
    .map((line) => {
      const parts = line.split(/\s+/);
      const [portToken, state = '', service = '', ...versionParts] = parts;
      const [port, protocol] = portToken.split('/');
      return {
        port: Number(port),
        protocol,
        state,
        service,
        version: versionParts.join(' ').trim(),
      };
    })
    .filter((entry) => Number.isFinite(entry.port));

const parseHostState = (output) => {
  const normalized = String(output || '');
  if (/Host is up/i.test(normalized)) return 'up';
  if (/Host is down/i.test(normalized)) return 'down';
  if (/0 hosts up/i.test(String(output || ''))) return 'down';
  return 'unknown';
};

export const createHostScanService = () => ({
  async scanTarget(target, options = {}) {
    if (!isIP(String(target || ''))) {
      throw new Error('A valid IP address is required for scanning.');
    }

    try {
      const deep = Boolean(options.deep);
      let rawOutput = '';
      let openPorts = [];
      let hostState = 'unknown';

      if (deep) {
        const discoveryOutput = await runNmap(
          ['-Pn', '-n', '-T4', '-p-', '--min-rate', '5000', String(target)],
          180_000,
        );
        const discoveryPorts = parseOpenPorts(discoveryOutput);
        const hostStateFromDiscovery = parseHostState(discoveryOutput);

        if (discoveryPorts.length) {
          const portList = discoveryPorts.map((entry) => entry.port).join(',');
          const serviceOutput = await runNmap(
            ['-Pn', '-n', '-T4', '-sV', '-sC', '-p', portList, String(target)],
            180_000,
          );
          rawOutput = [
            '=== Deep Scan: Port Discovery ===',
            discoveryOutput,
            '',
            '=== Deep Scan: Service Enumeration ===',
            serviceOutput,
          ]
            .filter(Boolean)
            .join('\n');
          openPorts = parseOpenPorts(serviceOutput);
          hostState = parseHostState(serviceOutput) !== 'unknown' ? parseHostState(serviceOutput) : hostStateFromDiscovery;
        } else {
          rawOutput = [
            '=== Deep Scan: Port Discovery ===',
            discoveryOutput,
          ].join('\n');
          openPorts = discoveryPorts;
          hostState = hostStateFromDiscovery;
        }
      } else {
        rawOutput = await runNmap(['-Pn', '-n', '-sV', '--top-ports', '100', String(target)], 45_000);
        openPorts = parseOpenPorts(rawOutput);
        hostState = parseHostState(rawOutput);
      }

      return {
        target: String(target),
        scannedAt: new Date().toISOString(),
        status: 'success',
        hostState,
        summary: openPorts.length
          ? `${openPorts.length} open port${openPorts.length === 1 ? '' : 's'} detected${deep ? ' during deep scan' : ''}`
          : `No open ports detected in the scanned ${deep ? 'full port range' : 'top 100 ports'}`,
        openPorts,
        rawOutput,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'nmap scan failed';
      return {
        target: String(target),
        scannedAt: new Date().toISOString(),
        status: 'failed',
        hostState: 'unknown',
        summary: 'Scan failed',
        openPorts: [],
        rawOutput: '',
        error: /ENOENT/i.test(message) ? 'nmap is not installed or not available on the server PATH.' : message,
      };
    }
  },
});
