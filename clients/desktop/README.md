# FreeBooks Desktop alpha

A real Electron client for one or more FreeBooks servers. It can launch a local self-hosted server, or connect to an existing HTTPS server.

## Install and use

1. Extract the Windows ZIP or Linux tar.gz. Windows: run FreeBooks.exe. Linux: run `freebooks-desktop` inside the extracted directory.
2. Connect your server address, or choose **Set up / start local server**.
3. Local mode requires Python 3.11+ and Docker Desktop / Docker Engine with the Compose plugin. Docker must be running. First setup downloads dependencies and builds the bundled server, so allow several gigabytes and several minutes.
4. For a new local server, create the first owner in the launcher, then open **My local FreeBooks** and complete the organization wizard.
5. Existing servers with SSO need their identity-provider origin added under **External single sign-on**. Providers that reject embedded browsers can be accessed using the **Browser** button instead. Browser and desktop sign-in sessions are separate.

“Local” means the complete FreeBooks services run in Docker on your computer. It is not a native SQLite app. After the first installation, your local books do not depend on the hosted FreeBooks service; external integrations still require internet access. Closing the client leaves the server running.

## Where data lives

Server profile names and origins are stored in Electron's private user-data directory. The bundled source is copied into its `local-server` subdirectory; its generated configuration stays there. Docker named volumes contain your local databases and documents. Removing a connection clears its browser session but does not delete server data.

For a backup, stop making changes and run `python3 deploy/beta/manage.py backup` from the local-server directory (Windows can use `py -3`). See the bundled self-host instructions for restore and upgrades. Never delete Docker volumes as a troubleshooting step.

## Security and limitations

Remote accounting windows have no Node integration or native preload API. They use sandboxing, context isolation, separate sessions, and normal TLS verification. Camera and other device permissions are denied in this alpha; upload receipt files from disk, or use your server in a mobile browser. Browser wallet extensions are not installed in the desktop client; use the Browser button for wallets that require an extension. Privileged local setup actions are limited to the packaged launcher. Profiles store no passwords or API keys. HTTP is allowed only for localhost, 127.0.0.1, or ::1.

This alpha is unsigned and has no automatic updates. A Windows ZIP and Linux archive are build artifacts, not proof of execution on every supported computer. macOS builds need a macOS runner and signing is not yet configured. Do not disable your operating system's security protections to run untrusted downloads; build the source yourself if needed.

## Build

Use Node 22.12+ on a build machine:

```sh
npm ci
npm test
FREEBOOKS_BUNDLE_DIR=/path/to/sanitized-source npm run dist -- --linux tar.gz --win zip
```

The supplied directory must contain `deploy/beta/manage.py`. Packaging excludes Git history, environment secrets, dependencies, generated builds, and nested clients. Set `FREEBOOKS_DESKTOP_OUTPUT` to choose the output directory. Source is AGPL-3.0; preserve FreeBooks and upstream attribution when redistributing.
