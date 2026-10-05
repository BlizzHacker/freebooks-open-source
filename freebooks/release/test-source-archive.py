#!/usr/bin/env python3
"""Focused export-boundary checks; uses synthetic inputs only."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).with_name("make-source-archive.py"))
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)

class ExportBoundaries(unittest.TestCase):
    def test_private_paths_excluded(self):
        paths = [
            ".env", "deploy/beta/.env", "packages/server/.env.production",
            "packages/server/system-db.sqlite", "packages/webapp/node_modules/file.js",
            "packages/webapp/dist/assets/index.js", "packages/server/uploads/receipt.png",
            "docker-compose.freebooks.yml", "freebooks/sso-bridge.js", "freebooks/backup.sh",
            "freebooks/SECURITY-BASELINE.md", ".github/workflows/build-deploy-container.yml",
            "packages/server/static/receipt.pdf", "clients/desktop/out/app.exe",
            "clients/desktop/bundle/server/package.json", "../escape", "/absolute",
            "e2e/.auth/user.json", "deploy/beta/.owner-created",
            "packages/webapp/public/downloads/release-manifest.json",
        ]
        for name in paths:
            with self.subTest(name=name):
                self.assertFalse(snapshot.allowed_path(name))

    def test_source_paths_included(self):
        for name in [
            "README.md", "LICENSE", ".env.example", "deploy/beta/.env.example",
            "deploy/beta/manage.py", "clients/desktop/src/main.js",
            "docs/beta/SELF-HOST.md", "freebooks/release/make-source-archive.py",
            "packages/server/src/main.ts", "shared/sdk-ts/package.json",
            "packages/webapp/src/store/receipts/receipts.reducer.ts",
            ".github/workflows/freebooks-beta.yml",
        ]:
            with self.subTest(name=name):
                self.assertTrue(snapshot.allowed_path(name))

    def test_untracked_non_beta_files_rejected(self):
        self.assertFalse(snapshot.allowed_path("packages/server/src/private-example.ts", tracked=False))
        self.assertTrue(snapshot.allowed_path("deploy/beta/manage.py", tracked=False))

    def test_scanner_redacts_values(self):
        synthetic = ("sk_live_" + "A" * 25).encode()
        results = snapshot.audit_file("example.ts", synthetic)
        self.assertEqual(results[0]["kind"], "stripe-secret")
        self.assertEqual(results[0]["severity"], "block")
        self.assertNotIn("sk_live_", str(results))

    def test_known_secret_comparison(self):
        results = snapshot.audit_file("example.ts", b"arbitrary-sensitive-value", known_secrets=("arbitrary-sensitive-value",))
        self.assertEqual(results[0]["kind"], "known-private-secret")
        self.assertEqual(results[0]["severity"], "block")
        self.assertNotIn("arbitrary-sensitive-value", str(results))

if __name__ == "__main__":
    unittest.main()
