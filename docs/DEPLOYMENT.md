# Deployment

## Production Start

The repository now includes a repo-root `start.sh` that:

- builds the frontend into `dist/` by default
- starts the backend API with `node server/index.js`
- starts a production frontend server with `node server/frontend.js`
- serves the SPA from `dist/` and proxies `/api` back to the backend

Run it from the project root:

```bash
chmod +x ./start.sh
./start.sh
```

The script keeps both processes in the same shell and stops both if either process exits or you press `Ctrl+C`.
While it runs, it writes PID and runtime metadata into `.run/edgeops/` so `./stop.sh` can stop the correct processes later.

To stop a running instance from another shell:

```bash
chmod +x ./stop.sh
./stop.sh
```

## Environment Variables

These values can live in `.env` before you run `./start.sh`:

- `EDGEOPS_PORT`
  Backend API port. Default: `8787`
- `EDGEOPS_FRONTEND_PORT`
  Production frontend port. Default: `8080`
- `EDGEOPS_FRONTEND_HOST`
  Bind address for the frontend server. Default: `0.0.0.0`
- `EDGEOPS_API_ORIGIN`
  Optional override for where the frontend proxies `/api`. Default: `http://127.0.0.1:$EDGEOPS_PORT`
- `EDGEOPS_SKIP_BUILD`
  Set to `1` when you already built `dist/` and do not want `start.sh` to run `npm run build`

## nginx

An example nginx site file is included at `docs/deploy/nginx.edgeops.conf`.

Typical install flow on Debian or Ubuntu:

1. Copy the example into `/etc/nginx/sites-available/edgeops.conf`
2. Update `server_name`
3. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/edgeops.conf /etc/nginx/sites-enabled/edgeops.conf
sudo nginx -t
sudo systemctl reload nginx
```

The example reverse proxies all traffic to the production frontend server on `127.0.0.1:8080`, and that frontend server forwards `/api` to the backend.

## Apache

An example Apache vhost is included at `docs/deploy/apache.edgeops.conf`.

Enable the required modules first:

```bash
sudo a2enmod proxy proxy_http headers
sudo apachectl configtest
sudo systemctl reload apache2
```

Then:

1. Copy the example into `/etc/apache2/sites-available/edgeops.conf`
2. Update `ServerName`
3. Enable the site:

```bash
sudo a2ensite edgeops.conf
sudo apachectl configtest
sudo systemctl reload apache2
```

The Apache example also reverse proxies all requests to the production frontend server on `127.0.0.1:8080`.

## Notes

- If you terminate TLS in nginx or Apache, keep `start.sh` bound to local-only ports and expose only `80` or `443` publicly.
- If you want systemd units later, `start.sh` is a good starting point, but it is intentionally simple and foreground-oriented.
