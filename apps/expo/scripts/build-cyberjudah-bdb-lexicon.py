#!/usr/bin/env python3
"""Build the CyberJudah Hebrew lexicon module (strong_lexicon.resources.sqlite): the Brown-Driver-
Briggs Hebrew Lexicon entry of each Hebrew Strong's number, shown under the Strong's definition.

The text of Brown, Driver and Briggs (1906) is in the public domain. Its transcription and its
index to Strong's numbers are the Open Scriptures Hebrew Bible Project's (CC BY 4.0), credited in
every entry.

    python3 scripts/build-cyberjudah-bdb-lexicon.py <openscriptures/HebrewLexicon>

Each entry is tied to the English Strong's lexicon (strong_lexicon.simple-en.sqlite), whose entry
of Hebrew number N has the id N.
"""
import hashlib
import html
import json
import re
import sqlite3
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1])
OFFLINE = APP / 'public/offline'
CATALOG_PATHS = [APP / 'src/assets/cyberjudah/offline-catalog.json', OFFLINE / 'catalog.json']
URL = 'https://api.cyberjudah.io/v1/offline-artifacts/'
FILE = 'strong_lexicon.resources.sqlite'
NS = {'bdb': 'http://openscriptures.github.com/morphhb/namespace', 'li': 'http://openscriptures.github.com/morphhb/namespace'}
CREDIT = ('<p><small>Brown, Driver and Briggs, <i>A Hebrew and English Lexicon of the Old Testament</i> (1906). '
          'Transcription: Open Scriptures Hebrew Bible Project, CC BY 4.0.</small></p>')

sha = lambda data: hashlib.sha256(data).hexdigest()


def local(tag):
    return tag.rsplit('}', 1)[-1]


def render(node):
    """The entry's text as reading HTML: Hebrew words, meanings in bold, verses as links."""
    out = html.escape(node.text or '')
    for child in node:
        tag = local(child.tag)
        inner = render(child)
        if tag == 'w':
            out += f'<span lang="he" dir="rtl">{inner}</span>'
        elif tag == 'def':
            out += f'<b>{inner}</b>'
        elif tag == 'ref' and child.get('r'):
            out += f'<a href="bible://{html.escape(child.get("r"))}">{inner}</a>'
        elif tag in ('pos', 'em', 'foreign', 'asp', 'stem'):
            out += f'<i>{inner}</i>'
        elif tag == 'sense':
            number = child.get('n')
            out += f'<div>{f"<b>{html.escape(number)}.</b> " if number else ""}{inner}</div>'
        elif tag == 'status':
            pass
        else:
            out += inner
        out += html.escape(child.tail or '')
    return out


def main():
    entries = {}
    for entry in ET.parse(SOURCE / 'BrownDriverBriggs.xml').getroot().iter():
        if local(entry.tag) == 'entry' and entry.get('id'):
            body = re.sub(r'\s+', ' ', render(entry)).strip()
            if body:
                entries[entry.get('id')] = f'<div>{body}</div>'

    by_strong = {}
    for xref in ET.parse(SOURCE / 'LexicalIndex.xml').getroot().iter():
        if local(xref.tag) != 'xref':
            continue
        strong, bdb = xref.get('strong'), xref.get('bdb')
        number = re.match(r'\d+', strong or '')
        if number and bdb in entries:
            ids = by_strong.setdefault(int(number.group()), [])
            if bdb not in ids:
                ids.append(bdb)

    rows = []
    for number in sorted(by_strong):
        content = ''.join(entries[bdb] for bdb in by_strong[number][:3]) + CREDIT
        rows.append((number, content))

    revision = 'cj-strong-lexicon-resources-' + sha(json.dumps(rows, ensure_ascii=False).encode())[:24]
    path = OFFLINE / 'databases' / FILE
    path.unlink(missing_ok=True)
    db = sqlite3.connect(path)
    db.executescript('''
      PRAGMA journal_mode=DELETE;
      CREATE TABLE DictionaryMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE LexiconResources (id INTEGER PRIMARY KEY, stepEntryId INTEGER NOT NULL, source TEXT NOT NULL,
        kind TEXT NOT NULL, contentHtml TEXT NOT NULL);
      CREATE INDEX LexiconResources_entry_idx ON LexiconResources(stepEntryId, id);
      CREATE TABLE LexiconResourceTranslations (resourceId INTEGER NOT NULL, language TEXT NOT NULL,
        contentHtml TEXT NOT NULL, PRIMARY KEY(resourceId, language)) WITHOUT ROWID;
      BEGIN;
    ''')
    for index, (number, content) in enumerate(rows, start=1):
        db.execute('INSERT INTO LexiconResources VALUES (?, ?, ?, ?, ?)', (index, number, 'BDB', 'dictionary', content))
    for key, value in {
        'moduleKind': 'resources', 'moduleSchemaVersion': '1', 'resourceIdentity': 'strong-lexicon:resources',
        'resourceRevision': revision, 'language': 'en',
        'source': 'Brown-Driver-Briggs Hebrew Lexicon (public domain); transcription by the Open Scriptures Hebrew Bible Project (CC BY 4.0)',
    }.items():
        db.execute('INSERT INTO DictionaryMeta VALUES (?, ?)', (key, value))
    db.commit()
    db.execute('VACUUM')
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    db.close()

    data = path.read_bytes()
    with zipfile.ZipFile(f'{path}.zip', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        info = zipfile.ZipInfo(FILE, (2026, 11, 4, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16  # a regular file, as the app's archive check requires
        archive.writestr(info, data)
    packed = Path(f'{path}.zip').read_bytes()
    path.unlink()

    for catalog_path in CATALOG_PATHS:
        catalog = json.loads(catalog_path.read_text())
        catalog['resources']['strong-lexicon:resources'] = {
            'id': 'strong-lexicon:resources',
            'url': f'{URL}databases/{FILE}.zip?sha256={sha(packed)}',
            'file': f'databases/{FILE}.zip', 'entry': FILE,
            'entries': {'canonical': {'entry': FILE, 'sha256': sha(data), 'bytes': len(data)}},
            'archiveSha256': sha(packed), 'archiveBytes': len(packed), 'contentSha256': sha(data),
            'contentBytes': len(data), 'installedBytes': len(data),
            'peakInstallationBytes': len(data) * 2 + len(packed), 'strategy': 'archive-extract',
            'resourceRevision': revision,
        }
        catalog['resourceCount'] = len(catalog['resources'])
        pretty = catalog_path.parent.name != 'offline'
        catalog_path.write_text(json.dumps(catalog, indent=2 if pretty else None, ensure_ascii=False) + ('\n' if pretty else ''))

    print(json.dumps({'entries': len(rows), 'bdbEntries': len(entries), 'resourceRevision': revision,
                      'archiveBytes': len(packed), 'contentBytes': len(data)}))


main()

# Shared packaging adapter reads the one canonical-book-map.json.
import subprocess
subprocess.run([sys.executable, str(Path(__file__).with_name('normalize-cyberjudah-content.py'))], check=True)
