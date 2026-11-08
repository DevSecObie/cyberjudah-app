#!/usr/bin/env python3
"""Rebuild Bible Strong's ordinary Bibles from public-domain sources, in its canonical-bible format.

Reads scripts/data/free-bible-sources.json. For each Bible it downloads (or reuses from the cache)
the pinned source archive, checks its sha256, transcribes every verse exactly, and writes
public/offline/<file> with the same entry name, schema and text identity rules as upstream's
buildCanonicalBibleFromLegacy (apps/resource-studio/src/legacyBiblePublication.ts).
No text is edited: no headings, notes or red words are added.

Usage: python3 -I scripts/build-free-bibles.py [--cache DIR] [ID ...]
"""
import argparse
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SOURCES = APP / 'scripts/data/free-bible-sources.json'
BOOK_MAP = APP / 'src/assets/cyberjudah/canonical-book-map.json'
OUTPUT = APP / 'public/offline'
ENTRIES = APP / 'scripts/data/free-bible-catalog-entries.json'
SCHEMA_VERSION = 4
ZIP_DATE = (2026, 10, 25, 0, 0, 0)

# eBible.org VPL book codes, in Bible Strong book order (1 = Genesis ... 66 = Revelation).
EBIBLE_VPL_BOOKS = (
    'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL '
    'ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT '
    'ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV'
).split()
VPL_LINE = re.compile(r'^([1-3A-Z]{3}) (\d+):(\d+)(?: (.*))?$')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def stringify(value):
    # Same bytes as JavaScript's JSON.stringify for these values.
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


BOOK_IDS = {int(k): v for k, v in json.loads(BOOK_MAP.read_text())['sourceToCanonical'].items()}


def canonical_book_id(source_number):
    return BOOK_IDS.get(source_number, source_number)


def hash_verses(verses):
    # hashCanonicalBibleVerses in apps/resource-studio/src/strongBibleMobilePublication.ts
    digest = hashlib.sha256()
    for book in sorted(verses, key=int):
        for chapter in sorted(verses[book], key=int):
            for verse in sorted(verses[book][chapter], key=int):
                row = [int(book), int(chapter), int(verse), verses[book][chapter][verse]]
                digest.update((stringify(row) + '\n').encode())
    return digest.hexdigest()


def fetch(source, cache):
    path = cache / Path(source['url']).name
    if not path.exists():
        cache.mkdir(parents=True, exist_ok=True)
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '120',
                        '-o', str(path), source['url']], check=True)
    data = path.read_bytes()
    if sha256(data) != source['sha256']:
        raise SystemExit(f"Source changed, review and re-pin: {source['url']} is {sha256(data)}")
    return data


def read_ebible_vpl(archive, member):
    text = zipfile.ZipFile(io.BytesIO(archive)).read(member).decode('utf-8')
    if text.startswith('﻿'):
        raise SystemExit(f'{member}: unexpected byte order mark')
    verses = {}
    count = 0
    book_ids = {code: canonical_book_id(n) for n, code in enumerate(EBIBLE_VPL_BOOKS, 1)}
    for number, line in enumerate(text.split('\n'), 1):
        if line == '':
            continue
        match = VPL_LINE.match(line)
        if not match or match.group(1) not in book_ids:
            raise SystemExit(f'{member}:{number}: unsupported line {line[:60]!r}')
        code, chapter, verse, body = match.groups()
        book = str(book_ids[code])
        chapter_verses = verses.setdefault(book, {}).setdefault(str(int(chapter)), {})
        key = str(int(verse))
        if key in chapter_verses:
            raise SystemExit(f'{member}:{number}: duplicate verse {code} {chapter}:{verse}')
        # The verse text exactly as published. A verse the translation omits has empty text.
        chapter_verses[key] = {'text': body or '', 'startTags': [], 'layout': [],
                               'notes': [], 'headings': []}
        count += 1
    return verses, count


def build(bible, cache):
    source = bible['source']
    archive = fetch(source, cache)
    if source['kind'] != 'ebible-vpl':
        raise SystemExit(f"{bible['id']}: unsupported source kind {source['kind']}")
    verses, count = read_ebible_vpl(archive, source['member'])
    text_sha256 = hash_verses(verses)
    publication = {
        'format': 'bible-strong-canonical-bible',
        'schemaVersion': SCHEMA_VERSION,
        'applicationVersionId': bible['id'],
        'datasetId': f"ordinary-bible-{bible['id'].lower()}",
        'sourceVersion': f"{source['url']}#{source['member']}@{source['sha256'][:12]}",
        'textRevision': f"{bible['id'].lower()}-{text_sha256[:20]}",
        'textSha256': text_sha256,
        'sourceSha256': source['sha256'],
        'verseCount': count,
        'noteCount': 0,
        'headingCount': 0,
        'verses': verses,
    }
    content = (stringify(publication) + '\n').encode()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        info = zipfile.ZipInfo(bible['entry'], ZIP_DATE)
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, content)
    archive_bytes = buffer.getvalue()
    target = OUTPUT / bible['file']
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(archive_bytes)
    return {
        'id': bible['catalogId'],
        'file': bible['file'],
        'entry': bible['entry'],
        'entries': {'canonical': {'entry': bible['entry'], 'sha256': sha256(content), 'bytes': len(content)}},
        'archiveSha256': sha256(archive_bytes),
        'archiveBytes': len(archive_bytes),
        'contentSha256': sha256(content),
        'contentBytes': len(content),
        'installedBytes': len(content) * 2,
        'peakInstallationBytes': len(content) * 3 + len(archive_bytes),
        'strategy': 'sqlite-import',
        'textRevision': publication['textRevision'],
        'textSha256': text_sha256,
        'verseCount': count,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', default=str(APP / '.free-bible-sources'))
    parser.add_argument('ids', nargs='*')
    args = parser.parse_args()
    bibles = json.loads(SOURCES.read_text())['bibles']
    selected = [b for b in bibles if not args.ids or b['id'] in args.ids]
    entries = json.loads(ENTRIES.read_text()) if ENTRIES.exists() else {}
    for bible in selected:
        entry = build(bible, Path(args.cache))
        entries[entry['id']] = entry
        print(json.dumps({k: entry[k] for k in ('id', 'file', 'archiveSha256', 'archiveBytes', 'verseCount')}))
    ENTRIES.write_text(json.dumps(dict(sorted(entries.items())), indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
