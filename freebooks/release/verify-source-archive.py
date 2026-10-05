#!/usr/bin/env python3
"""Verify an alpha source archive, its manifest and SHA256SUMS without extracting it."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directory produced by make-source-archive.py")
    args = parser.parse_args()
    output = args.output.resolve()
    checksums = {}
    for line in (output / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split("  ", 1)
        path = output / name
        if not path.resolve().is_relative_to(output):
            parser.error("Checksum file points outside the release directory.")
        with path.open("rb") as f:
            actual = hashlib.file_digest(f, "sha256").hexdigest()
        if actual != digest:
            parser.error("Checksum mismatch: " + name)
        checksums[name] = digest
    manifest = json.loads((output / "source-manifest.json").read_text())
    expected = {f["path"]: f for f in manifest}
    actual_names = set()
    with tarfile.open(output / "freebooks-alpha-source.tar.gz", "r:gz") as archive:
        for entry in archive.getmembers():
            if entry.isdir():
                continue
            if not entry.isfile() or not entry.name.startswith("freebooks-alpha/") or ".." in Path(entry.name).parts:
                parser.error("Unexpected archive entry: " + entry.name)
            name = entry.name.removeprefix("freebooks-alpha/")
            if name == ".freebooks-source-snapshot":
                continue
            if name not in expected:
                parser.error("File missing from manifest: " + name)
            data = archive.extractfile(entry).read()
            if len(data) != expected[name]["bytes"] or hashlib.sha256(data).hexdigest() != expected[name]["sha256"]:
                parser.error("Manifest mismatch: " + name)
            actual_names.add(name)
    if actual_names != set(expected):
        parser.error("Manifest contains files absent from archive.")
    print(json.dumps({"status": "verified", "source_files": len(actual_names),
                      "checksum_files": len(checksums)}))

if __name__ == "__main__":
    main()
