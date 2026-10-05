# Desktop alpha — 0.1.0-alpha.1

Public source and release packages: [freebooks-open-source](https://github.com/BlizzHacker/freebooks-open-source). Alpha artifacts support evaluation; production readiness remains pending.

The desktop client can save several server profiles and open the selected FreeBooks workspace.

## Two modes

**Connect to an existing server:** enter its HTTPS address, then sign in with credentials issued by that server's operator. Profiles store a label and server address; they do not store bank passwords or wallet recovery phrases.

**Run a local server:** install Docker and Python first. The desktop client uses the included server source and management tool to start a private localhost stack. Create its owner and complete organization setup. Records remain in local Docker volumes.

This is a desktop client with a Docker-based local server. It is not an embedded SQLite application, and it does not eliminate Docker's memory/disk requirements. Initial builds require internet access. Payment providers and live feeds require connectivity whenever used.

## Security and sign-in

Remote pages do not receive native Node.js privileges. HTTP is allowed only for loopback addresses; remote servers require HTTPS. The client does not bypass certificate failures.

Some identity providers reject embedded browser sign-in. If your server's SSO cannot complete inside the desktop client, use its normal browser/PWA client. Do not disable authentication protections to work around an identity provider restriction.

## Build from source

Use the Node/npm versions specified in `clients/desktop/package.json`. Install with `npm ci`. Build platform artifacts using that package's scripts. Native packaging and signing are platform-specific; see the desktop README and [release checklist](RELEASE.md).

Unsigned alpha packages may trigger operating-system prompts. Release records must distinguish a built artifact from an artifact that has been installed and exercised on its target operating system.
