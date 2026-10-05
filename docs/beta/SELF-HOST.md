# Self-hosted alpha installation — 0.1.0-alpha.1

Get audited source from [freebooks-open-source](https://github.com/BlizzHacker/freebooks-open-source). The public alpha retains the `deploy/beta` path for compatibility. Known findings are disclosed in [SECURITY-STATUS.md](SECURITY-STATUS.md); use local or trusted-user hosting while production readiness remains pending.

## Requirements

- Docker Engine with Docker Compose v2, and Python 3.11 or newer.
- A machine with enough memory and disk space to build the monorepo and retain database files, documents and backups. Start with 4 CPU cores, 8 GB RAM and 20 GB free disk; actual needs vary.
- Internet access for the initial image/dependency download.
- Your own provider developer accounts if you enable external connections.

The packaged deployment uses MariaDB, Redis, Garage object storage and Gotenberg. These are persistent services, not cloud accounts supplied by FreeBooks.

## Install

Extract the audited source archive into a directory owned by the operator. Keep it on a private filesystem.

```sh
python3 deploy/beta/manage.py init
python3 deploy/beta/manage.py start --build
python3 deploy/beta/manage.py check
python3 deploy/beta/manage.py owner
python3 deploy/beta/manage.py status
```

`init` writes a private `deploy/beta/.env` with unique secrets. Do not replace this file on an existing installation: it contains the encryption key needed to decrypt saved provider credentials. The owner command asks for a password without echoing it. Public signup remains disabled throughout bootstrap. Only the exact owner email is temporarily allowlisted, and that exception is cleared afterward.

Open the localhost URL printed by the management tool. Complete the organization setup before importing transactions. New review policies start disabled: choose your own branches and rules before enabling automatic suggestions.

## Host on a server

Keep the default localhost binding and place an HTTPS reverse proxy on the same host. Proxy the web service, including `/api` and WebSocket traffic. The internal API, database, Redis and S3 endpoints should remain private.

Set the public application URL in the generated deployment configuration before enabling provider redirects or payment links. Follow the reverse proxy and your identity provider's official documentation for TLS and SSO. External authentication is optional for local alpha installs; the private hosted site's Authentik configuration is not included.

## Upgrade

Back up first. Retain the private environment file and persistent volumes. Replace the source with an audited newer release, read its migration notes, and rebuild with `start --build`. Schema migrations run through the management tool. Do not use `docker compose down -v` on data you want to keep.

## Stop

```sh
python3 deploy/beta/manage.py stop
```

Stopping the stack does not intentionally erase persistent data. See [OPERATIONS.md](OPERATIONS.md) before removing volumes.
