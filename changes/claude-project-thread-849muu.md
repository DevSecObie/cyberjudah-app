# Notes: Save as PDF, and export the reader's own notes

- Class notes (Courses & videos player): a "Save as PDF" button in the header makes the same PDF
  the Telegram app's export makes (port of cyberjudah-telegram `bot/src/pdf.mjs`, pdf-lib + marked),
  on the phone and offline once the note has loaded, and opens the share sheet (Save to Files,
  Print, Mail, AirDrop).
- My notes: the note screen's menu gains "Save as PDF" beside Share; the Notes list gains an
  export button that puts every note the list shows (after search and tag filters) into one PDF.
- The note's Share text no longer starts with French "Note pour" in English.
- New JS-only dependencies: pdf-lib, marked, entities (htmlparser2 was already there). No native
  module, so no new dev client is needed, but `yarn install` must run before Metro picks them up.
