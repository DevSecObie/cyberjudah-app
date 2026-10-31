# The Bishops' commentaries in the Bible reader

Obie (2026-10-31): the commentary under the verses must carry the teacher's name, not
"CyberJudah", and show Bishop Nathanyel's, Bishop Yawasap's and Bishop Kani's commentaries (only
the three Bishops for now).

- `helpers/commentaryCatalog.ts`: the CyberJudah catalog is the three Bishops (`bishop-nathanyel`,
  `bishop-yawasap`, `bishop-kani`), each named for him. Nothing in it says CyberJudah.
- `features/commentaries/commentarySelection.ts`: every reader starts with all three; a selection
  saved by an earlier build (Bible Strong's commentaries, or the single "cyberjudah") becomes the
  three Bishops.
- `features/commentaries/inlineCommentarySelection.ts`: the cards under the verses are back on
  (paused in 28eb3182), showing the Bishops by default.
- `features/resources/resourceAccess.web.tsx`: the web build reads the three Bishop ids.
- Server side: DevSecObie/cyberjudah-telegram #461; data: DevSecObie/cyberjudah #751.
