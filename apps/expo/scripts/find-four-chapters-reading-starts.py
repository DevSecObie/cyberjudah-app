#!/usr/bin/env python3
"""Find where each 4 Chapters a Day class starts reading the day's chapter.

For every class session the plan builder lists (FOUR_CHAPTERS_SESSIONS=… node
scripts/build-cyberjudah-four-chapters-plan.mjs), this looks for the chapter's opening words
(KJV, from the content repository's data/bible) in the class's captions and writes
scripts/data/four-chapters-a-day-starts.tsv: video, book id:chapter, second. The second is a
few seconds before the first verse is read, so the class opens on the reading. A session whose
captions never read the opening words is left out and starts at 0.

usage: find-four-chapters-reading-starts.py SESSIONS.json TRANSCRIPTS_DIR BIBLE_DIR
TRANSCRIPTS_DIR holds <video>.json as TranscriptAPI returns it ({content: {transcript: [{text,
start}]}}) or as the content repository keeps it.
"""
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

LEAD_SECONDS = 3
# Sessions where the looser verse-1 match lands on the wrong place (checked by hand): the words
# it finds belong to another chapter, so these stay at 0.
LOOSE_WRONG = {("kD_f1njsM8k", "4:19"), ("LnNul0RILYA", "9:28")}
WORD = re.compile(r"[a-z]+")


def words(text):
    return WORD.findall(text.lower().replace("’", "'").replace("'", ""))


def segments(path):
    data = json.loads(path.read_text())
    if isinstance(data, dict) and "content" in data:
        data = data["content"]
    if isinstance(data, dict):
        data = data.get("transcript") or data.get("segments") or []
    out = []
    for seg in data:
        if isinstance(seg, dict):
            out.append((float(seg["start"]), seg["text"]))
        elif isinstance(seg, list):
            out.append((float(seg[0]), seg[1]))
    return out


def opening(bible, slug, chapter):
    book = json.loads((bible / f"{slug}.json").read_text())
    verses = book["chapters"].get(str(chapter)) or []
    # Verse 1 and 2 together: many chapters open with the same few words ("And the LORD spake
    # unto Moses, saying"), so one verse alone is not enough to tell them apart.
    return words(" ".join(verses[:2]))[:18]


def opening_verse(bible, slug, chapter):
    book = json.loads((bible / f"{slug}.json").read_text())
    verses = book["chapters"].get(str(chapter)) or []
    return words(verses[0])[:12] if verses else []


def find(stream, target, share=0.7, least=6, slack=8):
    """Earliest place in the captions where the target words are read, as a word index."""
    if len(target) < least:
        return None
    need = max(least, round(len(target) * share))
    heads = set(target[:3])
    span = len(target) + slack
    for i, (word, _) in enumerate(stream):
        if word not in heads:
            continue
        window = [w for w, _ in stream[i : i + span]]
        matched = sum(block.size for block in SequenceMatcher(None, target, window, autojunk=False).get_matching_blocks())
        if matched >= need:
            return i
    return None


def main():
    sessions_file, transcripts, bible = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    sessions = json.loads(Path(sessions_file).read_text())
    rows, missing = [], []
    for session in sessions:
        path = transcripts / f"{session['video']}.json"
        if not path.exists():
            missing.append((session["video"], session["chapter"], "no captions"))
            continue
        stream = [(w, start) for start, text in segments(path) for w in words(text)]
        at = find(stream, opening(bible, session["slug"], session["number"]))
        if at is None and (session["video"], session["chapter"]) not in LOOSE_WRONG:
            # Verse 1 alone, looser: captions that mangle verse 2, or a class that reads verse 1
            # and then teaches before going on.
            at = find(stream, opening_verse(bible, session["slug"], session["number"]), 0.6, 5, 6)
        if at is None:
            missing.append((session["video"], session["chapter"], "opening not read"))
            continue
        second = max(0, int(stream[at][1]) - LEAD_SECONDS)
        rows.append((session["video"], session["chapter"], second))
    out = Path(__file__).parent / "data" / "four-chapters-a-day-starts.tsv"
    lines = [
        "# Where each 4 Chapters a Day class starts reading the day's chapter, found from its captions",
        "# by scripts/find-four-chapters-reading-starts.py. A session not listed opens at 0.",
        "video\tchapter\tseconds",
    ] + [f"{v}\t{c}\t{s}" for v, c, s in rows]
    out.write_text("\n".join(lines) + "\n")
    print(f"{len(rows)} starts, {len(missing)} left at 0")
    for v, c, why in missing:
        print(f"  {v} {c}: {why}", file=sys.stderr)


if __name__ == "__main__":
    main()
