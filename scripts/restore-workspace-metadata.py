#!/usr/bin/env python3
"""Verify cloned backup files, recreate empty directories, and restore permissions."""
import argparse
import hashlib
import json
import os
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path,help='Directory cloned from the workspace bundle')
args=parser.parse_args()
root=args.directory.resolve()
manifest=json.loads((root/'ARCHIVE-MANIFEST.json').read_text())
entries={entry['path']:entry for entry in manifest['entries']}
def path(name):
    rel=Path(name)
    if rel.is_absolute() or '..' in rel.parts:
        raise SystemExit('Unsafe manifest path')
    result=root/rel
    parent=result.parent
    while parent!=root:
        if parent.is_symlink():raise SystemExit('Symlink parent is not allowed')
        parent=parent.parent
    return result
verified=0
for entry in manifest['entries']:
    target=path(entry['path'])
    if entry['kind']=='directory':
        if target.is_symlink():raise SystemExit('Directory replaced by a symlink')
        target.mkdir(parents=True,exist_ok=True)
    elif entry['kind']=='symlink':
        if not target.is_symlink() or os.readlink(target)!=entry['target']:
            raise SystemExit('Symlink differs: '+entry['path'])
    elif entry['kind'] in {'file','hardlink'}:
        if target.is_symlink() or not target.is_file():raise SystemExit('Missing file: '+entry['path'])
        expected=entry
        seen=set()
        while expected['kind']=='hardlink':
            if expected['target'] in seen:raise SystemExit('Cyclic hardlink reference')
            seen.add(expected['target']);expected=entries[expected['target']]
        digest=hashlib.sha256()
        with target.open('rb') as file:
            for block in iter(lambda:file.read(1024*1024),b''):digest.update(block)
        if target.stat().st_size!=expected['size'] or digest.hexdigest()!=expected['sha256']:
            raise SystemExit('File checksum differs: '+entry['path'])
        verified+=1
for entry in manifest['entries']:
    if entry['kind']!='symlink':
        os.chmod(path(entry['path']),int(entry['mode'],8))
print('Verified files:',verified)
print('Restored empty directories and original permission modes.')
print('Git recreates hardlinked files as separate files with identical content.')
