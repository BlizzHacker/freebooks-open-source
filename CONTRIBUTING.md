# Contributing to FreeBooks

Contribute in the [public source repository](https://github.com/BlizzHacker/freebooks-open-source). This release is **0.1.0-alpha.1**; known limitations and dependency findings are disclosed in [SECURITY-STATUS.md](docs/beta/SECURITY-STATUS.md). Public source publication does not mark the application production-ready.

## Work on sample data

Use an isolated local installation and synthetic transactions. Never commit bank statements, tax returns, receipts, identity documents, provider keys, access tokens, database files or backups. Do not use a production database to develop migrations.

## Monorepo

The API is in `packages/server` (NestJS, Knex, MariaDB); the browser application is in `packages/webapp` (React and Vite). Shared packages live in `shared`. The desktop client is separate in `clients/desktop`. The alpha deployment is in `deploy/beta`. The `deploy/beta`, `docs/beta` and workflow paths retain their existing names for compatibility.

Use the runtime versions pinned by the alpha Dockerfiles for packaged builds and pnpm 9.1.2. The source repository still has legacy Node engine declarations; the packaged build path is authoritative for this alpha.

```sh
pnpm install --frozen-lockfile
pnpm run build:server
pnpm run build:webapp
```

Build the server before running migration CLI commands. System and tenant schemas have separate migrations. API responses use snake_case; application DTOs use camelCase. Preserve tenant isolation, permission checks and provider credential encryption.

## Changes

- Explain the user-facing behavior, assumptions and limitations.
- Add focused checks for new behavior and use disposable data for end-to-end checks.
- Include migrations and rollback notes for schema changes.
- Keep receipt matching and classification evidence inspectable.
- Keep provider-specific failures visible; do not present an unconfigured integration as connected.
- Use conventional commit messages such as `feat(review): add configurable rules`.

Report security issues privately following [SECURITY.md](SECURITY.md). Pull requests and public issues must not contain private financial examples.

## Release work

Run the source snapshot tool, inspect its audit report, and follow [the release checklist](docs/beta/RELEASE.md). A green build alone does not clear licensing, financial correctness or external provider approval.
