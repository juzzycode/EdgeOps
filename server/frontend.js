import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import express from 'express';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const frontendPort = Number(process.env.EDGEOPS_FRONTEND_PORT ?? 8080);
const frontendHost = process.env.EDGEOPS_FRONTEND_HOST ?? '0.0.0.0';
const apiHost = process.env.EDGEOPS_API_HOST ?? '127.0.0.1';
const apiPort = process.env.EDGEOPS_API_PORT ?? process.env.EDGEOPS_PORT ?? 8787;
const apiPrefix = (() => {
  const trimmed = String(process.env.EDGEOPS_API_PREFIX ?? '/api').trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');

  return normalized || '/api';
})();
const apiOrigin = process.env.EDGEOPS_API_ORIGIN ?? `http://${apiHost}:${apiPort}`;

let apiUrl;

try {
  apiUrl = new URL(apiOrigin);
} catch (error) {
  console.error(`Invalid EDGEOPS_API_ORIGIN value: ${apiOrigin}`);
  console.error(error);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath}. Run "npm run build" before starting the production frontend.`);
  process.exit(1);
}

const proxyTransport = apiUrl.protocol === 'https:' ? https : http;
const upstreamApiPort = apiUrl.port || (apiUrl.protocol === 'https:' ? '443' : '80');
const apiBasePath = apiUrl.pathname === '/' ? '' : apiUrl.pathname.replace(/\/$/, '');

const appendForwardedFor = (existing, remoteAddress) => {
  const values = [];

  if (Array.isArray(existing)) {
    values.push(
      ...existing
        .map((value) => value.trim())
        .filter(Boolean),
    );
  } else if (typeof existing === 'string' && existing.trim()) {
    values.push(existing.trim());
  }

  if (typeof remoteAddress === 'string' && remoteAddress.trim()) {
    values.push(remoteAddress.trim());
  }

  return values.join(', ');
};

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(apiPrefix, (request, response) => {
  const proxyRequest = proxyTransport.request(
    {
      protocol: apiUrl.protocol,
      hostname: apiUrl.hostname,
      port: upstreamApiPort,
      method: request.method,
      path: `${apiBasePath}${request.originalUrl}`,
      headers: {
        ...request.headers,
        host: apiUrl.host,
        'x-forwarded-host': request.headers.host ?? '',
        'x-forwarded-proto': request.protocol,
        'x-forwarded-for': appendForwardedFor(request.headers['x-forwarded-for'], request.socket.remoteAddress),
      },
    },
    (proxyResponse) => {
      response.status(proxyResponse.statusCode ?? 502);

      for (const [headerName, headerValue] of Object.entries(proxyResponse.headers)) {
        if (headerValue !== undefined) {
          response.setHeader(headerName, headerValue);
        }
      }

      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on('error', (error) => {
    if (response.headersSent) {
      response.end();
      return;
    }

    response.status(502).json({
      error: `Unable to reach the API upstream at ${apiUrl.origin}`,
      detail: error.message,
    });
  });

  request.on('aborted', () => {
    proxyRequest.destroy();
  });

  request.pipe(proxyRequest);
});

app.use(express.static(distDir, { index: false }));

app.get('*', (request, response, next) => {
  if (path.extname(request.path)) {
    next();
    return;
  }

  response.sendFile(indexPath);
});

const server = app.listen(frontendPort, frontendHost, () => {
  console.log(`EdgeOps frontend listening on http://${frontendHost}:${frontendPort}`);
  console.log(`Proxying ${apiPrefix} requests to ${apiUrl.origin}${apiBasePath || '/'}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${frontendPort} is already in use. Change EDGEOPS_FRONTEND_PORT or stop the existing frontend process.`,
    );
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
