# FreeBooks

FreeBooks is a self-hosted accounting and financial review workspace, built on the Bigcapital open-source accounting engine. Keep invoices, expenses, imported transactions and supporting documents together on infrastructure you control.

**Public alpha · 0.1.0-alpha.1.** Source and alpha packages are available for evaluation. Run installations locally or with trusted users; production readiness is not yet cleared. This is a working accounting application with new review and connection features, not a completed replacement for every Intuit service. Read the [capability matrix](docs/beta/CAPABILITIES.md) before moving your primary records.

Public source: [BlizzHacker/freebooks-open-source](https://github.com/BlizzHacker/freebooks-open-source). Download packages and corresponding source from its [releases](https://github.com/BlizzHacker/freebooks-open-source/releases). The public repository is created from audited source exports; private development history, documents and deployment configuration remain private.

## Choose how to run it

| Option | What runs | Start here |
| --- | --- | --- |
| Self-hosted server | Docker services on your Linux server; browser clients connect over HTTPS | [Self-host installation](docs/beta/SELF-HOST.md) |
| Desktop with a local server | Desktop client plus Docker services on your computer | [Desktop guide](docs/beta/DESKTOP.md) |
| Desktop with remote servers | Desktop client connects to one or more independently hosted servers | [Desktop guide](docs/beta/DESKTOP.md) |

Local installations do not depend on the hosted FreeBooks.dev workspace. The local desktop option requires Docker; it is not a single embedded database executable. Initial installation and optional external integrations need internet access.

## What you can do

- Use double-entry bookkeeping, invoices, purchases, contacts and financial reports.
- Import transaction files and retain statements, receipts and other supporting documents.
- Review suggested transaction categories with configurable household, business and employment rules.
- Keep ambiguous transfers, missing receipt evidence and large transactions in review queues.
- Configure supported bank-feed and payment integrations using your own provider accounts.

Financial review labels are advisory. They do not automatically establish tax deductibility or post every suggested transaction to the ledger. Separate legal entities should have separate organizations/books.

## Install the alpha

Download an audited source archive, extract it and follow [SELF-HOST.md](docs/beta/SELF-HOST.md). From the extracted directory:

```sh
python3 deploy/beta/manage.py init
python3 deploy/beta/manage.py start --build
python3 deploy/beta/manage.py owner
```

The default installation binds to localhost. Public signup is closed. Publish through your own HTTPS reverse proxy only after owner creation and the [operator checklist](docs/beta/OPERATIONS.md).

## Development and releases

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [release checklist](docs/beta/RELEASE.md). Provider credentials, production documents and private deployment configuration must never enter a source release.

FreeBooks retains upstream package names where required by the monorepo and migrations. Branding changes do not remove upstream authorship or license obligations.

## License and attribution

The repository includes the GNU Affero General Public License, version 3: [LICENSE](LICENSE). FreeBooks is derived from [Bigcapital](https://github.com/bigcapitalhq/bigcapital). See [NOTICE](NOTICE) for attribution and licensing review notes. Dependencies have their own licenses.

See the [alpha security register](docs/beta/SECURITY-STATUS.md) before public hosting.
