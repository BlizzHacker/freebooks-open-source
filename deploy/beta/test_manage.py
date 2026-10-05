import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("manage", Path(__file__).with_name("manage.py"))
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)

class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.here = Path(self.temp.name)
        self.here.joinpath(".env.example").write_text(Path(__file__).with_name(".env.example").read_text())
        self.here.joinpath("init-db.sh").write_text("#!/bin/sh\\n")
        self.patch_here = patch.object(manage, "HERE", self.here)
        self.patch_env = patch.object(manage, "ENV", self.here / ".env")
        self.patch_here.start()
        self.patch_env.start()
    def tearDown(self):
        self.patch_env.stop()
        self.patch_here.stop()
        self.temp.cleanup()
    def test_secrets_unique_and_closed(self):
        manage.init()
        values = manage.read_env()
        self.assertEqual(values["SIGNUP_DISABLED"], "true")
        self.assertEqual(values["BIND_ADDRESS"], "127.0.0.1")
        secrets = [values[k] for k in ("APP_JWT_SECRET", "DB_PASSWORD", "PAYMENT_PROVIDER_ENCRYPTION_KEY")]
        self.assertEqual(len(set(secrets)), 3)
        self.assertTrue(all(len(s) == 64 for s in secrets))
        self.assertEqual((manage.ENV.stat().st_mode & 0o777), 0o600)
    def test_init_preserves_config(self):
        manage.init()
        before = manage.ENV.read_bytes()
        manage.init(8742, "another-beta")
        self.assertEqual(before, manage.ENV.read_bytes())
    def test_invalid_project_rejected(self):
        with self.assertRaises(RuntimeError):
            manage.init(project="../outside")
    def test_newline_rejected(self):
        with self.assertRaises(RuntimeError):
            manage.write_env({"PASSWORD": "unsafe\nOTHER=true"})
    def test_owner_closes_on_failure(self):
        manage.init()
        with patch.object(manage, "compose"), patch.object(manage, "api", side_effect=RuntimeError("failed")), patch("sys.stdin", __import__("io").StringIO('{"email":"test@example.com","password":"long-password-example","firstName":"Beta","lastName":"Owner"}')):
            with self.assertRaises(RuntimeError):
                manage.owner(True)
        self.assertEqual(manage.read_env()["SIGNUP_DISABLED"], "true")
        self.assertFalse(self.here.joinpath(".owner-created").exists())
if __name__ == "__main__":
    unittest.main()
