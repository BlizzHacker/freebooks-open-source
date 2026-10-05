# Operating an alpha installation

These instructions apply to **0.1.0-alpha.1**, distributed in the [public source repository](https://github.com/BlizzHacker/freebooks-open-source). Keep operational data private and use local or trusted-user deployments. Public source availability does not grant production readiness.

## Before network exposure

Create the owner; verify signup is closed; configure HTTPS and access controls; verify internal service ports stay private. Configure provider redirects and webhooks for your own hostname only. Keep personal documents out of public asset/download directories.

## Backups

```sh
python3 deploy/beta/manage.py backup
```

Retain the database dump, Redis queue snapshot, document/object-store backup, import storage and private deployment configuration together. The tool stops application writes before collecting them. Provider credentials cannot be restored without the matching encryption key. Backups contain sensitive data and secrets: encrypt them before transferring them off the host. Set a retention schedule and maintain at least one independent copy.

Read the manifest/checksums, then perform a restoration exercise on a separate machine or Compose project. Do not call a backup recoverable merely because files were created.

## Restoration

Restore into a disposable installation first, using the same application release. The restore command replaces the target installation's database and document storage; use it only for a target you intend to replace.

```sh
python3 deploy/beta/manage.py init --project freebooks-restore --port 8741
python3 deploy/beta/manage.py restore --from /absolute/path/to/private/backup --replace-data
python3 deploy/beta/manage.py check
```

The explicit `--replace-data` flag acknowledges replacing that target's data. The tool verifies the expected backup payloads and checksums, limits replacements to this installation's volumes and rejects unsafe archive members before restoring. It retains the target project name and port while restoring the original encryption configuration. Keep the original backup untouched. Afterward verify owner sign-in, organizations, transaction counts and access to sample source documents before redirecting users. A successful command is not a substitute for testing the restored records.

## Updates

Track the application's release notes and upstream dependencies. Back up before upgrades and migrations. Keep the OS, Docker, browser/Electron and runtime images updated. Operators should define their own vulnerability severity and patch deadlines.

## Provider failure

Do not delete previously imported records when an external connection expires. Retain exports and source documents, record the last successful synchronization date, and reconcile the overlapping period when reconnecting. Review duplicate detection before combining CSV and provider feeds.

## Support diagnostics

Share versions, sanitized error messages and reproducible synthetic examples. Strip tokens, cookies, account identifiers, receipt details and database contents. Never upload a full production environment file to an issue.
