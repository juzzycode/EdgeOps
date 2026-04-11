# Deployment

## Production Start

The repository now includes a repo-root `start.sh` that:

- builds the frontend into `dist/` by default
- starts the backend API with `node server/index.js`
- starts a production frontend server with `node server/frontend.js`
- serves the SPA from `dist/` and proxies the API prefix back to the backend

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

- `EDGEOPS_API_HOST`
  Backend API bind address. Default: `127.0.0.1`
- `EDGEOPS_API_PORT`
  Backend API port. Default: `8787`
- `EDGEOPS_API_PREFIX`
  URL prefix for backend API routes. Default: `/api`
- `EDGEOPS_DB_CLIENT`
  Storage backend. Use `sqlite` or `mysql`. Default: `sqlite`
- `EDGEOPS_DB_PATH`
  SQLite path for gateway cache data when `EDGEOPS_DB_CLIENT=sqlite`. Default: `./data/edgeops-cache.sqlite`
- `EDGEOPS_MYSQL_URI`
  Optional MySQL connection string. If set, it takes precedence over the individual MySQL host/user/database values
- `EDGEOPS_MYSQL_HOST`, `EDGEOPS_MYSQL_PORT`, `EDGEOPS_MYSQL_USER`, `EDGEOPS_MYSQL_PASSWORD`, `EDGEOPS_MYSQL_DATABASE`
  MySQL connection settings when `EDGEOPS_DB_CLIENT=mysql`
- `EDGEOPS_MYSQL_SSL`
  Set to `true` to enable TLS for the MySQL connection
- `EDGEOPS_FRONTEND_PORT`
  Production frontend port. Default: `8080`
- `EDGEOPS_FRONTEND_HOST`
  Bind address for the frontend server. Default: `0.0.0.0`
- `EDGEOPS_API_ORIGIN`
  Optional override for where the frontend proxies `EDGEOPS_API_PREFIX`. Default: `http://$EDGEOPS_API_HOST:$EDGEOPS_API_PORT`
- `EDGEOPS_SKIP_BUILD`
  Set to `1` when you already built `dist/` and do not want `start.sh` to run `npm run build`

`EDGEOPS_PORT` is still accepted as a legacy fallback for `EDGEOPS_API_PORT`, but new installs should use `EDGEOPS_API_PORT`.

## MySQL

SQLite remains the default and is still the simplest single-host option. To use MySQL instead, create an empty database and user, then set:

```env
EDGEOPS_DB_CLIENT=mysql
EDGEOPS_MYSQL_HOST=127.0.0.1
EDGEOPS_MYSQL_PORT=3306
EDGEOPS_MYSQL_USER=edgeops
EDGEOPS_MYSQL_PASSWORD=change-me
EDGEOPS_MYSQL_DATABASE=edgeops
```

Or use a URI:

```env
EDGEOPS_DB_CLIENT=mysql
EDGEOPS_MYSQL_URI=mysql://edgeops:change-me@127.0.0.1:3306/edgeops
```

On first start, EdgeOps creates its tables in that database. Existing SQLite data is not automatically migrated; export/import it before switching a production instance.

Config snapshots and gateway config cache entries are stored in the database as `LONGTEXT` when MySQL is used. They are not served from `dist/` or the repo-local `data/` directory.

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

The example maps `/api` directly to the internal backend on `127.0.0.1:8787`, then sends all other traffic to the production frontend on `127.0.0.1:8080`.

If you keep the default environment, the important nginx shape is:

```nginx
location /api {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    proxy_pass http://127.0.0.1:8080;
}
```

The example also denies direct requests for common local data paths. Keep nginx pointed at the frontend and API ports, not at the repository directory.

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
