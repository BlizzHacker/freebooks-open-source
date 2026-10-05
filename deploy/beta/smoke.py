#!/usr/bin/env python3
"""Destructive only to a fresh disposable beta installation; never run against production."""
import base64
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location("manage", Path(__file__).with_name("manage.py"))
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)
values = manage.read_env()
if not values["COMPOSE_PROJECT_NAME"].startswith(("freebooks-ci", "freebooks-beta-smoke")):
    sys.exit("Smoke tests require a disposable freebooks-ci or freebooks-beta-smoke project.")
if values.get("BIND_ADDRESS") != "127.0.0.1":
    sys.exit("Smoke tests require loopback binding.")
BASE = "http://127.0.0.1:" + values["HTTP_PORT"]
owner = {"email": "beta-owner@example.invalid", "password": secrets.token_urlsafe(32),
         "firstName": "Beta", "lastName": "Owner"}
headers = {}
results = []

def call(path, data=None, method=None, extra=None, expected=200):
    merged = dict(headers)
    merged.update(extra or {})
    if isinstance(data, dict):
        data = json.dumps(data).encode()
        merged["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data, merged, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as r:
            status, body = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    if status != expected:
        # Only synthetic test data, no authentication details.
        raise AssertionError(path + f": expected {expected}, received {status}. " +
                             body.decode(errors="replace")[:500] if "auth/" not in path else
                             path + f": expected {expected}, received {status}.")
    return json.loads(body) if body else None

meta = call("/api/auth/meta")
assert meta["signup_disabled"] and not meta["sso_enabled"]
results.append("password sign-in selected; public signup closed")
closed = call("/api/auth/signup", owner, expected=400)
assert "SIGNUP_RESTRICTED" in json.dumps(closed)
subprocess.run([sys.executable, str(Path(__file__).with_name("manage.py")), "owner", "--from-stdin"],
               input=json.dumps(owner), text=True, check=True)
assert call("/api/auth/meta")["signup_disabled"]
auth = call("/api/auth/signin", {"email": owner["email"], "password": owner["password"]}, expected=201)
headers = {"Authorization": "Bearer " + auth["access_token"],
           "organization-id": str(auth["organization_id"])}
results.append("owner bootstrapped; signup closed again; password sign-in successful")
job = call("/api/organization/build", {"name": "Beta Example Books", "location": "US",
            "baseCurrency": "USD", "timezone": "America/Chicago", "fiscalYear": "january",
            "language": "en", "dateFormat": "MM/DD/yyyy"})["data"]
job_id = job.get("job_id", job.get("jobId", job.get("id")))
assert job_id is not None
for attempt in range(120):
    state = call("/api/organization/build/" + str(job_id))
    if state.get("is_failed"):
        raise AssertionError("Organization provisioning failed.")
    if state.get("is_completed"):
        break
    time.sleep(2)
else:
    raise AssertionError("Organization provisioning timed out.")
results.append("new organization schema and seed data provisioned")
policy = call("/api/financial-review/auto-organize/policy")
assert not policy["enabled"]
assert policy["business_branch_id"] is None and policy["personal_branch_id"] is None
assert not policy["default_unknown_to_personal"]
results.append("new installations have no inherited owner classification defaults")
overview = call("/api/financial-review/overview")
assert overview["total"] == 0
results.append("new organization contains no private transactions")
branches = call("/api/branches")
assert isinstance(branches, list)
png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
boundary = "FreeBooksBeta" + secrets.token_hex(8)
payload = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"beta-receipt.png\"\r\nContent-Type: image/png\r\n\r\n".encode() +
           png + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"sourceName\"\r\n\r\nSynthetic beta receipt\r\n--{boundary}--\r\n".encode())
document = call("/api/attachments/vault/receipt", payload, extra={"Content-Type": "multipart/form-data; boundary=" + boundary})
assert document.get("data")
vault = call("/api/attachments/vault")
assert "beta-receipt.png" in json.dumps(vault)
results.append("phone-format receipt uploaded and listed through private object storage")

# Confirm validation errors never contain passwords/keys.
error = call("/api/auth/signup", {"email": "invalid", "password": "SENSITIVE-TEST-PASSWORD", "apiKey": "SENSITIVE-TEST-KEY"}, expected=400)
assert "SENSITIVE-TEST-" not in json.dumps(error)
results.append("validation responses do not echo submitted secrets")
doc_id = document["data"]["id"]
with urllib.request.urlopen(urllib.request.Request(BASE + f"/api/attachments/vault/{doc_id}/download", headers=headers), timeout=30) as response:
    assert response.read() == png
results.append("receipt download matches original uploaded bytes")
if "--backup-roundtrip" in sys.argv:
    backup_dir = manage.backup()
    manage.restore(backup_dir, True)
    restored_auth = call("/api/auth/signin", {"email": owner["email"], "password": owner["password"]}, expected=201)
    headers = {"Authorization": "Bearer " + restored_auth["access_token"], "organization-id": str(restored_auth["organization_id"])}
    assert call("/api/financial-review/overview")["total"] == 0
    assert "beta-receipt.png" in json.dumps(call("/api/attachments/vault"))
    with urllib.request.urlopen(urllib.request.Request(BASE + f"/api/attachments/vault/{doc_id}/download", headers=headers), timeout=30) as response:
        assert response.read() == png
    assert call("/api/auth/meta")["signup_disabled"]
    results.append("backup restored database, owner access and exact receipt bytes; signups closed")
for message in results:
    print("PASS " + message)
output = {"passed": len(results), "checks": results, "project": values["COMPOSE_PROJECT_NAME"]}
Path(__file__).with_name("smoke-results.json").write_text(json.dumps(output, indent=2) + "\n")
