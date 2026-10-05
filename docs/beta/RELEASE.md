# Alpha releases and production readiness

Version **0.1.0-alpha.1** is published through the [clean public repository](https://github.com/BlizzHacker/freebooks-open-source). Public source and alpha package availability are separate from production security clearance. Known findings and unverified capabilities remain disclosed. The `deploy/beta`, `docs/beta` and workflow file paths retain their names for compatibility.

## Prepare a source snapshot

From the repository root:

```sh
python3 freebooks/release/make-source-archive.py --output /path/on/private-volume/freebooks-beta
python3 freebooks/release/test-source-archive.py
python3 freebooks/release/verify-source-archive.py /path/on/private-volume/freebooks-beta
```

The tool exports current working files without Git history. It excludes private deployment operations, environment files, databases, original financial documents, caches, build output and upstream publishing workflows. It includes the new alpha deployment/client source. It replaces the hosted owner's privacy page with an operator-neutral template in the exported snapshot only.

For a private working tree, pass `--secret-env /path/to/private/.env` to compare credential values against exported content without printing them. The configuration file is read for this comparison, never added to the archive. Use `--private-identity` for owner identifiers you want flagged.

Inspect `source-audit.json` and `source-manifest.json`. Suspicious credential patterns fail the archive; owner-identity findings and third-party license questions require review. A pattern scan cannot prove the absence of all secrets.

## Release and promotion checks

- Preserve AGPL notices and record upstream package metadata inconsistencies documented in NOTICE.
- Build API, web and desktop from the exported snapshot.
- Run a fresh isolated installation, owner bootstrap, signup-closed check, organization build and representative import/document workflows.
- Verify default secrets differ between independent installs; confirm backups retain the encryption configuration.
- Run relevant checks; record commands, version/platform and actual outcomes.
- Audit source and dependencies for vulnerabilities and third-party license obligations.
- Install each desktop artifact on its target OS and exercise local and remote modes. Disclose unsigned alpha packages; signing/notarization remains part of production distribution work.
- Review capability claims against implemented and tested behavior.
- Publish checksums and matching corresponding source for every binary release.
- Use a repository containing sanitized history. Changing visibility of a private development fork also exposes its historical commits.

The alpha GitHub workflow builds only the FreeBooks artifacts; it does not publish upstream namespaces. Distribution and publication remain deliberate operator actions.

## Release status

The public alpha uses audited corresponding source in a new repository with clean history. The existing private development fork and its history stay private. Personal records and private production configuration remain outside the public snapshot. Publication of source or an alpha package does not grant production security clearance.

## Security register

See [SECURITY-STATUS.md](SECURITY-STATUS.md) for actual remaining dependency findings and the local/private alpha scope. Public production security clearance has not been granted.
