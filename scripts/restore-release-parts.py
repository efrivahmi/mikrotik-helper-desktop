#!/usr/bin/env python3
"""Reassemble a release backup after checking every downloaded part."""
import argparse
import hashlib
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory', type=Path, help='Directory with WORKSPACE-PARTS.json and all archive parts')
args = parser.parse_args()
root = args.directory.resolve()
manifest = json.loads((root / 'WORKSPACE-PARTS.json').read_text())
if manifest.get('format') != 'mikrotik-workspace-parts-v1':
    raise SystemExit('Unsupported backup manifest')
name = manifest['archive_name']
if not isinstance(name, str) or Path(name).name != name or not name.endswith(('-workspace.tar.gz', '-workspace.bundle')):
    raise SystemExit('Invalid archive filename')
parts = manifest['parts']
if not isinstance(parts, list) or not parts:
    raise SystemExit('Manifest has no archive parts')
output = root / name
partial = root / (name + '.assembling')
if output.exists() or partial.exists():
    raise SystemExit('Output already exists; use a fresh directory')
for index, part in enumerate(parts):
    if part['index'] != index or part['name'] != name + f'.part-{index:04d}':
        raise SystemExit('Part names/order are invalid')
    source = root / part['name']
    if not source.is_file() or source.is_symlink() or source.stat().st_size != part['bytes']:
        raise SystemExit('Missing part or size mismatch: ' + part['name'])
full = hashlib.sha256()
total = 0
fd = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'wb') as target:
    for part in parts:
        digest = hashlib.sha256()
        with (root / part['name']).open('rb') as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
                full.update(block)
                total += len(block)
                target.write(block)
        if digest.hexdigest() != part['sha256']:
            raise SystemExit('Part checksum mismatch; incomplete assembly kept: ' + part['name'])
        print('Verified:', part['name'])
    target.flush()
    os.fsync(target.fileno())
if total != manifest['archive_bytes'] or full.hexdigest() != manifest['archive_sha256']:
    raise SystemExit('Complete archive checksum mismatch; incomplete assembly kept')
partial.rename(output)
print('Verified complete archive:', output)
print('Restore into an empty directory; follow RECOVERY.md')
