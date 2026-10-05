#!/usr/bin/env python3
"""Create an auditable source snapshot without private deployment state or Git history."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

ROOT_FILES = {
    "README.md", "CONTRIBUTING.md", "SECURITY.md", "NOTICE", "LICENSE", "DISCLAIMER",
    "CHANGELOG.md", ".dockerignore", ".gitattributes", ".gitignore", ".nvmrc",
    ".env.example", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "lerna.json", "commitlint.config.js", "playwright.config.ts",
}
SOURCE_PREFIXES = ("packages/", "shared/", "e2e/", ".husky/")
BETA_PREFIXES = ("deploy/beta/", "clients/desktop/", "docs/beta/", "freebooks/release/")
EXCLUDED_PARTS = {
    ".git", "node_modules", "dist", "build", "coverage", ".cache", "__pycache__",
    ".auth", ".owner-created", "uploads", "backups", "archives", "receipts", "statements",
    "release", "releases", "out", "bundle", ".next",
}
PRIVATE_SUFFIXES = {
    ".db", ".sqlite", ".sqlite3", ".sql", ".dump", ".pem", ".key", ".p12",
    ".pfx", ".log", ".jsonl", ".pdf", ".qfx", ".ofx", ".zip", ".gz", ".tar",
    ".exe", ".dmg", ".AppImage", ".pyc",
}
SECRET_PATTERNS = (
    ("stripe-secret", re.compile(r"\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b")),
    ("stripe-webhook", re.compile(r"\bwhsec_[A-Za-z0-9]{20,}\b")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b")),
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("jwt-token", re.compile(r"\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b")),
)
PRIVACY_TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy information | FreeBooks</title></head><body><main>
<h1>Privacy information</h1>
<p>This is a self-hosted FreeBooks installation. Its operator controls the records, connections, access permissions, retention and backups.</p>
<p>It may hold accounting records, receipts, source statements, transaction imports and account connection information supplied by its users. External providers process information when a user enables their integrations.</p>
<p>Before accepting other users, the operator must replace this template with an accurate privacy policy including operator contact details, the data processed, purposes, sharing, retention, deletion and security practices.</p>
<p>Do not enter bank passwords or wallet recovery phrases into generic application forms. Authorize supported providers through their intended flows.</p>
<p>A source distribution does not include the hosted maintainer's personal records or private service configuration.</p>
</main></body></html>
"""

def allowed_path(name: str, tracked: bool = True) -> bool:
    if name.startswith("packages/webapp/public/downloads/"):
        return False
    p = PurePosixPath(name)
    if p.is_absolute() or ".." in p.parts:
        return False
    # release tooling is intentional; release build output is never source.
    parts = p.parts
    forbidden = EXCLUDED_PARTS - ({"release"} if name.startswith("freebooks/release/") else set())
    # Real application modules can be named receipts/statements/uploads.
    # Retain their source code while excluding runtime data directories.
    if name.startswith(SOURCE_PREFIXES) and "src" in parts and p.suffix in {".ts", ".tsx", ".js", ".jsx", ".scss", ".css", ".json"}:
        forbidden = forbidden - {"receipts", "statements", "uploads", "archives"}
    if any(part in forbidden for part in parts):
        return False
    if p.suffix in PRIVATE_SUFFIXES:
        return False
    if any(part == ".env" or (part.startswith(".env.") and not part.endswith(".example"))
           for part in parts):
        return False
    if p.suffix in {".csv", ".xlsx", ".xls"} and not name.startswith("packages/server/static/demo-sheets/"):
        return False
    if name in ROOT_FILES or name == ".github/workflows/freebooks-beta.yml":
        return True
    if name.startswith(BETA_PREFIXES):
        return True
    return tracked and name.startswith(SOURCE_PREFIXES)

def candidates(root: Path):
    tracked = {
        x for x in subprocess.check_output(["git", "ls-files", "-z"], cwd=root)
        .decode("utf-8").split("\0") if x
    }
    all_names = set(tracked)
    for prefix in BETA_PREFIXES:
        base = root / prefix
        if base.exists():
            for parent, dirs, files in os.walk(base):
                dirs[:] = [d for d in dirs if d not in (EXCLUDED_PARTS - {"release"})]
                for f in files:
                    all_names.add((Path(parent) / f).relative_to(root).as_posix())
    for name in ROOT_FILES | {".github/workflows/freebooks-beta.yml"}:
        if (root / name).is_file():
            all_names.add(name)
    # Include new source code, but only from the established source prefixes.
    unknown = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard", "-z"],
                                      cwd=root).decode("utf-8").split("\0")
    for name in unknown:
        if name and name.startswith(SOURCE_PREFIXES):
            all_names.add(name)
            tracked.add(name)
    return sorted(all_names), tracked

def audit_file(name: str, data: bytes, private_identities=(), known_secrets=()):
    if b"\0" in data or len(data) > 8 * 1024 * 1024:
        return []
    text = data.decode("utf-8", errors="replace")
    findings = []
    identity_patterns = tuple(("private-identity", re.compile(re.escape(value), re.I)) for value in private_identities if value)
    secret_patterns = SECRET_PATTERNS + tuple(("known-private-secret", re.compile(re.escape(value))) for value in known_secrets if value)
    for kind, pattern in secret_patterns + identity_patterns:
        for match in pattern.finditer(text):
            findings.append({"file": name, "line": text.count("\n", 0, match.start()) + 1,
                             "kind": kind, "severity": "block" if (kind, pattern) in secret_patterns else "review"})
    return findings

def sha256_file(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--private-identity", action="append", default=[], help="Private identity/address to flag; values are never included in reports.")
    parser.add_argument("--secret-env", type=Path, action="append", default=[], help="Private env to compare credential values against exported files; values are never reported.")
    args = parser.parse_args()
    known_secrets = set()
    for config in args.secret_env:
        for line in config.read_text().splitlines():
            if line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip(chr(34)).strip(chr(39))
            if re.search(r"SECRET|PASSWORD|TOKEN|KEY", key, re.I) and len(value) >= 12 and not value.startswith("${"):
                known_secrets.add(value)
    root = args.root.resolve()
    output = args.output.resolve()
    if output == root or root in output.parents:
        parser.error("Output must be outside the source repository.")
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    output.chmod(0o700)
    source = output / "source"
    if source.exists():
        marker = source / ".freebooks-source-snapshot"
        if not marker.is_file():
            parser.error("Existing source directory is not a managed snapshot; refusing to replace it.")
        # Only the exact previously marked export path is removed.
        shutil.rmtree(source)
    source.mkdir(mode=0o700)
    (source / ".freebooks-source-snapshot").write_text("Sanitized source export; contains no Git history.\n")
    names, tracked = candidates(root)
    files = []
    findings = []
    excluded = []
    transformations = []
    for name in names:
        if not allowed_path(name, name in tracked):
            excluded.append(name)
            continue
        original = root / name
        if original.is_symlink():
            findings.append({"file": name, "kind": "symlink-excluded", "severity": "review"})
            continue
        if not original.is_file():
            continue
        data = original.read_bytes()
        if name == "packages/webapp/public/privacy.html":
            data = PRIVACY_TEMPLATE.encode()
            transformations.append({"file": name, "action": "replace-hosted-policy-with-operator-template"})
        target = source / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.chmod(0o755 if original.stat().st_mode & 0o111 else 0o644)
        files.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        findings.extend(audit_file(name, data, args.private_identity, known_secrets))
    blockers = [f for f in findings if f["severity"] == "block"]
    audit = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root).decode().strip(),
        "working_tree_included": True,
        "git_history_included": False,
        "files": len(files), "bytes": sum(f["bytes"] for f in files),
        "excluded_file_count": len(excluded),
        "excluded_paths_published": False,
        "transformations": transformations,
        "findings": findings,
        "pattern_scan_complete": not blockers,
        "private_env_credential_comparison": bool(args.secret_env),
        "public_production_ready": False,
        "remaining_reviews": [
            "Preserve AGPL notices; review dependency/asset licenses and metadata inconsistencies.",
            "Review dependency and asset licenses.",
            "Complete recorded fresh-install and target-platform checks.",
            "Review history separately before making any repository public.",
        ],
    }
    (output / "source-manifest.json").write_text(json.dumps(files, indent=2) + "\n")
    (output / "source-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    if blockers:
        print(json.dumps({"status": "blocked", "findings": blockers}, indent=2))
        return 2
    archive = output / "freebooks-alpha-source.tar.gz"
    with tarfile.open(archive, "w:gz") as tar:
        tar.add(source, arcname="freebooks-alpha", recursive=True)
    sums = [f"{sha256_file(output / n)}  {n}" for n in
            ["freebooks-alpha-source.tar.gz", "source-manifest.json", "source-audit.json"]]
    (output / "SHA256SUMS").write_text("\n".join(sums) + "\n")
    print(json.dumps({"status": "snapshot-created", "files": len(files),
                      "archive": str(archive), "bytes": archive.stat().st_size,
                      "review_findings": len(findings), "public_production_ready": False}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
