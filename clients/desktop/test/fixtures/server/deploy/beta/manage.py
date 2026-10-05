#!/usr/bin/env python3
"""Synthetic CLI fixture. No Docker, real account, or financial data."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent
calls_file = root / "calls.json"
calls = json.loads(calls_file.read_text()) if calls_file.exists() else []
entry = {"args": sys.argv[1:]}
if sys.argv[1:] == ["owner", "--from-stdin"]:
    payload = json.load(sys.stdin)
    assert sorted(payload) == ["email", "firstName", "lastName", "password"]
    assert len(payload["password"]) >= 12
    entry["owner_fields_received"] = True
    # Verify that the real launcher suppresses credential-bearing owner output.
    print(payload["password"])
elif sys.argv[1:] not in [["init"], ["start", "--build"]]:
    raise SystemExit("Unexpected CLI arguments")
else:
    print("Synthetic local setup completed")
calls.append(entry)
calls_file.write_text(json.dumps(calls))
