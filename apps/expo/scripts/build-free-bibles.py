#!/usr/bin/env python3
"""Rebuild Bible Strong's ordinary Bibles from public-domain sources, in its canonical-bible format.

Reads scripts/data/free-bible-sources.json. For each Bible it downloads (or reuses from the cache)
the pinned source archive, checks its sha256, transcribes every verse exactly, and writes
public/offline/<file> with the same entry name, schema and text identity rules as upstream's
buildCanonicalBibleFromLegacy (apps/resource-studio/src/legacyBiblePublication.ts).
No text is edited: no headings, notes or red words are added. Sources are either eBible.org
verse-per-line files (taken line by line) or CrossWire SWORD modules (read with pysword==0.2.8):
for those, titles and notes are left out, other markup is unwrapped, whitespace that only
surrounded markup becomes one space, and versification slots without text are left out.

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
    if path.exists():
        data = path.read_bytes()
        if sha256(data) != source['sha256']:
            raise SystemExit(f'Cached source does not match its pin, delete it and rerun: {path}')
        return data
    cache.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + '.part')
    subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '120',
                    '-o', str(partial), source['url']], check=True)
    data = partial.read_bytes()
    if sha256(data) != source['sha256']:
        partial.unlink()
        raise SystemExit(f"Source changed, review and re-pin: {source['url']} is {sha256(data)}")
    partial.rename(path)
    return data


def read_ebible_vpl(archive, member):
    text = zipfile.ZipFile(io.BytesIO(archive)).read(member).decode('utf-8')
    if text.startswith('\ufeff') or '\r' in text:
        raise SystemExit(f'{member}: unexpected byte order mark or carriage return')
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


# OSIS book names of the 66 books, in Bible Strong book order.
OSIS_BOOKS = (
    'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov '
    'Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark '
    'Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet '
    '2Pet 1John 2John 3John Jude Rev'
).split()
# Only these OSIS elements may appear. Titles (the module's section headings) and notes are not
# verse text and are left out with their content; every other element is unwrapped.
SWORD_DROPPED = re.compile(r'<(title|note)\b[^>]*>.*?</\1>', re.S)
SWORD_ALLOWED = {'title', 'note', 'transChange', 'div', 'chapter', 'lg', 'l'}
REMOVED = '\x00'


def osis_verse_text(raw, where):
    for tag in re.findall(r'<\s*/?\s*([A-Za-z]+)', raw):
        if tag not in SWORD_ALLOWED:
            raise SystemExit(f'{where}: unsupported OSIS element <{tag}>')
    if '&' in raw or REMOVED in raw:
        raise SystemExit(f'{where}: unexpected entity or control character')
    text = re.sub(r'<[^>]*>', REMOVED, SWORD_DROPPED.sub(REMOVED, raw))
    # Whitespace that only surrounded removed markup becomes one space (none at the ends);
    # whitespace inside the text itself is kept as published.
    text = re.sub(r'[ \t\n]*\x00[ \t\n\x00]*', lambda m: ' ' if m.group(0).strip(REMOVED) else '', text)
    return text.strip()


def read_sword_module(archive_path, module):
    from pysword.modules import SwordModules  # pip install pysword==0.2.8

    modules = SwordModules(str(archive_path))
    modules.parse_modules()
    bible = modules.get_bible_from_module(module)
    structure = bible.get_structure().get_books()
    books = structure.get('ot', []) + structure.get('nt', [])
    if [b.osis_name for b in books] != OSIS_BOOKS:
        raise SystemExit(f'{module}: books are not the 66-book canon')
    verses, count, skipped = {}, 0, []
    for number, book in enumerate(books, 1):
        book_key = str(canonical_book_id(number))
        for chapter in range(1, book.num_chapters + 1):
            for verse in range(1, book.chapter_lengths[chapter - 1] + 1):
                where = f'{module} {book.osis_name} {chapter}:{verse}'
                raw = bible.get(books=[book.osis_name], chapters=[chapter], verses=[verse], clean=False)
                text = osis_verse_text(raw, where)
                if text == '':
                    # A slot of the versification that the module leaves without text.
                    skipped.append(f'{book.osis_name} {chapter}:{verse}')
                    continue
                verses.setdefault(book_key, {}).setdefault(str(chapter), {})[str(verse)] = {
                    'text': text, 'startTags': [], 'layout': [], 'notes': [], 'headings': []}
                count += 1
    if skipped:
        print(json.dumps({'module': module, 'emptySlotsLeftOut': skipped}, ensure_ascii=False))
    return verses, count


def build(bible, cache):
    source = bible['source']
    archive = fetch(source, cache)
    if source['kind'] == 'ebible-vpl':
        verses, count = read_ebible_vpl(archive, source['member'])
    elif source['kind'] == 'sword-module':
        verses, count = read_sword_module(cache / Path(source['url']).name, source['module'])
    else:
        raise SystemExit(f"{bible['id']}: unsupported source kind {source['kind']}")
    text_sha256 = hash_verses(verses)
    publication = {
        'format': 'bible-strong-canonical-bible',
        'schemaVersion': SCHEMA_VERSION,
        'applicationVersionId': bible['id'],
        'datasetId': f"ordinary-bible-{bible['id'].lower()}",
        'sourceVersion': f"{source['url']}#{source.get('member') or source['module']}@{source['sha256'][:12]}",
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
