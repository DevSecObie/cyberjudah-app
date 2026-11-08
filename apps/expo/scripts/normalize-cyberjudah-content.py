#!/usr/bin/env python3
"""Package owned resources with upstream stable book identities, without changing text or word IDs."""
import copy
import hashlib
import io
import json
import sqlite3
import zipfile
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
REPO = APP.parent.parent
MAPPING_PATH = APP / 'src/assets/cyberjudah/canonical-book-map.json'
MAPPING = json.loads(MAPPING_PATH.read_text())
BOOK_IDS = {int(k): v for k, v in MAPPING['sourceToCanonical'].items()}
SOURCE_PATH = APP / 'src/assets/cyberjudah/offline-catalog.json'
CATALOG_PATH = REPO / 'packages/resource-catalog/src/mobile-resource-catalog.json'


def digest(value):
    return hashlib.sha256(value).hexdigest()


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def canonical_book(number):
    return BOOK_IDS.get(number, number)


def normalize_coordinates(value):
    if isinstance(value, list):
        return [normalize_coordinates(item) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        key: canonical_book(item) if key in ('book', 'bookOrder', 'Livre') and isinstance(item, int)
        else normalize_coordinates(item)
        for key, item in value.items()
    }


def archive_bytes(entry_name, content):
    result = io.BytesIO()
    with zipfile.ZipFile(result, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        info = zipfile.ZipInfo(entry_name, (2026, 11, 7, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, content)
    return result.getvalue()


def package():
    source = json.loads(SOURCE_PATH.read_text())
    catalog = json.loads(CATALOG_PATH.read_text())
    text_identity = None
    kjv = source['resources'].get('bible:KJV')
    if kjv:
        with zipfile.ZipFile(APP / 'public/offline' / kjv['file']) as archive:
            original = json.loads(archive.read(kjv['entry']))
        verses = {str(canonical_book(int(book))): chapters for book, chapters in original['verses'].items()}
        text_hash = digest(encode(verses))
        text_identity = ('kjv-canonical-' + text_hash[:20], text_hash)

    for resource_id, raw in source['resources'].items():
        entry = copy.deepcopy(raw)
        source_file = APP / 'public/offline' / raw['file']
        raw_archive = source_file.read_bytes()
        if digest(raw_archive) != raw['archiveSha256']:
            raise ValueError('SOURCE_ARCHIVE_CHECKSUM_MISMATCH:' + resource_id)
        with zipfile.ZipFile(io.BytesIO(raw_archive)) as archive:
            content = archive.read(raw['entry'])
            regular_member = (archive.getinfo(raw['entry']).external_attr >> 16) & 0o170000 == 0o100000
        if digest(content) != raw['entries']['canonical']['sha256']:
            raise ValueError('SOURCE_CONTENT_CHECKSUM_MISMATCH:' + resource_id)
        changed = False
        if resource_id == 'bible:KJV':
            payload = json.loads(content)
            payload['verses'] = {str(canonical_book(int(book))): chapters for book, chapters in payload['verses'].items()}
            payload['textRevision'], payload['textSha256'] = text_identity
            content = encode(payload)
            entry['textRevision'], entry['textSha256'] = text_identity
            changed = True
        elif resource_id == 'bible-strong:KJV':
            database = sqlite3.connect(':memory:')
            database.deserialize(content)
            # Offset first so unique book/chapter/verse indexes cannot collide during the move.
            database.execute('UPDATE Verses SET bookOrder=bookOrder+1000 WHERE bookOrder>66')
            for source_book, canonical in BOOK_IDS.items():
                database.execute('UPDATE Verses SET bookOrder=? WHERE bookOrder=?', (canonical, source_book + 1000))
            for key, value in zip(('textRevision', 'textSha256'), text_identity):
                database.execute('INSERT OR REPLACE INTO ResourceMetadata(key,value) VALUES (?,?)', (key, value))
            database.commit()
            if database.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('NORMALIZED_DATABASE_INVALID:' + resource_id)
            content = database.serialize()
            database.close()
            entry['textRevision'], entry['textSha256'] = text_identity
            changed = True
        elif resource_id.startswith('database:TIMELINE:'):
            payload = json.loads(content)
            normalized = normalize_coordinates(payload)
            if normalized != payload:
                content = encode(normalized)
                changed = True
        relative_file = catalog['resources'].get(resource_id, {}).get('file', raw['file'])
        packed = archive_bytes(raw['entry'], content) if changed or not regular_member else raw_archive
        entry.update(
            file=relative_file,
            url='https://api.cyberjudah.io/v1/offline-artifacts/' + relative_file + '?sha256=' + digest(packed),
            archiveSha256=digest(packed), archiveBytes=len(packed),
            contentSha256=digest(content), contentBytes=len(content),
            installedBytes=len(content) * (2 if entry['strategy'] == 'sqlite-import' else 1),
            peakInstallationBytes=len(content) * 3 + len(packed),
        )
        entry['entries']['canonical'].update(sha256=digest(content), bytes=len(content))
        entry.pop('encryptedArchive', None)
        destination = APP / 'public/offline' / relative_file
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(packed)
        catalog['resources'][resource_id] = entry
    # Rebuild-agent records are authoritative for generated files and integrity metadata.
    free_entries = json.loads((APP / 'scripts/data/free-bible-catalog-entries.json').read_text())
    for resource_id, raw in free_entries.items():
        if (APP / 'public/offline' / raw['file']).is_file():
            catalog['resources'][resource_id] = {**raw, 'url': 'https://api.cyberjudah.io/v1/offline-artifacts/' + raw['file']}
    dictionary_sidecar = APP / 'scripts/data/free-dictionary-catalog-entries.json'
    if dictionary_sidecar.is_file():
        for resource_id, raw in json.loads(dictionary_sidecar.read_text())['resources'].items():
            entry = {key: value for key, value in raw.items() if key not in ('works', 'entryCount')}
            entry['url'] = 'https://api.cyberjudah.io/v1/offline-artifacts/' + entry['file']
            catalog['resources'][resource_id] = entry
    commentary = json.loads((APP / 'scripts/data/cyberjudah-commentary-download.json').read_text())
    catalog['resources'][commentary['id']] = {**commentary, 'url': 'https://api.cyberjudah.io/v1/offline-artifacts/' + commentary['file']}
    excluded = json.loads((APP / 'src/assets/cyberjudah/excluded-upstream-resources.json').read_text())
    for resource_id in excluded:
        catalog['resources'].pop(resource_id, None)
    # Release only artifacts that actually exist. A filename alone is not proof of matching content.
    for resource_id, entry in list(catalog['resources'].items()):
        candidates = [APP / 'public/offline' / entry['file'], APP / 'public/offline-artifacts' / entry['file']]
        artifact = next((path for path in candidates if path.is_file()), None)
        if artifact is None:
            del catalog['resources'][resource_id]
            continue
        data = artifact.read_bytes()
        if digest(data) != entry['archiveSha256'] or len(data) != entry['archiveBytes']:
            raise ValueError('RELEASE_ARCHIVE_CHECKSUM_MISMATCH:' + resource_id)
        entry['url'] = 'https://api.cyberjudah.io/v1/offline-artifacts/' + entry['file'] + ('?sha256=' + entry['archiveSha256'] if resource_id == 'database:NAVE:en' else '')
    catalog['resourceCount'] = len(catalog['resources'])
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    (APP / 'public/offline/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'ownedResources': len(source['resources']), 'totalResources': catalog['resourceCount'], 'bookMapVersion': MAPPING['version']}))


if __name__ == '__main__':
    package()
