#!/usr/bin/env python3
"""Build the Jewish Encyclopedia (1901-1906) as one of the app's offline dictionaries.

  python3 scripts/jewish-encyclopedia/build.py <cyberjudah checkout> <output dictionnaire.sqlite>

The text is CyberJudah's own OCR of the twelve volumes (data/library/jewish-encyclopedia in
DevSecObie/cyberjudah, from the archive.org scans). headwords.tsv lists the articles in
printed order; it is used only to find where each article starts in that text. No article
text is taken from anywhere else, and nothing is written that the printed page does not say:
every article ends with its volume and page and a link to the printed page.

OCR repairs are limited to what the scans themselves settle: a word broken across a line is
joined only when the joined word is commoner in the twelve volumes, and a misread letter pair
(li for h, rn for m) is repaired only when the repaired word is far commoner there.
Scripture references in the Jewish Encyclopedia's style (Ex. xvii. 9) link to the KJV verse
when that verse exists in the KJV with the Apocrypha; any other reference stays plain text.
"""
import bisect
import collections
import html
import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

try:
    from rapidfuzz.fuzz import ratio
except ImportError:  # same Indel similarity as rapidfuzz, slower

    def ratio(a, b):
        if not a and not b:
            return 100.0
        prev = [0] * (len(b) + 1)
        for x in a:
            cur = [0]
            for j, y in enumerate(b):
                cur.append(prev[j] + 1 if x == y else max(prev[j + 1], cur[j]))
            prev = cur
        return 200.0 * prev[-1] / (len(a) + len(b))


HERE = Path(__file__).resolve().parent
TITLE = "The Jewish Encyclopedia (1901–1906)"


def load_corpus(library):
    """All pages in order, without the running head and the masthead line, with page offsets."""
    text, offsets, pos = [], [], 0
    for volume in range(1, 13):
        for page in json.loads((library / f"pages-v{volume}.json").read_text()):
            lines = page["text"].split("\n")
            if lines and page["page"] > 1:
                lines = lines[1:]
            lines = [l for l in lines if l.strip().upper() != "THE JEWISH ENCYCLOPEDIA"]
            chunk = "\n".join(lines).strip() + "\n\n"
            offsets.append((pos, volume, page["page"], page["img"]))
            text.append(chunk)
            pos += len(chunk)
    return "".join(text), offsets


def letters(value):
    return re.sub("[^A-Z]", "", unicodedata.normalize("NFKD", value).upper())


# Letters the OCR confuses in capitals, mapped to one class on both sides of a comparison.
CONFUSABLE = str.maketrans({"R": "B", "K": "E", "L": "I", "J": "I", "Y": "V", "C": "E", "G": "E", "O": "D", "Q": "D"})


def ocr_key(value):
    for a, b in (("TJ", "U"), ("XT", "U"), ("XJ", "U"), ("TT", "U"), ("IJ", "L"), ("II", "L"), ("IVI", "M"), ("VV", "W"), ("RN", "M"), ("IN", "M")):
        value = value.replace(a, b)
    return value.translate(CONFUSABLE)


def title_key(value):
    for a, b in (("TT", "U"), ("II", "L"), ("VV", "W"), ("RN", "M"), ("IN", "M")):
        value = value.replace(a, b)
    return value.translate(CONFUSABLE)


HEADING = re.compile(r"([^\n:]{1,120}?)(?:\s?:|\.\s?(?=See\b)|\s?\.?\s?—|\.\s*\n)")
CAPITAL_RUN = re.compile(r"(?:(?:[A-Z][A-Z'’]*-?\s?|\(|\)|\[|\]|=|,|\.|\s|\d)+)")
SIGNATURE = re.compile(r"(?:[A-Z][a-z]{0,2}\.,?\s+)+(?=[A-Z'‘’])")


def candidates(s):
    """Places an article heading may start: capitals after a paragraph or sentence end."""
    found = {}

    def add(p):
        if p in found or SIGNATURE.match(s, p):  # a contributor's initials end the article before
            return
        m = HEADING.match(s[p : p + 160])
        head = m.group(1) if m else ""
        alpha = [c for c in head if c.isalpha()]
        if head and len(alpha) >= 3 and sum(c.isupper() for c in alpha) / len(alpha) >= 0.6:
            found[p] = ocr_key(letters(head))
            return
        r = CAPITAL_RUN.match(s, p)
        run = re.sub(r"\s+[A-Z]$", "", (r.group(0) if r else "").rstrip())
        if len(letters(run)) >= 3:
            found[p] = ocr_key(letters(run))

    for m in re.finditer(r"(?:^|(?<=\n)|(?<=[.:;!?\"”)] ))([A-Z][A-Z.'’])", s):
        add(m.start(1))
    for m in re.finditer(r"(?:^|\n)(?:[A-Z]\. ){0,4}(['‘’]?[A-Za-z][^\n]{1,60}?\s?:)", s):
        add(m.start(1))
    return sorted(found.items())


def align(headwords, cand):
    """Each headword's position in the text, in printed order; None where the scan has no match."""
    keys = [title_key(letters(h)) for _, h in headwords]

    def score(i, j):
        t, c = keys[i], cand[j][1]
        if not t:
            return 0
        best = ratio(t, c)
        if len(c) > len(t) + 2:
            best = max(best, ratio(t, c[: len(t)]) - 12)
        return best

    window, ahead = 300, 6
    anchor = [None] * len(headwords)
    j0 = 0
    # Confident matches first. A match is refused when one of the next headwords matches earlier.
    for i in range(len(headwords)):
        hit = next((j for j in range(j0, min(len(cand), j0 + window)) if score(i, j) >= 92), None)
        if hit is None:
            continue
        if any(score(k, jj) >= 95 for k in range(i + 1, min(len(headwords), i + 1 + ahead)) for jj in range(j0, hit)):
            continue
        anchor[i], j0 = hit, hit + 1

    def fill(i0, i1, j0, j1, threshold):
        n, m = i1 - i0, j1 - j0
        if n <= 0 or m <= 0 or n * m > 400_000:
            return
        dp = [[0.0] * (m + 1) for _ in range(n + 1)]
        back = [[0] * (m + 1) for _ in range(n + 1)]
        for a in range(1, n + 1):
            for b in range(1, m + 1):
                best, how = dp[a - 1][b], 1
                if dp[a][b - 1] > best:
                    best, how = dp[a][b - 1], 2
                sc = score(i0 + a - 1, j0 + b - 1)
                if sc >= threshold and dp[a - 1][b - 1] + sc > best:
                    best, how = dp[a - 1][b - 1] + sc, 3
                dp[a][b], back[a][b] = best, how
        a, b = n, m
        while a and b:
            if back[a][b] == 3:
                anchor[i0 + a - 1] = j0 + b - 1
                a, b = a - 1, b - 1
            elif back[a][b] == 1:
                a -= 1
            else:
                b -= 1

    # Then the gaps between confident matches, in order, at a looser threshold.
    for threshold in (80, 70):
        prev_i, prev_j = -1, -1
        for i in range(len(headwords) + 1):
            if i == len(headwords) or anchor[i] is not None:
                next_j = anchor[i] if i < len(headwords) else min(len(cand), prev_j + 1 + window)
                if i - prev_i > 1:
                    fill(prev_i + 1, i, prev_j + 1, next_j, threshold)
                prev_i, prev_j = i, next_j
    return [cand[a][0] if a is not None else None for a in anchor]


SMALL = {"a", "an", "and", "in", "of", "or", "the", "to", "ben", "b.", "bar", "de", "del", "della", "di", "da", "der", "van", "von", "ibn", "ha", "al", "el", "la", "le", "des", "du", "y", "zu"}
NOT_ROMAN = {"di", "da", "del", "la", "le", "lil", "mix", "dix", "vic", "civ", "liv", "vi", "mic", "lid"}


def headword(title):
    """AARON BEN ASHER OF KARLIN -> Aaron ben Asher of Karlin. A mixed-case headword is kept."""
    if any(c.islower() for c in title):
        return title
    out, k = [], 0
    for w in re.split(r"(\s+|-|\(|\)|\[|\])", title.lower()):
        if not w or re.fullmatch(r"\s+|-|\(|\)|\[|\]", w):
            out.append(w)
            continue
        if re.fullmatch(r"[ivxlc]+\.?", w) and w.rstrip(".") not in NOT_ROMAN:
            out.append(w.upper())
        elif k and w in SMALL:
            out.append(w)
        else:
            out.append(re.sub(r"^(['‘’]?)(\w)", lambda m: m.group(1) + m.group(2).upper(), w))
        k += 1
    return "".join(out)


# The Jewish Encyclopedia's abbreviations -> OSIS. KJV with the Apocrypha only.
BOOKS = {
    "Gen": "Gen", "Ex": "Exod", "Exod": "Exod", "Lev": "Lev", "Num": "Num", "Deut": "Deut", "Josh": "Josh",
    "Judges": "Judg", "Judg": "Judg", "Ruth": "Ruth", "I Sam": "1Sam", "II Sam": "2Sam", "I Kings": "1Kgs",
    "II Kings": "2Kgs", "I Chron": "1Chr", "II Chron": "2Chr", "Ezra": "Ezra", "Neh": "Neh", "Esth": "Esth",
    "Job": "Job", "Ps": "Ps", "Prov": "Prov", "Eccl": "Eccl", "Eccles": "Eccl", "Cant": "Song", "Isa": "Isa",
    "Jer": "Jer", "Lam": "Lam", "Ezek": "Ezek", "Dan": "Dan", "Hos": "Hos", "Joel": "Joel", "Amos": "Amos",
    "Obad": "Obad", "Jonah": "Jonah", "Micah": "Mic", "Mic": "Mic", "Nahum": "Nah", "Nah": "Nah", "Hab": "Hab",
    "Zeph": "Zeph", "Hag": "Hag", "Zech": "Zech", "Mal": "Mal", "Matt": "Matt", "Mark": "Mark", "Luke": "Luke",
    "John": "John", "Acts": "Acts", "Rom": "Rom", "I Cor": "1Cor", "II Cor": "2Cor", "Gal": "Gal", "Eph": "Eph",
    "Phil": "Phil", "Col": "Col", "I Thess": "1Thess", "II Thess": "2Thess", "I Tim": "1Tim", "II Tim": "2Tim",
    "Titus": "Titus", "Philem": "Phlm", "Heb": "Heb", "James": "Jas", "I Pet": "1Pet", "II Pet": "2Pet",
    "I John": "1John", "II John": "2John", "III John": "3John", "Jude": "Jude", "Rev": "Rev",
    "I Esd": "1Esd", "II Esd": "2Esd", "Tobit": "Tob", "Tob": "Tob", "Judith": "Jdt", "Wisdom": "Wis",
    "Ecclus": "Sir", "Baruch": "Bar", "I Macc": "1Macc", "II Macc": "2Macc",
}
# CyberJudah's book order (1611, Apocrypha after Malachi as books 67-81 in the app).
OSIS_ORDER = (
    "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song "
    "Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom "
    "1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev "
    "1Esd 2Esd Tob Jdt GkEsth Wis Sir Bar EpJer SgThree Sus Bel PrMan 1Macc 2Macc"
).split()
BOOK_PATTERN = "|".join(sorted((re.escape(k) for k in BOOKS), key=len, reverse=True))
REFERENCE = re.compile(r"\b(" + BOOK_PATTERN + r")\.?\s+([ivxlcIVXLC]{1,7})\.\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?(?!\d)")
ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100}


def roman(value):
    n = 0
    for i, ch in enumerate(value):
        x = ROMAN[ch]
        n += -x if i + 1 < len(value) and ROMAN[value[i + 1]] > x else x
    return n


def build(source, output):
    library = source / "data/library/jewish-encyclopedia"
    items = json.loads((library / "book.json").read_text())["items"]
    app_books = json.loads((HERE.parent.parent / "src/assets/cyberjudah/books.json").read_text())
    verse_counts = {}
    for number, book in enumerate(app_books, 1):
        chapters = json.loads((source / f"data/bible/{book['slug']}.json").read_text())["chapters"]
        verse_counts[number] = {int(c): len(v) for c, v in chapters.items()}
    book_number = {osis: n for n, osis in enumerate(OSIS_ORDER, 1)}

    s, offsets = load_corpus(library)
    starts = [o[0] for o in offsets]

    def page_at(p):
        _, volume, page, img = offsets[bisect.bisect_right(starts, p) - 1]
        return volume, page, img

    headwords = []
    for line in (HERE / "headwords.tsv").read_text().splitlines():
        if line and not line.startswith("#"):
            article_id, title = line.split("\t")
            headwords.append((int(article_id), title))
    positions = align(headwords, candidates(s))

    freq = collections.Counter(re.findall(r"[A-Za-z]+", s))

    def repair(word):
        if freq[word] >= 20:
            return word
        for a, b in (("li", "h"), ("tli", "th"), ("rn", "m")):
            if a in word:
                fixed = word.replace(a, b)
                if freq[fixed] >= 200 and freq[fixed] >= 50 * max(1, freq[word]):
                    return fixed
        return word

    def join(m):
        a, b = m.group(1), m.group(2)
        return a + b if freq[a + b] > freq[a + "-" + b] and freq[a + b] >= 3 else a + "-" + b

    def link(m, cited):
        book, chapter, first, last = m.groups()
        osis = BOOKS[book]
        number, c = book_number[osis], roman(chapter.lower())
        v1, v2 = int(first), int(last) if last else int(first)
        verses = verse_counts.get(number, {}).get(c)
        if not verses or not 1 <= v1 <= v2 <= verses:
            return m.group(0)
        cited.extend(f"{number}-{c}-{v}" for v in range(v1, min(v2, v1 + 29) + 1))
        ref = f"{osis}.{c}.{v1}" + (f"-{osis}.{c}.{v2}" if v2 != v1 else "")
        return f'<a class="verse bible-ref" href="bible://{ref}" data-osis="{ref}">{m.group(0)}</a>'

    def body(raw, cited):
        t = re.sub(r"(\w)- \n*([a-z]\w*)", join, raw)
        t = re.sub(r"[A-Za-z]+", lambda m: repair(m.group(0)), t)
        paragraphs = []
        for p in re.split(r"\n\s*\n", t):
            p = re.sub(r"\s+", " ", p).strip()
            if not p:
                continue
            # A paragraph that starts in lower case continues the last one across a page or column.
            if paragraphs and re.match(r"[a-z]", p):
                paragraphs[-1] += " " + p
            else:
                paragraphs.append(p)
        out = []
        for p in paragraphs:
            e = REFERENCE.sub(lambda m: link(m, cited), html.escape(p, quote=False))
            e = re.sub(r"^bib\w{0,3}iog\w{0,6}\s*:", "<strong>Bibliography:</strong>", e, flags=re.I)
            out.append(f"<p>{e}</p>")
        return "".join(out)

    found = [(h, p) for h, p in zip(headwords, positions) if p is not None]
    by_word = collections.OrderedDict()
    for i, ((article_id, title), p) in enumerate(found):
        end = found[i + 1][1] if i + 1 < len(found) else len(s)
        seg = s[p:end]
        m = HEADING.match(seg)
        raw = seg[m.end() :] if m else seg
        if len(re.findall(r"[A-Za-z]", raw)) < 3:
            continue
        volume, page, img = page_at(p)
        end_volume, end_page, _ = page_at(max(p, end - 1))
        cited = []
        see = re.fullmatch(r"\s*See\s+(?:also\s+)?([^.\n]{2,80})\.?\s*", raw) if len(raw) < 200 else None
        if see:
            target = see.group(1).strip()
            text = f'<p>See <a class="word" href="{html.escape(headword(target.upper()) if target.isupper() else target)}">{html.escape(target)}</a>.</p>'
        else:
            text = body(raw, cited)
        pages = f"p. {page}" + (f"–{end_page}" if end_volume == volume and end_page != page else "")
        scan = f"https://archive.org/details/{items[volume - 1]['id']}/page/n{img}"
        word = headword(title)
        by_word.setdefault(word.casefold(), {"word": word, "parts": []})["parts"].append((text, volume, pages, scan, cited))

    if output.exists():
        output.unlink()
    db = sqlite3.connect(output)
    db.executescript(
        """
        CREATE TABLE dictionnaire (id INTEGER PRIMARY KEY, sanitized_word TEXT NOT NULL, word TEXT NOT NULL, definition TEXT NOT NULL);
        CREATE INDEX dictionnaire_browse ON dictionnaire(sanitized_word, id);
        CREATE TABLE verses (id TEXT PRIMARY KEY, ref TEXT NOT NULL);
        CREATE TABLE dictionary_passage_anchors (
          verse_key TEXT NOT NULL,
          entry_id INTEGER NOT NULL,
          evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('source-citation', 'verse-name', 'verse-phrase')),
          ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
          PRIMARY KEY (verse_key, entry_id, evidence_kind),
          FOREIGN KEY (entry_id) REFERENCES dictionnaire(id) ON DELETE CASCADE
        );
        """
    )
    entries = sorted(by_word.values(), key=lambda e: (normalize(e["word"]), e["word"]))
    anchors = collections.defaultdict(dict)
    articles = 0
    for entry_id, entry in enumerate(entries, 1):
        parts = []
        for n, (text, volume, pages, scan, cited) in enumerate(entry["parts"]):
            articles += 1
            if n:
                parts.append("<p><strong>Another article under this name</strong></p>")
            parts.append(text)
            parts.append(f'<p><i>Reference: {TITLE}, vol. {volume}, {pages}. <a href="{scan}">The printed page</a>.</i></p>')
            for key in cited:
                anchors[key].setdefault(entry_id, entry["word"])
        db.execute("INSERT INTO dictionnaire VALUES (?,?,?,?)", (entry_id, normalize(entry["word"]), entry["word"], "".join(parts)))
    for key in sorted(anchors, key=lambda k: tuple(int(x) for x in k.split("-"))):
        cited = list(anchors[key].items())
        db.execute("INSERT INTO verses VALUES (?,?)", (key, json.dumps([w for _, w in cited], ensure_ascii=False)))
        db.executemany(
            "INSERT INTO dictionary_passage_anchors VALUES (?,?,'source-citation',?)",
            [(key, entry_id, ordinal) for ordinal, (entry_id, _) in enumerate(cited)],
        )
    db.execute("CREATE INDEX dictionary_passage_anchors_entry ON dictionary_passage_anchors (entry_id, verse_key)")
    db.commit()
    db.execute("VACUUM")
    db.close()
    return {"headwords": len(headwords), "found": len(found), "articles": articles, "entries": len(entries), "verses": len(anchors)}


def normalize(word):
    """The app's browse key, as the other dictionaries make it: lower case, no accents, words only."""
    word = "".join(c for c in unicodedata.normalize("NFKD", word) if not unicodedata.combining(c)).lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", word).strip()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    print(json.dumps(build(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())))
