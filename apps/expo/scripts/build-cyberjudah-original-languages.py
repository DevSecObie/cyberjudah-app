#!/usr/bin/env python3
"""Build the CyberJudah "Original languages" Bible (BHG) and its English word index.

The Hebrew Old Testament is the Westminster Leningrad Codex (public domain) with the word tags
(lemmas and morphology) of the Open Scriptures Hebrew Bible (CC BY 4.0). Its verses are placed on
the King James verse numbers with that project's own WLC-to-KJV verse map.

The Greek New Testament is F. H. A. Scrivener's 1894 Textus Receptus (public domain), the Greek
text behind the King James New Testament. Its words take the Strong's numbers and morphology of
Maurice A. Robinson's parsed Textus Receptus (public domain), matched word by word.

The English word gloss under each word is the King James rendering of that Strong's number most
often found in CyberJudah's KJV Strong's tags; the transliteration and lemma come from the same
Strong's dictionaries the app already ships.

    python3 scripts/build-cyberjudah-original-languages.py \
      <openscriptures/morphhb> <byztxt/greektext-scrivener> <byztxt/greektext-textus-receptus> \
      <cyberjudah/data/strongs>

Writes public/offline/BHG.json.zip and public/offline/databases/bible-bhg-interlinear-en.sqlite.zip
and lists both in the offline catalogs.
"""
import hashlib
import json
import re
import sqlite3
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
MORPHHB, SCRIVENER, ROBINSON, STRONGS = (Path(p) for p in sys.argv[1:5])
OFFLINE = APP / 'public/offline'
CATALOG_PATHS = [APP / 'src/assets/cyberjudah/offline-catalog.json', OFFLINE / 'catalog.json']
URL = 'https://api.cyberjudah.io/v1/offline-artifacts/'
DATASET = 'CYBERJUDAH'
ZIP_DATE = (2026, 11, 4, 0, 0, 0)

OT = ('Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov '
      'Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal').split()
NT = 'MT MR LU JOH AC RO 1CO 2CO GA EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JO 2JO 3JO JUDE RE'.split()
OSIS = '{http://www.bibletechnologies.net/2003/OSIS/namespace}'

sha = lambda data: hashlib.sha256(data).hexdigest()
strongs = {
    **json.loads((STRONGS / 'hebrew.json').read_text()),
    **json.loads((STRONGS / 'greek.json').read_text()),
}


# --- English glosses: the KJV's own most frequent rendering of each Strong's number -----------
SMALL = set('''a an and as at be but by for from he her him his i in is it its me my no not o of on or our
shall she so that the their them they this thou thy to unto upon us was we were which who will with ye you'''.split())
# Words the KJV does not translate, or translates with whatever the sentence needs.
FIXED = {'H853': '', 'G3588': 'the', 'H3068': 'LORD'}


def short_meaning(code):
    """The first words of the dictionary meaning, for a number the KJV tags rarely show."""
    text = re.sub(r'\([^)]*\)|\[[^\]]*\]', '', (strongs.get(code) or {}).get('def', ''))
    pieces = [re.sub(r'^(?:properly|literally|figuratively|specifically|usually|i\.e\.)\b\s*', '', piece.strip())
              for piece in re.split(r'[;,:]', text)]
    text = next((piece for piece in pieces if piece), '')
    return re.sub(r'^(?:to|a|an|the)\s+', '', text.strip()).strip(' .')[:24]


# A word capitalized only because it starts a verse.
VERBS_AT_START = {'then', 'now', 'behold', 'therefore', 'when', 'if', 'neither', 'nor', 'yea', 'also', 'thus', 'let'}


def kjv_renderings(code):
    """The KJV renderings Strong's dictionary lists for a number, as plain words."""
    text = re.sub(r'\[[^\]]*\]|\([^)]*\)|[+]', '', (strongs.get(code) or {}).get('kjv', ''))
    out = []
    for item in re.split(r'[,;.]', text):
        item = re.sub(r'\s+', ' ', item).strip()
        if item and re.fullmatch(r"[A-Za-z' -]+", item) and item not in out:
            out.append(item)
    return out


def kjv_glosses():
    """The rendering the KJV gives each Strong's number: the phrase its KJV tags most often show,
    when the dictionary's own list of KJV renderings has that word; else the listed rendering the
    tagged verses use most; else the first listed rendering; else the dictionary's first meaning."""
    counts, words_seen, cased = defaultdict(Counter), defaultdict(Counter), defaultdict(Counter)
    for path in sorted((STRONGS / 'tags').glob('*.json')):
        for verses in json.loads(path.read_text()).values():
            for phrases in verses.values():
                for phrase, codes in phrases:
                    original = re.sub(r"[^\w'\- ]", '', phrase).split()
                    words = [w.lower() for w in original]
                    for raw in codes:
                        words_seen[re.sub(r'^([HG])0*', r'\1', raw)].update(words)
                    if len(codes) != 1:
                        continue
                    code = re.sub(r'^([HG])0*', r'\1', codes[0])
                    while len(words) > 1 and words[0] in SMALL:
                        words, original = words[1:], original[1:]
                    if words:
                        counts[code][' '.join(words[:3])] += 1
                        cased[' '.join(words[:3])][' '.join(original[:3])] += 1
    glosses = {}
    for code in strongs:
        listed = kjv_renderings(code)
        renderings = set(re.findall(r'[a-z]+', (strongs[code].get('kjv') or '').lower()))
        ranked = [(phrase, n) for phrase, n in counts[code].most_common()
                  if not renderings or all(w in renderings or w in SMALL for w in phrase.split())]
        total = sum(counts[code].values())
        seen = lambda item: min(words_seen[code][w] for w in item.lower().split())
        scored = sorted(listed, key=lambda item: -seen(item))
        if ranked and ranked[0][1] * 5 >= total:
            # As the KJV prints it: "God", "LORD", "Israel".
            glosses[code] = cased[ranked[0][0]].most_common(1)[0][0]
            if glosses[code].isupper() and glosses[code] not in ('LORD', 'GOD'):
                glosses[code] = glosses[code].lower()
            elif glosses[code][:1].isupper() and glosses[code].lower().split()[0] in SMALL | VERBS_AT_START:
                glosses[code] = glosses[code][0].lower() + glosses[code][1:]
        elif scored and seen(scored[0]):
            glosses[code] = scored[0]
        else:
            glosses[code] = listed[0] if listed else short_meaning(code)
    glosses.update(FIXED)
    return glosses


GLOSS = kjv_glosses()


def entry(code):
    return strongs.get(code) or {}


# --- Hebrew -------------------------------------------------------------------------------------
PREFIX_GLOSS = {'b': 'in', 'c': 'and', 'd': 'the', 'k': 'like', 'l': 'to', 'm': 'from', 's': 'that', 'i': '?'}
PREFIX_XLIT = {'b': 'b', 'c': 'v', 'd': 'ha', 'k': 'k', 'l': 'l', 'm': 'm', 's': 'she', 'i': 'ha'}
SUFFIX_GLOSS = {
    '1cs': 'me', '1cp': 'us', '2ms': 'you', '2fs': 'you', '2mp': 'you', '2fp': 'you', '2cp': 'you',
    '3ms': 'him', '3fs': 'her', '3mp': 'them', '3fp': 'them', '3cp': 'them',
}


def hebrew_segments(surface_parts, lemma_attr, morph_attr):
    """One segment per morpheme: prefixes, the word itself, and a pronoun suffix."""
    language, morph = (morph_attr[0], morph_attr[1:]) if morph_attr else ('H', '')
    morphs = morph.split('/') if morph else []
    lemmas = [part.strip() for part in lemma_attr.split('/')] if lemma_attr else []
    segments, lemma_index, offset = [], 0, 0
    for index, text in enumerate(surface_parts):
        part = morphs[index] if index < len(morphs) else ''
        is_suffix = part.startswith('S')
        lemma = '' if is_suffix else (lemmas[lemma_index] if lemma_index < len(lemmas) else '')
        if not is_suffix:
            lemma_index += 1
        number = re.match(r'\d+', lemma)
        code = f'H{int(number.group())}' if number else None
        data = entry(code) if code else {}
        if code:
            gloss, xlit, lemma_text = GLOSS.get(code, ''), data.get('xlit', ''), data.get('lemma', '')
        elif is_suffix:
            gloss = SUFFIX_GLOSS.get(part[2:5], '') if part[1:2] == 'p' else ''
            xlit, lemma_text = '', ''
        else:
            gloss, xlit, lemma_text = PREFIX_GLOSS.get(lemma, ''), PREFIX_XLIT.get(lemma, ''), ''
        segments.append({
            'startOffset': offset, 'length': len(text), 'transliteration': xlit, 'lemma': lemma_text,
            'morphology': f'{language}{part}' if part else '', 'gloss': gloss,
            'code': code if code and code in strongs else None,
        })
        offset += len(text)
    return segments


def hebrew_verses():
    """WLC verses, by their own reference, as (text, tokens)."""
    out = {}
    for book, osis in enumerate(OT, start=1):
        root = ET.parse(MORPHHB / 'wlc' / f'{osis}.xml').getroot()
        for verse in root.iter(f'{OSIS}verse'):
            text, tokens, joined = '', [], True
            for child in verse:
                tag = child.tag.replace(OSIS, '')
                if tag == 'w':
                    raw = ''.join(child.itertext())
                    parts = raw.split('/')
                    word = ''.join(parts)
                    if not joined:
                        text += ' '
                    tokens.append({
                        'startOffset': len(text), 'length': len(word),
                        'segments': hebrew_segments(parts, child.get('lemma', ''), child.get('morph', '')),
                    })
                    text += word
                    joined = False
                elif tag == 'seg':
                    mark = ''.join(child.itertext())
                    kind = child.get('type', '')
                    if kind == 'x-maqqef':
                        text += mark
                        joined = True
                    elif kind == 'x-sof-pasuq':
                        text += mark
                    elif mark.strip():
                        text += ' ' + mark.strip()
            ref = verse.get('osisID')
            out[ref] = (book, text, tokens)
    return out


def kjv_hebrew(wlc):
    """Places every WLC verse on the KJV verse that holds it."""
    mapping, partial = {}, {}
    for verse in ET.parse(MORPHHB / 'wlc' / 'VerseMap.xml').getroot().iter():
        if verse.get('wlc'):
            mapping[verse.get('wlc')] = verse.get('kjv')
    pieces = defaultdict(list)  # kjv ref -> [(order, book, text, tokens)]
    for order, (ref, (book, text, tokens)) in enumerate(wlc.items()):
        targets = []
        if f'{ref}!a' in mapping or f'{ref}!b' in mapping:
            # A WLC verse split between two KJV verses: the split falls at its atnach.
            first = mapping.get(f'{ref}!a')
            second = mapping.get(f'{ref}!b')
            cut = text.find('֑')
            cut = text.find(' ', cut) if cut >= 0 else -1
            if cut < 0:
                cut = len(text) // 2
            left = [t for t in tokens if t['startOffset'] < cut]
            right = [t for t in tokens if t['startOffset'] >= cut]
            base = ref.rsplit('.', 1)[0]
            first = first or ref
            second = second or ref
            targets.append((first, text[:cut], left))
            shift = cut + 1
            targets.append((second, text[shift:], [{**t, 'startOffset': t['startOffset'] - shift} for t in right]))
        else:
            targets.append((mapping.get(ref, ref), text, tokens))
        for target, piece, piece_tokens in targets:
            pieces[target.split('!')[0]].append((order, book, piece, piece_tokens))
    verses = {}
    for ref, parts in pieces.items():
        _, chapter, verse = ref.split('.')
        text, tokens = '', []
        for _, book, piece, piece_tokens in sorted(parts, key=lambda p: p[0]):
            if text:
                text += ' '
            tokens += [{**t, 'startOffset': t['startOffset'] + len(text)} for t in piece_tokens]
            text += piece.strip()
        verses[(book, int(chapter), int(verse))] = (text, tokens)
    return verses


# --- Greek --------------------------------------------------------------------------------------
BETA = dict(zip('abgdezhyiklmnxoprstufcqw', 'αβγδεζηθικλμνξοπρστυφχψω'))
BETA['v'] = 'ς'
BETA['j'] = 'ς'
XLIT = {
    'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'ē', 'θ': 'th', 'ι': 'i', 'κ': 'k',
    'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't',
    'υ': 'u', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps', 'ω': 'ō',
}


def greek(word):
    letters = [BETA.get(ch, '') for ch in word.lower()]
    text = ''.join(letters)
    return text[:-1] + 'ς' if text.endswith('σ') else text


def greek_xlit(word):
    out = ''
    for i, ch in enumerate(word):
        if ch == 'γ' and i + 1 < len(word) and word[i + 1] in 'γκξχ':
            out += 'n'
        elif ch == 'υ' and out[-1:] in ('a', 'e', 'ē', 'o'):
            out += 'u'
        else:
            out += XLIT.get(ch, '')
    return out


def scrivener_book(path):
    text = re.sub(r'\[[^\]]*\]', ' ', path.read_text(encoding='latin-1'))
    verses, current = {}, None
    for token in text.split():
        match = re.fullmatch(r'(\d+):(\d+)', token)
        if match:
            current = (int(match.group(1)), int(match.group(2)))
            verses.setdefault(current, [])
        elif current and re.fullmatch(r'[a-zA-Z]+', token):
            verses[current].append(token.lower())
    return verses


def robinson_book(path):
    """Each verse's words with the tags that follow them; both readings of a '| a | b |' group."""
    text = path.read_text(encoding='latin-1')
    verses, current, words, pending = {}, None, [], []
    tokens = text.split()
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if re.fullmatch(r'\d+:\d+', token):
            chapter, verse = map(int, token.split(':'))
            current = (chapter, verse)
            verses.setdefault(current, [])
            i += 1
            continue
        if re.fullmatch(r'\(\d+:\d+\)', token) or token in ('|', '[', ']') or not current:
            i += 1
            continue
        if re.fullmatch(r'\d+', token):
            numbers = []
            while i < len(tokens) and re.fullmatch(r'\d+', tokens[i]):
                numbers.append(int(tokens[i]))
                i += 1
            morph = ''
            if i < len(tokens) and tokens[i].startswith('{'):
                morph = tokens[i].strip('{}')
                i += 1
            codes = [f'G{n}' for n in numbers if n <= 5624]
            for word in pending:
                verses[word[0]].append((word[1], codes[:1], morph))
            pending = []
            continue
        word = re.sub(r'[^a-z]', '', token.strip('[]').lower())
        if word:
            pending.append((current, word))
        i += 1
    return verses


def norm_robinson(word):
    # Robinson writes theta as q and psi as y; Scrivener the other way round.
    return word.translate(str.maketrans('qy', 'yq'))


def greek_verses():
    verses = {}
    unmatched = 0
    for index, name in enumerate(NT):
        book = 40 + index
        scrivener = scrivener_book(SCRIVENER / 'textonly' / f'{name}.SCV')
        robinson = robinson_book(ROBINSON / 'parsed' / f'{name}.UTR')
        for (chapter, verse), words in scrivener.items():
            tagged = [(norm_robinson(w), codes, morph) for w, codes, morph in robinson.get((chapter, verse), [])]
            pointer, text, tokens = 0, '', []
            for word in words:
                found = next((j for j in range(pointer, min(pointer + 6, len(tagged))) if tagged[j][0] == word), None)
                if found is None:
                    found = next((j for j, t in enumerate(tagged) if t[0] == word), None)
                else:
                    pointer = found + 1
                codes, morph = (tagged[found][1], tagged[found][2]) if found is not None else ([], '')
                if found is None:
                    unmatched += 1
                surface = greek(word)
                if text:
                    text += ' '
                code = codes[0] if codes and codes[0] in strongs else None
                data = entry(code) if code else {}
                tokens.append({
                    'startOffset': len(text), 'length': len(surface),
                    'segments': [{
                        'startOffset': 0, 'length': len(surface), 'transliteration': greek_xlit(surface),
                        'lemma': data.get('lemma', ''), 'morphology': morph,
                        'gloss': GLOSS.get(code, '') if code else '', 'code': code,
                    }],
                })
                text += surface
            verses[(book, chapter, verse)] = (text, tokens)
    print(f'greek words without tags: {unmatched}', file=sys.stderr)
    return verses


# --- Output -------------------------------------------------------------------------------------
def write_zip(path, name, data):
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        info = zipfile.ZipInfo(name, ZIP_DATE)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16  # a regular file, as the app's archive check requires
        archive.writestr(info, data)
    return path.read_bytes()


def main():
    verses = {**kjv_hebrew(hebrew_verses()), **greek_verses()}
    keys = sorted(verses)

    nested = {}
    for book, chapter, verse in keys:
        text = verses[(book, chapter, verse)][0]
        nested.setdefault(str(book), {}).setdefault(str(chapter), {})[str(verse)] = {
            'text': text, 'startTags': [], 'layout': [], 'notes': [], 'headings': [],
        }
    text_sha = sha(json.dumps(nested, ensure_ascii=False, separators=(',', ':')).encode())
    bible = {
        'format': 'bible-strong-canonical-bible', 'schemaVersion': 4, 'applicationVersionId': 'BHG',
        'datasetId': DATASET, 'sourceVersion': 'WLC 4.20 (Open Scriptures) / Scrivener 1894',
        'textRevision': text_sha, 'textSha256': text_sha, 'sourceSha256': text_sha,
        'verseCount': len(keys), 'verses': nested,
    }
    bible_bytes = (json.dumps(bible, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    bible_zip = write_zip(OFFLINE / 'BHG.json.zip', 'BHG.json', bible_bytes)

    database_path = OFFLINE / 'databases' / 'bible-bhg-interlinear-en.sqlite'
    database_path.unlink(missing_ok=True)
    db = sqlite3.connect(database_path)
    db.executescript('''
      PRAGMA journal_mode=DELETE;
      CREATE TABLE ResourceMetadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
      CREATE TABLE Verses (id INTEGER PRIMARY KEY, bookOrder INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL);
      CREATE UNIQUE INDEX idx_Verses_reference ON Verses(bookOrder, chapter, verse);
      CREATE TABLE Tokens (id INTEGER PRIMARY KEY, verseId INTEGER NOT NULL, readingOrdinal INTEGER NOT NULL,
        startOffset INTEGER NOT NULL, length INTEGER NOT NULL);
      CREATE INDEX idx_Tokens_verse ON Tokens(verseId, readingOrdinal);
      CREATE TABLE Segments (tokenId INTEGER NOT NULL, ordinal INTEGER NOT NULL, startOffset INTEGER NOT NULL,
        length INTEGER NOT NULL, transliterationId INTEGER NOT NULL, lemmaId INTEGER NOT NULL,
        morphologyId INTEGER NOT NULL, glossId INTEGER NOT NULL, strongCodeId INTEGER, eStrongCodeId INTEGER,
        dStrongCodeId INTEGER, uStrongCodeId INTEGER, PRIMARY KEY(tokenId, ordinal)) WITHOUT ROWID;
      CREATE TABLE Transliterations (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE);
      CREATE TABLE Lemmas (id INTEGER PRIMARY KEY, value TEXT NOT NULL UNIQUE);
      CREATE TABLE Morphologies (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE);
      CREATE TABLE Glosses (id INTEGER PRIMARY KEY, text TEXT NOT NULL UNIQUE);
      CREATE TABLE StrongCodes (id INTEGER PRIMARY KEY, code TEXT NOT NULL);
      CREATE UNIQUE INDEX idx_StrongCodes_code ON StrongCodes(code);
      CREATE TABLE StrongVerseIndex (codeId INTEGER NOT NULL, verseId INTEGER NOT NULL, kindMask INTEGER NOT NULL,
        PRIMARY KEY(codeId, verseId)) WITHOUT ROWID;
      BEGIN;
    ''')
    tables = {name: {} for name in ('Transliterations', 'Lemmas', 'Morphologies', 'Glosses', 'StrongCodes')}
    column = {'Transliterations': 'value', 'Lemmas': 'value', 'Morphologies': 'code', 'Glosses': 'text', 'StrongCodes': 'code'}

    def intern(table, value):
        ids = tables[table]
        if value not in ids:
            ids[value] = len(ids) + 1
            db.execute(f'INSERT INTO {table} (id, {column[table]}) VALUES (?, ?)', (ids[value], value))
        return ids[value]

    token_id, token_count = 0, 0
    for verse_id, key in enumerate(keys, start=1):
        text, tokens = verses[key]
        db.execute('INSERT INTO Verses VALUES (?, ?, ?, ?)', (verse_id, *key))
        codes = set()
        for ordinal, token in enumerate(tokens):
            assert text[token['startOffset']:token['startOffset'] + token['length']], (key, token)
            token_id += 1
            db.execute('INSERT INTO Tokens VALUES (?, ?, ?, ?, ?)',
                       (token_id, verse_id, ordinal, token['startOffset'], token['length']))
            for segment_ordinal, segment in enumerate(token['segments']):
                code_id = intern('StrongCodes', segment['code']) if segment['code'] else None
                if code_id:
                    codes.add(code_id)
                db.execute('INSERT INTO Segments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)', (
                    token_id, segment_ordinal, segment['startOffset'], segment['length'],
                    intern('Transliterations', segment['transliteration']), intern('Lemmas', segment['lemma']),
                    intern('Morphologies', segment['morphology']), intern('Glosses', segment['gloss']), code_id,
                ))
        token_count += len(tokens)
        for code_id in codes:
            db.execute('INSERT INTO StrongVerseIndex VALUES (?, ?, 1)', (code_id, verse_id))
    for key, value in {
        'schemaVersion': '5', 'datasetId': DATASET, 'locale': 'en',
        'textRevision': text_sha, 'textSha256': text_sha,
    }.items():
        db.execute('INSERT INTO ResourceMetadata VALUES (?, ?)', (key, value))
    db.commit()
    db.execute('ANALYZE')
    db.execute('VACUUM')
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    db.close()
    index_bytes = database_path.read_bytes()
    index_zip = write_zip(database_path.with_name(database_path.name + '.zip'), database_path.name, index_bytes)
    database_path.unlink()

    def resource(id, file, name, data, archive, strategy, installed):
        return {
            'id': id, 'url': f'{URL}{file}?sha256={sha(archive)}', 'file': file, 'entry': name,
            'entries': {'canonical': {'entry': name, 'sha256': sha(data), 'bytes': len(data)}},
            'archiveSha256': sha(archive), 'archiveBytes': len(archive), 'contentSha256': sha(data),
            'contentBytes': len(data), 'installedBytes': installed,
            'peakInstallationBytes': len(data) * 2 + len(archive), 'strategy': strategy,
            'textRevision': text_sha, 'textSha256': text_sha,
        }

    for catalog_path in CATALOG_PATHS:
        catalog = json.loads(catalog_path.read_text())
        catalog['resources']['bible:BHG'] = resource(
            'bible:BHG', 'BHG.json.zip', 'BHG.json', bible_bytes, bible_zip, 'sqlite-import', len(bible_bytes) * 2)
        catalog['resources']['bible-interlinear:BHG:en'] = resource(
            'bible-interlinear:BHG:en', 'databases/bible-bhg-interlinear-en.sqlite.zip',
            'bible-bhg-interlinear-en.sqlite', index_bytes, index_zip, 'archive-extract', len(index_bytes))
        catalog['resourceCount'] = len(catalog['resources'])
        pretty = catalog_path.parent.name != 'offline'
        catalog_path.write_text(json.dumps(catalog, indent=2 if pretty else None, ensure_ascii=False) + ('\n' if pretty else ''))

    print(json.dumps({
        'verses': len(keys), 'hebrewVerses': sum(1 for k in keys if k[0] <= 39), 'tokens': token_count,
        'textRevision': text_sha, 'bibleArchiveBytes': len(bible_zip), 'indexArchiveBytes': len(index_zip),
        'indexBytes': len(index_bytes),
    }))


main()

# Shared packaging adapter reads the one canonical-book-map.json.
import subprocess
subprocess.run([sys.executable, str(Path(__file__).with_name('normalize-cyberjudah-content.py'))], check=True)
