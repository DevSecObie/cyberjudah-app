# The Jewish Encyclopedia: fix the scanner's misspellings

- About 15,400 misspelt words in the Jewish Encyclopedia download are repaired ("tlie" → "the",
  "wliich" → "which", "Mainionides" → "Maimonides", "Gescbichte" → "Geschichte"), about 3,700
  distinct spellings. A word is changed only when one of the scanner's usual misreadings
  (li for h, rn for m, c for e, ii for u, ...) turns it into a spelling that is far commoner in the
  twelve volumes themselves. Nothing is taken from another copy of the text.
- `scripts/jewish-encyclopedia/english-words.txt` lists the English words found in the scans
  (from dwyl/english-words, Unlicense). Those words are never changed. Short words and rare names
  are changed only through letter-pair misreadings or when one spelling clearly wins, so German,
  Hebrew and Aramaic words stay as printed.
- The text of jewishencyclopedia.com is not used: its terms of use forbid copying or
  redistributing it.
