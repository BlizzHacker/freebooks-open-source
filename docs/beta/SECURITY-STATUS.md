# Security status — 0.1.0-alpha.1

The [public source repository](https://github.com/BlizzHacker/freebooks-open-source) distributes **0.1.0-alpha.1** for evaluation. Run it locally or with trusted users. Production security clearance for public, multiuser hosting remains pending. Publishing the source and alpha artifacts does not dismiss the findings below.

## Checks completed on 2026-10-04

- Desktop URL/profile isolation tests and a sandboxed Linux runtime exercise passed.
- API/web TypeScript checks passed. Upload, mail transport, spreadsheet round-trip, file detection and validation-response privacy checks passed.
- Source-export boundaries, known-secret/identity scanning and archive/member checksum verification passed.
- Closed signup and independent owner setup are part of the installer. New classification policies require explicit configuration.

The full deployment, source-document and backup/restore results are recorded separately in the alpha release validation report. A successful build does not establish every provider connection or platform runtime.

## Dependency findings

The npm production-declared dependency tree contains 14 remaining findings: 3 high, 9 moderate and 2 low. The high findings were traced to inherited build tooling, rather than the running API. Some upstream packages declare build tooling as runtime dependencies, so this is broader than the deployed API surface.

The complete development/build lock scan contains 108 findings: 4 critical, 51 high, 44 moderate and 9 low. This broader scan includes test and build tools. Remaining examples include legacy Handlebars, tar, Vitest, PostCSS, braces, Nest/serialization, UUID and XML tooling. These findings need further updates, compatibility work or replacement; they have not been dismissed.

Compatible dependencies were updated and unused build tools were removed from runtime packages. The production-declared report improved from 193 to 14 findings through both patching and dependency pruning. This is not a claim that 179 independent runtime vulnerabilities were fixed.

Desktop dependencies returned no current audit advisories. That does not clear the server or build toolchain.

## Operator scope

Keep the default loopback binding, private signup and trusted operator model. Use HTTPS and appropriate access controls when serving another device. Review the dependency register before exposing an installation publicly. Keep data/configuration backups private and retain the encryption key. Preserve upstream legal notices and distribute matching source with modifications.

Known limitations are tracked openly. No Plaid security attestation or production clearance is implied by these checks.
