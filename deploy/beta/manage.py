#!/usr/bin/env python3
"""FreeBooks beta installer. Python standard library + Docker Compose v2."""
import argparse
import getpass
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
ENV = HERE / ".env"

def read_env():
    if not ENV.exists():
        raise RuntimeError("Run 'init' first.")
    result = {}
    for line in ENV.read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            result[k] = v.strip().strip('"').strip("'")
    return result

def write_env(values):
    text = "".join(f"{k}={v}\n" for k, v in values.items())
    if any("\n" in str(v) or "\r" in str(v) for v in values.values()):
        raise RuntimeError("Environment values cannot contain newlines.")
    temp = ENV.with_suffix(".tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(text)
    os.replace(temp, ENV)
    os.chmod(ENV, 0o600)

def docker_compose():
    probe = subprocess.run(["docker", "compose", "version"], capture_output=True)
    if probe.returncode == 0:
        return ["docker", "compose"]
    if shutil.which("docker-compose"):
        version = subprocess.run(["docker-compose", "version", "--short"], capture_output=True, text=True)
        if version.returncode == 0 and version.stdout.strip().lstrip("v").startswith("2."):
            return ["docker-compose"]
    raise RuntimeError("Docker Compose v2 is required.")

def compose(*args, capture=False, check=True):
    return subprocess.run([*docker_compose(), "--project-directory", str(HERE),
                           "--env-file", str(ENV), "-f", str(HERE / "compose.yaml"), *args],
                          cwd=HERE, check=check, text=True, capture_output=capture)

def init(port=8740, project="freebooks-beta"):
    if ENV.exists():
        print("Existing configuration preserved.")
        return
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{1,40}", project):
        raise RuntimeError("Project name must contain lowercase letters, numbers, underscores or hyphens.")
    if not 1024 <= port <= 65535:
        raise RuntimeError("Port must be between 1024 and 65535.")
    values = {}
    for line in (HERE / ".env.example").read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            values[k] = v
    for key in ("DB_PASSWORD", "DB_ROOT_PASSWORD", "APP_JWT_SECRET", "PAYMENT_PROVIDER_ENCRYPTION_KEY",
                "GARAGE_RPC_SECRET", "GARAGE_ADMIN_TOKEN", "S3_SECRET_ACCESS_KEY"):
        values[key] = secrets.token_hex(32)
    values["S3_ACCESS_KEY_ID"] = "GK" + secrets.token_hex(12)
    values["HTTP_PORT"] = str(port)
    values["BASE_URL"] = f"http://127.0.0.1:{port}"
    values["COMPOSE_PROJECT_NAME"] = project
    write_env(values)
    (HERE / "init-db.sh").chmod(0o755)
    print("Unique configuration created. Signups are closed. Keep .env private and backed up.")

def garage_setup():
    for attempt in range(30):
        status = compose("exec", "-T", "garage", "/garage", "status", capture=True, check=False)
        if status.returncode == 0:
            break
        time.sleep(2)
    else:
        raise RuntimeError("Object storage did not start.")
    values = read_env()
    # Garage status reports a short node ID; both full/short identifiers accepted.
    node = re.search(r"(?m)^([a-f0-9]{16,64})\s", status.stdout)
    if not node:
        raise RuntimeError("Could not determine Garage node ID.")
    layout = compose("exec", "-T", "garage", "/garage", "layout", "show", capture=True)
    if "No nodes are currently assigned" in layout.stdout or not re.search(r"\bdc1\b", layout.stdout):
        compose("exec", "-T", "garage", "/garage", "layout", "assign", node.group(1),
                "-z", "dc1", "-c", "1G", capture=True)
        compose("exec", "-T", "garage", "/garage", "layout", "apply", "--version", "1", capture=True)
    # Import output can contain credentials: never print it, including failures.
    key = compose("exec", "-T", "garage", "/garage", "key", "info", values["S3_ACCESS_KEY_ID"],
                  capture=True, check=False)
    if key.returncode != 0:
        imported = compose("exec", "-T", "garage", "/garage", "key", "import", "--yes",
                           "-n", "freebooks", values["S3_ACCESS_KEY_ID"], values["S3_SECRET_ACCESS_KEY"],
                           capture=True, check=False)
        if imported.returncode:
            raise RuntimeError("Object storage key setup failed; inspect Garage configuration privately.")
    bucket = compose("exec", "-T", "garage", "/garage", "bucket", "info", "freebooks",
                     capture=True, check=False)
    if bucket.returncode:
        compose("exec", "-T", "garage", "/garage", "bucket", "create", "freebooks", capture=True)
    compose("exec", "-T", "garage", "/garage", "bucket", "allow", "freebooks",
            "--read", "--write", "--key", values["S3_ACCESS_KEY_ID"], capture=True)

def start(build=False):
    read_env()
    compose("config", "--quiet")
    if build:
        compose("build", "api", "web")
    compose("up", "-d", "--wait", "--wait-timeout", "180", "db", "redis", "garage", "gotenberg")
    garage_setup()
    compose("run", "--rm", "--no-deps", "api", "node", "dist/cli.js", "system:migrate:latest")
    compose("run", "--rm", "--no-deps", "api", "node", "dist/cli.js", "tenants:migrate:latest")
    compose("up", "-d", "--wait", "--wait-timeout", "240", "api", "web")
    print("FreeBooks is running at " + read_env()["BASE_URL"])

def api(path, body=None, timeout=60):
    values = read_env()
    address = "http://127.0.0.1:" + values["HTTP_PORT"]
    payload = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(address + path, payload, {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Auth response can carry confidential details. Return status only.
        raise RuntimeError(f"API request failed ({error.code}); no account was confirmed.") from None

def owner(from_stdin=False):
    values = read_env()
    if values.get("BIND_ADDRESS", "127.0.0.1") != "127.0.0.1":
        raise RuntimeError("Owner bootstrap requires BIND_ADDRESS=127.0.0.1. Bootstrap locally before exposing HTTPS.")
    if (HERE / ".owner-created").exists():
        raise RuntimeError("Owner already created. Use the application to manage your account.")
    if from_stdin:
        info = json.load(sys.stdin)
    else:
        info = {"email": input("Owner email: ").strip(),
                "firstName": input("First name: ").strip(),
                "lastName": input("Last name: ").strip(),
                "password": getpass.getpass("Owner password (at least 14 characters): ")}
        if info["password"] != getpass.getpass("Confirm password: "):
            raise RuntimeError("Passwords do not match.")
    if not isinstance(info, dict) or any(not isinstance(info.get(k), str) or not info[k].strip()
                                       for k in ("email", "password", "firstName", "lastName")):
        raise RuntimeError("Owner requires email, password, firstName and lastName.")
    if len(info["password"]) < 14 or not re.fullmatch(r"[^@\s,]+@[^@\s,]+\.[^@\s,]+", info["email"]):
        raise RuntimeError("Use a valid email and a password of at least 14 characters.")
    temporary = dict(values, SIGNUP_DISABLED="true", SIGNUP_ALLOWED_EMAILS=info["email"],
                     SIGNUP_ALLOWED_DOMAINS="")
    try:
        write_env(temporary)
        compose("up", "-d", "--no-deps", "--wait", "--wait-timeout", "180", "api")
        api("/api/auth/signup", info)
        # This marker holds no personal data.
        (HERE / ".owner-created").write_text("created\n")
        print("Owner created. Sign in and complete the organization setup.")
    finally:
        info.clear()
        values["SIGNUP_DISABLED"] = "true"
        values["SIGNUP_ALLOWED_EMAILS"] = ""
        write_env(values)
        compose("up", "-d", "--no-deps", "--wait", "--wait-timeout", "180", "api")

def backup():
    read_env()
    destination = HERE / "backups" / time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    destination.mkdir(parents=True, mode=0o700)
    shutil.copy2(ENV, destination / "config.env")
    os.chmod(destination / "config.env", 0o600)
    try:
        # Quiesce writers before taking the SQL and document snapshots.
        compose("stop", "api")
        sql = destination / "databases.sql.gz"
        cmd = [*docker_compose(), "--project-directory", str(HERE), "--env-file", str(ENV),
               "-f", str(HERE / "compose.yaml"), "exec", "-T", "db", "sh", "-c",
               'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -uroot --all-databases --single-transaction --routines --events']
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
        with gzip.open(sql, "wb") as out:
            shutil.copyfileobj(proc.stdout, out)
        if proc.wait():
            raise RuntimeError("Database backup failed.")
        compose("exec", "-T", "redis", "redis-cli", "SAVE", capture=True)
        compose("stop", "garage", "redis")
        for service, source, label in (("garage", "/var/lib/garage", "objects"),
                                       ("api", "/app/static/imports", "imports"),
                                       ("redis", "/data", "queues")):
            raw = destination / label
            compose("cp", f"{service}:{source}", str(raw))
            with tarfile.open(destination / (label + ".tar.gz"), "w:gz") as out:
                out.add(raw, arcname=label)
            shutil.rmtree(raw)
    finally:
        compose("up", "-d", "--wait", "--wait-timeout", "180", "garage", "redis", "api")
    hashes = []
    for f in sorted(destination.iterdir()):
        if f.is_file():
            os.chmod(f, 0o600)
            with f.open("rb") as stream:
                hashes.append(hashlib.file_digest(stream, "sha256").hexdigest() + "  " + f.name)
    (destination / "SHA256SUMS").write_text("\n".join(hashes) + "\n")
    print("Private backup saved to " + str(destination))
    return destination

def restore(source, replace_data=False):
    if not replace_data:
        raise RuntimeError("Restore replaces this installation's data. Pass --replace-data after making a separate backup.")
    source = Path(source).resolve()
    expected = {"config.env", "databases.sql.gz", "objects.tar.gz", "imports.tar.gz", "queues.tar.gz"}
    manifest = source / "SHA256SUMS"
    if not manifest.is_file():
        raise RuntimeError("Backup checksum manifest is missing.")
    checked = set()
    for line in manifest.read_text().splitlines():
        digest, name = line.split("  ", 1)
        if name not in expected:
            raise RuntimeError("Unexpected backup file.")
        with (source / name).open("rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != digest:
            raise RuntimeError("Backup checksum mismatch.")
        checked.add(name)
    if checked != expected:
        raise RuntimeError("Backup is incomplete.")
    current = read_env()
    # Keep the target's ports and Docker project. Restore encryption/database keys.
    restored = {}
    for line in (source / "config.env").read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            restored[k] = v
    for key in ("COMPOSE_PROJECT_NAME", "HTTP_PORT", "BIND_ADDRESS", "BASE_URL"):
        restored[key] = current[key]
    restored["SIGNUP_DISABLED"] = "true"
    restored["SIGNUP_ALLOWED_EMAILS"] = ""
    restored["SIGNUP_ALLOWED_DOMAINS"] = ""
    # Require a stopped target with matching root credentials. Fresh target: init,
    # restore .env keys before start, start infrastructure using the helper.
    compose("stop", "web", "api", "garage", "redis")
    root_before = current["DB_ROOT_PASSWORD"]
    write_env(restored)
    # Existing database auth still uses its original root credential.
    compose("up", "-d", "--wait", "db", "gotenberg")
    cmd = [*docker_compose(), "--project-directory", str(HERE), "--env-file", str(ENV),
           "-f", str(HERE / "compose.yaml"), "exec", "-T", "-e", "RESTORE_ROOT=" + root_before,
           "db", "sh", "-c", 'MYSQL_PWD="$RESTORE_ROOT" exec mariadb -uroot']
    # A gzip file's fileno points to compressed bytes. Stream decoded SQL
    # through a pipe so the database never receives the gzip container.
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL)
    try:
        with gzip.open(source / "databases.sql.gz", "rb") as stream:
            shutil.copyfileobj(stream, proc.stdin)
        proc.stdin.close()
        returncode = proc.wait()
    except BaseException:
        proc.stdin.close()
        proc.wait()
        raise
    if returncode:
        raise RuntimeError("Database restore failed. Keep the stack stopped and inspect the backup privately.")
    # Garage/API remain stopped while their named volumes are restored.
    compose("create", "garage", "api", "redis")
    for service, target, label in (("garage", "/var/lib/garage", "objects"),
                                   ("api", "/app/static/imports", "imports"),
                                   ("redis", "/data", "queues")):
        container = compose("ps", "-a", "-q", service, capture=True).stdout.strip()
        mounts = subprocess.run(["docker", "inspect", "--format", "{{json .Mounts}}", container],
                                capture_output=True, text=True, check=True)
        volume = next((m["Name"] for m in json.loads(mounts.stdout)
                       if m.get("Type") == "volume" and m["Destination"] == target), None)
        if not volume or not volume.startswith(restored["COMPOSE_PROJECT_NAME"] + "_"):
            raise RuntimeError("Target storage volume does not belong to this installation.")
        # Prevalidate member names; no traversal, links or devices are allowed.
        with tarfile.open(source / (label + ".tar.gz")) as archive:
            for member in archive.getmembers():
                if (not member.name.startswith(label + "/") and member.name != label) or ".." in Path(member.name).parts or member.issym() or member.islnk() or member.isdev():
                    raise RuntimeError("Unsafe backup archive member.")
        subprocess.run(["docker", "run", "--rm", "--network", "none",
                        "-v", volume + ":/restore", "-v", str(source) + ":/backup:ro",
                        "redis:7-alpine", "sh", "-c",
                        "find /restore -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /backup/" +
                        label + ".tar.gz -C /restore --strip-components=1"], check=True)
    compose("up", "-d", "--wait", "--wait-timeout", "240")
    (HERE / ".owner-created").write_text("restored\n")
    print("Backup restored; signups remain closed.")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("init")
    setup.add_argument("--port", type=int, default=8740)
    setup.add_argument("--project", default="freebooks-beta")
    launch = commands.add_parser("start")
    launch.add_argument("--build", action="store_true")
    create = commands.add_parser("owner")
    create.add_argument("--from-stdin", action="store_true")
    recovery = commands.add_parser("restore")
    recovery.add_argument("--from", dest="source", required=True)
    recovery.add_argument("--replace-data", action="store_true")
    for name in ("status", "stop", "backup", "check"):
        commands.add_parser(name)
    args = parser.parse_args()
    if args.command == "init":
        init(args.port, args.project)
    elif args.command == "start":
        start(args.build)
    elif args.command == "owner":
        owner(args.from_stdin)
    elif args.command == "status":
        compose("ps")
    elif args.command == "stop":
        compose("stop")
    elif args.command == "backup":
        backup()
    elif args.command == "restore":
        restore(args.source, args.replace_data)
    elif args.command == "check":
        read_env()
        compose("config", "--quiet")
        api("/api/system_db")
        print("Compose and API health checks passed.")

if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, OSError, ValueError) as exc:
        # Never print captured command stdout/stderr that may contain secrets.
        print("Setup failed: " + (str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__),
              file=sys.stderr)
        sys.exit(1)
