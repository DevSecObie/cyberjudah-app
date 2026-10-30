# The Jewish Encyclopedia as a free download in Dictionaries

- Dictionaries list "The Jewish Encyclopedia (1901–1906)" beside Easton, Smith and ISBE. It is a
  download only (offline, searchable, like the other dictionaries once downloaded); it is never
  read from Bible Strong's servers.
- 14,391 entries (14,554 articles) built from CyberJudah's own OCR of the twelve volumes
  (`data/library/jewish-encyclopedia` in DevSecObie/cyberjudah). `scripts/jewish-encyclopedia/headwords.tsv`
  is the encyclopedia's article order, checked against jewishencyclopedia.com's index; it is used
  only to find where each article starts. 14,676 of the 15,311 headwords were found in the scans;
  the text of the other 635 stays at the end of the article before it.
- Every article is labelled a reference and ends with its volume and page and a link to the
  printed page on archive.org. Two articles under one headword (Abel, Aaron) share one entry.
- Scripture references in the encyclopedia's style (Ex. xvii. 9) open the KJV verse when that
  verse exists in the KJV with the Apocrypha. The encyclopedia numbers some verses the Hebrew way,
  so a few links can land a verse off (Joel, Malachi, psalm titles). The cited verses are also
  indexed in the download (the same passage table the other dictionaries carry).
- OCR is kept as printed except two repairs settled by the scans themselves: a word broken across
  a line is joined when the joined word is commoner in the twelve volumes, and "li" for "h" or
  "rn" for "m" is repaired when the repaired word is far commoner there. Margin notes the printer
  set beside the columns still appear inside the text.
- A dictionary downloads on its own when the catalog has no shared dictionary index
  (CyberJudah's has none), instead of failing on the missing index.
- `scripts/package-cyberjudah-dictionary.mjs` zips any of our dictionaries and adds it to both
  catalogs, for the next works (Easton's, Smith's, BDB).

Rebuild: `python3 apps/expo/scripts/jewish-encyclopedia/build.py <cyberjudah checkout> /tmp/je.sqlite`
then `node apps/expo/scripts/package-cyberjudah-dictionary.mjs /tmp/je.sqlite jewish-encyclopedia JEWISH_ENCYCLOPEDIA`.
