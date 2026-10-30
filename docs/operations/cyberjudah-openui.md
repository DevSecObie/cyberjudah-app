# CyberJudah native OpenUI study answers

Updated 2026-10-30. The iPhone app keeps Bible Strong's native navigation, shared components, themes and existing glass. This is not a web wrapper. KJV is the single Bible version in this release; the visible label is **Related scriptures**. Translation comparison and word-difference controls are disabled in Ask.

## Current implementation

The previous source-card adapter remains for saved legacy answers. New questions send `ui: study-v1` to the Firebase-authenticated CyberJudah staging Worker. The backend searches recorded transcripts, surrounding captions and relevant public app resources, then an approved hosted model composes allowlisted OpenUI components. The phone renders those components using `@openuidev/react-lang` 1.0.2's native entry.

Components: teaching explanation, supporting context, source cards, Related scriptures, existing app navigation and suggested follow-up questions. Both server and client reject dynamic state, arbitrary queries/mutations and unknown components. Source numbers must exist; teaching citations cannot point only to reference entries. An invalid program falls back to ordinary text and source cards. Citation checks cannot prove a paraphrase is faithful; teacher/owner review of actual answers remains necessary.

The policy is complementary to teachers, never a source of new doctrine. Transcript excerpts and published teacher notes carry teaching attribution; encyclopedia, people biography, dictionary, Nave, chronology and other reference facts remain supporting context. If the retrieved teaching does not establish an answer, the assistant says so rather than relying on model memory.

Public research covers transcript search, public notes, people and their attributed teaching points, KJV, timeline, dictionary, Nave, Strong, topics, law, precepts, case studies, glossary and published doctrine discussions. Only relevant resources are selected, with bounded queries and evidence. Private notes, studies, highlights, bookmarks, account records and purchases are not model tools; buttons to those screens simply navigate when tapped.

Sources reuse existing thumbnails and approved people portraits. The card's excerpt and evidence label identify what supports the answer. Video sources open the existing class player at the cited second when its class is in the app library; otherwise the original video link remains available. Person, dictionary, Nave, Strong, scripture and other supported links open the existing native screen, preserving actual source IDs. Related scripture text comes from the app's resource port, not model-generated text.

The user's existing custom waiting sentences remain. Actual research events identify what resource/query is being searched and which transcript/timestamp is being read. The backend caps streamed UI snapshots and the phone caps total stream bytes, individual records, source counts and rendered program length. No automatic retry resubmits an AI question after a disconnect.

## Server and offline content

The temporary phone-supplied encyclopedia-excerpt workaround was removed. The server indexes the same hash-verified Jewish Encyclopedia edition used for the downloadable Offline copy. It preserves all 14,391 article IDs and full article HTML; online article reads use our own backend, not Bible Strong's upstream. Original Bible Strong dictionary and Nave continue through the existing upstream gateway. Saved Bible scripture cards still use installed Offline copies when available. A new AI answer requires a connection.

## Mobile boundary

Provider credentials and the vector database remain on the server. Ask rejects non-HTTPS or credential-bearing API origins before sending a Firebase token. Each submission has a random UUID `X-Trace-ID`; safe backend outcome logs correlate that ID without the question, answer, token or UID. The saved answer can include its support ID in a user-initiated report. A trace ID is not authentication and does not make repeated submissions idempotent.

Sentry already exists with `sendDefaultPii: false`; this work does not enable session replay or add a telemetry vendor. The app has no on-device model or training job. Public reading resources are distinct from training datasets.

Native config is prepared to remove CyberJudah's inherited iOS HTTP timeline exception and disallow Android cleartext outside explicit development profiles. Those platform settings require a new native binary. Current build 305 does not retroactively receive manifest changes, although the Ask JavaScript HTTPS guard applies when the updated bundle loads.

## Device and validation status

The connected iPhone has the previously installed signed development app **CyberJudah Staging 28.1.0 (305)**, bundle `io.cyberjudah.app.dev`. Its JavaScript comes from the existing Metro server on port 8081. This work did not reset app data, replace that Metro server, submit a new TestFlight build or publish a store release.

Latest focused native checks: **31 suites / 187 tests passed**, plus root type checks. The final iOS export, including request tracing, passed (`/tmp/cyberjudah-study-ios-final`). Scoped lint has only pre-existing warnings after formatting. The large root suite previously had four unrelated failures; focused checks are not a declaration that the entire app is release-ready.

Backend review: https://github.com/DevSecObie/cyberjudah-telegram/pull/452 (draft, unmerged). Remote CI passed installation, type checks, all tests and build. The first deployment was blocked by the staging branch restriction; the permitted staging branch is now used without changing protection or merging the PR. Cloudflare then caught OpenUI generating a random library ID at module startup. Commit `c1636c1` fixes this with request-time initialization and a passing actual Workers-runtime regression test. Run `41022087309` then passed deployment and smoke checks. The live device test found an over-large model citation set; commits `14b5c9d` and `87416ee` cap composition at 12 targeted sources and focus named-scripture transcript queries. Final run `41025464642` passed all checks and staging steps for `87416ee`.

Local server checks: 362 backend tests and 91 resource API tests passed before additional request-boundary tests; the updated focused suite also passed. All 14,391 dictionary IDs, titles and full definitions matched the offline source; SQLite integrity passed. New tests cover authority separation, invalid OpenUI, transcript context/timestamps, hash mismatch, long articles, replay-safe import, exact title ranking, pagination, HTTPS origin restrictions, model promotion, consent, request caps and tracing.

Mirroring verified custom waiting text, actual transcript search/reading steps, source thumbnails and both KJV Related scriptures cards for Romans 3:31 and James 2:17. That first answer used the safe fallback after an over-large citation set; the corrected deployment now awaits its final fresh-answer and navigation retest. A model-format diagnostic with public excerpts passed validation after the source cap; it correctly retained the missing-teaching notice when the selected excerpts did not establish an explanation. Do not treat format validity as teacher-reviewed semantic fidelity.

## Owner/device checks after staging succeeds

### iPhone database crash corrected (2026-10-30)

The repeated exits were real native crashes, not user navigation. The device's 01:32:04 report (`CyberJudahStaging-2026-10-30-013207.ips`) shows `EXC_BAD_ACCESS` in `exsqlite3_finalize → sqlite3Fts5IndexClose → SQLiteModule.closeDatabase` on `expo.module.sqlite.AsyncQueue`. This matches [Expo issue 38168](https://github.com/expo/expo/issues/38168). The installed expo-sqlite 57.0.3 still sweeps all statements before close, including internal statements that FTS5 owns and later frees again.

All app-owned native SQLite opens now go through `helpers/sqliteConnection.ts`, which sets `finalizeUnusedStatementsBeforeClosing: false` while preserving the caller's directory and other connection options. Legacy resources, validation connections, the Bible database and downloaded class index use it. Query helpers already finalize their own statements in `finally`; future explicit prepared statements must do the same. Database closing still occurs. No data is deleted, migrated or reset by this fix, and no dependency upgrade is needed. The existing online-only web boundary remains unchanged.

Verification: the exact bundled SQLite C source reproduces the original heap-use-after-free under AddressSanitizer, with the same FTS5 close stack. The safe path passes 100 create/search/integrity/close cycles. The reproducible diagnostic is `apps/expo/scripts/check-sqlite-fts-close.c`; it uses synthetic in-memory data only. Compile from the repository root:

```sh
clang -O0 -g -fsanitize=address -DSQLITE_ENABLE_FTS5 \
  -I apps/expo/node_modules/expo-sqlite/ios \
  apps/expo/scripts/check-sqlite-fts-close.c \
  apps/expo/node_modules/expo-sqlite/ios/sqlite3.c \
  -o /tmp/cyberjudah-fts-close-repro
/tmp/cyberjudah-fts-close-repro
```

Passing `unsafe` deliberately reproduces the old crash in that isolated diagnostic process. Do not run the unsafe path against app data.

App verification: 11 suites / 116 targeted resource, SQLite, startup, migration and web-boundary tests passed; TypeScript, scoped lint and architecture checks passed (454 pre-existing architecture warnings). iOS export passed at `/tmp/cyberjudah-fts-ios-export`. The corrected JavaScript was loaded into the existing development build 305 and the app was restarted without resetting data. No new CyberJudah crash report appeared through the 01:54:56 device check (latest report remained 01:32:07); search results remained visible. Additional search source files changed during testing and development reloads occurred, so this is not a stable release-binary soak test. The owner confirmed More → Ask responds on the phone. Mirroring still intermittently fails to deliver React Native button taps. Fresh-answer/source-link verification remains separate from the crash fix, and TestFlight has not received this JavaScript update.

1. Open Ask and start a new question; old saved answers do not retroactively run new research.
2. Ask: “What did the teachers say about Romans 3:31 and James 2:17? Show the related scriptures and original teaching.” Check the custom progress sentences, actual transcript steps, readable answer and KJV scripture cards.
3. Open a cited class. Confirm its title and playback timestamp match the source; return to the same chat.
4. Ask about Abraham using the teaching, people record and historical encyclopedia context. Check separate evidence labels, actual portrait, native person/article navigation and stable source IDs.
5. Ask a doctrinal question the retrieved teaching does not establish. It should acknowledge that gap rather than invent an answer from reference works.
6. Interrupt a stream, reopen history and report an answer. It must preserve completed data, avoid automatic duplicate inference, and send only the report reason/model/support ID.
7. Check large text, scrolling, weak-network failure, account switching and offline saved scripture reading. A server-read failure must not claim “nothing was taught.”

Logs: `/tmp/cyberjudah-study-native-tests.log`, `/tmp/cyberjudah-study-native-types.log`, `/tmp/cyberjudah-study-native-lint.log`, `/tmp/cyberjudah-study-ios-final.log`, `/tmp/cyberjudah-study-backend-all-tests.log`, `/tmp/cyberjudah-study-resource-tests.log`, `/tmp/cyberjudah-study-boundary-tests.log`, `/tmp/cyberjudah-study-server-parity.json`.

Official renderer reference: https://www.openui.com/integrations/react-native . The companion backend control register is `docs/operations/ask-ai-pipeline.md` in the `cyberjudah-telegram` review branch.

## Repository security follow-up

Six open dependency alerts remain on the backend repository: re2js 2.8.6 (fixed in 2.8.7) and undici 7.29.1 (fixed in 7.30.1). In that lockfile re2js comes from Firebase Firestore and undici from Miniflare. These have been identified, not patched by this feature change. Confirm deployed reachability and update with checks before public release. A successful staging feature test is not a public-release approval.

The shared source database has `teaching_passages` but no `teaching_refs`. Public transcript search works, while chapter-to-teaching lookups return 503. This is an upstream index gap, not a local access problem. The task did not modify the shared production database.
