#!/usr/bin/env python3
"""Check the release files, ZIP contracts and stable-id conversion without network access."""
import hashlib
import io
import json
import sqlite3
import zipfile
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
REPO = APP.parent.parent
sha = lambda data: hashlib.sha256(data).hexdigest()
catalog = json.loads((REPO / 'packages/resource-catalog/src/mobile-resource-catalog.json').read_text())
assert catalog == json.loads((APP / 'public/offline/catalog.json').read_text())
assert catalog['resourceCount'] == len(catalog['resources'])
excluded = set(json.loads((APP / 'src/assets/cyberjudah/excluded-upstream-resources.json').read_text()))
assert not excluded.intersection(catalog['resources'])


def contents(record, folder):
    data = (folder / record['file']).read_bytes()
    assert sha(data) == record['archiveSha256'], record['id'] + ':archive-sha'
    assert len(data) == record['archiveBytes'], record['id'] + ':archive-bytes'
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.testzip() is None, record['id'] + ':crc'
        assert len(archive.infolist()) == 1, record['id'] + ':members'
        info = archive.getinfo(record['entry'])
        assert info.external_attr >> 16 & 0o170000 == 0o100000, record['id'] + ':regular-file'
        payload = archive.read(info)
    assert sha(payload) == record['contentSha256'], record['id'] + ':content-sha'
    assert len(payload) == record['contentBytes'], record['id'] + ':content-bytes'
    assert record['entries']['canonical']['sha256'] == sha(payload), record['id'] + ':member-sha'
    return payload


payloads = {}
for identity, record in catalog['resources'].items():
    assert identity == record['id']
    assert record['url'].split('?')[0] == 'https://api.cyberjudah.io/v1/offline-artifacts/' + record['file']
    folder = next(folder for folder in (APP / 'public/offline', APP / 'public/offline-artifacts') if (folder / record['file']).is_file())
    payload = contents(record, folder)
    payloads[identity] = payload
    if payload.startswith(b'SQLite format 3'):
        db = sqlite3.connect(':memory:')
        db.deserialize(payload)
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok', identity + ':sqlite'
        db.close()

mapping = json.loads((APP / 'src/assets/cyberjudah/canonical-book-map.json').read_text())['sourceToCanonical']
assert all(mapping.get(str(i), i) == i for i in range(1, 67))
assert mapping['67'] == 74 and mapping['69'] == 67 and mapping['79'] == 84
assert 76 not in [mapping[str(i)] for i in range(67, 82)]
source = json.loads((APP / 'src/assets/cyberjudah/offline-catalog.json').read_text())['resources']
raw_kjv = source['bible:KJV']
with zipfile.ZipFile(APP / 'public/offline' / raw_kjv['file']) as archive:
    original = json.loads(archive.read(raw_kjv['entry']))
converted = json.loads(payloads['bible:KJV'])
assert converted['verses'] == {str(mapping.get(book, int(book))): chapters for book, chapters in original['verses'].items()}, 'KJV text changed beyond book identity'

raw_strong = source['bible-strong:KJV']
with zipfile.ZipFile(APP / 'public/offline' / raw_strong['file']) as archive:
    original_bytes = archive.read(raw_strong['entry'])
old = sqlite3.connect(':memory:')
old.deserialize(original_bytes)
new = sqlite3.connect(':memory:')
new.deserialize(payloads['bible-strong:KJV'])
columns = [row[1] for row in old.execute('PRAGMA table_info(Verses)')]
book_index = columns.index('bookOrder')
expected = []
for row in old.execute('SELECT * FROM Verses ORDER BY id'):
    row = list(row)
    row[book_index] = mapping.get(str(row[book_index]), row[book_index])
    expected.append(tuple(row))
assert expected == new.execute('SELECT * FROM Verses ORDER BY id').fetchall(), 'Strong verse/word identity changed'
for table in ['Words', 'WordTokens', 'WordStrongRefs']:
    if old.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
        assert old.execute('SELECT * FROM ' + table).fetchall() == new.execute('SELECT * FROM ' + table).fetchall(), table
print(json.dumps({'resources': len(payloads), 'zipAndContentIntegrity': 'pass', 'sqliteIntegrity': 'pass', 'stableBookIds': 'pass', 'kjvTextAndStrongWordIdentity': 'pass'}))

# Loopback-only fixture for simulator acceptance: downloads succeed, every dynamic route is 503.
if '--serve' in __import__('sys').argv:
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import urlsplit, unquote

    class OfflineFixture(BaseHTTPRequestHandler):
        def do_HEAD(self):
            self.respond(False)

        def do_GET(self):
            self.respond(True)

        def respond(self, body):
            path = unquote(urlsplit(self.path).path)
            if path == '/v1/offline-catalog':
                data = json.dumps(catalog).encode()
            elif path.startswith('/v1/offline-artifacts/'):
                file = path.removeprefix('/v1/offline-artifacts/')
                record = next((r for r in catalog['resources'].values() if r['file'] == file), None)
                if record is None:
                    self.send_error(404)
                    return
                folder = next(folder for folder in (APP / 'public/offline', APP / 'public/offline-artifacts') if (folder / file).is_file())
                data = (folder / file).read_bytes()
            else:
                self.send_error(503, 'Dynamic resource API unavailable')
                return
            start, end = 0, len(data) - 1
            range_header = self.headers.get('Range')
            if range_header:
                import re
                match = re.fullmatch(r'bytes=(\d+)-(\d*)', range_header)
                if not match or int(match[1]) >= len(data):
                    self.send_error(416)
                    return
                start = int(match[1])
                end = min(int(match[2]) if match[2] else end, end)
            self.send_response(206 if range_header else 200)
            self.send_header('Content-Type', 'application/json' if path.endswith('catalog') else 'application/zip')
            self.send_header('Content-Length', str(end - start + 1))
            self.send_header('Accept-Ranges', 'bytes')
            if range_header:
                self.send_header('Content-Range', f'bytes {start}-{end}/{len(data)}')
            self.end_headers()
            if body:
                self.wfile.write(data[start:end + 1])

    print('Simulator fixture: http://127.0.0.1:8767 (dynamic routes return 503)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8767), OfflineFixture).serve_forever()
