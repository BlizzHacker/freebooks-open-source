# Security

FreeBooks **0.1.0-alpha.1** publishes source and alpha artifacts in [freebooks-open-source](https://github.com/BlizzHacker/freebooks-open-source). It processes sensitive financial records. Use local or trusted-user deployments while evaluating this alpha. Known dependency findings remain disclosed in [SECURITY-STATUS.md](docs/beta/SECURITY-STATUS.md); production security clearance remains pending.

## Report a vulnerability

Use the public repository's [security page](https://github.com/BlizzHacker/freebooks-open-source/security) to find its private reporting options. Contact the maintainer through the private security-reporting channel of the repository distributing your build. If that repository has no private reporting channel, contact its operator privately. Do not publish exploitation details, tokens, statements or personal data in public issues.

There is no staffed response SLA or independent security certification promised for this alpha. Operators should assess patches promptly and maintain a documented patch schedule.

## Deployment baseline

- Create a single owner before making the service reachable beyond localhost.
- Keep signup closed and use HTTPS at your reverse proxy.
- Keep database, Redis, object-store and internal API ports off the public internet.
- Use unique generated secrets and restrictive file permissions.
- Keep encrypted backups containing both data and the matching encryption configuration.
- Test restoration in a disposable installation.
- Use provider authorization flows. Never collect wallet seed phrases or bank passwords in application forms.
- Apply least-privilege provider permissions and revoke connections that are no longer needed.
- Review documents before sharing invoice links or diagnostic reports.
- Maintain application, Docker image and operating-system updates.

The local desktop client isolates remote application content from native client privileges. Its security still depends on the server, local operating system and the Electron runtime. Keep all of them updated.

Read [OPERATIONS.md](docs/beta/OPERATIONS.md) for backup and exposure guidance.
