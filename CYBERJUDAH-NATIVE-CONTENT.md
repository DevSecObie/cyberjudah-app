# CyberJudah content in the native app

Status of CyberJudah's published content inside the Bible Strong Expo app, checked on
29 October 2026 for the first free iPhone release. Everything listed here uses Bible Strong's
existing contracts, screens and controls. No screen, control or style was added.

## Sources checked

| Source | Revision or checksum |
| --- | --- |
| This branch | from `codex/bible-strong-web-port` at `96c47d1fa7d828d58e2a14cdf2b1204683f11ef1`; the signed candidate `2929f04` adds signing files only, so its content is the same |
| Resource adapter | `DevSecObie/cyberjudah-telegram` `codex/bible-strong-staging` at `1edb51fd9aeb50f462095c623c98286de30afcd3` (`bot/src/bs/*`) |
| Live data origin | `https://data.cyberjudah.io/api/…`, read 29 October 2026 |
| KJV text | `textSha256` `3a5a5432a8357dcda5092441248d45ddac40ae1668498007bd83d9eed51c12fd`, Strong `18dd1e627b7abfbe7649f6d7580bc0e01b72b7b262fe0066c86f8c15c3cf086f`, source commit `34a20526`, built 2026-10-25T15:12:31Z (`src/assets/cyberjudah/publication.json` equals the adapter's `bot/data/bs-metadata.json`) |
| Offline KJV | `KJV.json.zip` archive `0566578f90b306edd10ef3caf589a6d96db737c8876edb441c0d33ef3637fbc5`, content `345bce7592a5c5b1948b54563cb802c2c4e779b10935f65c1046a344548a8f44` |
| Offline Strong index | `bible-kjv-strong.sqlite.zip` archive `7a4be2628408f2d7b1e72a3f78eeb4586fe24f3fb644d94ec5c360b144c61aa2`, content `430b1698aca5d0d34d03a8439ec425669d82e4c4871cb8d630fa3115c8f25e5d` |
| Timeline | `cj-timeline-44d9dfb398295250fa3266c55db748ed39c36db6fae8f351ed11d378e1e86b49`; sources timeline `da5f81d4…b997`, Final Captivity `1ec73458…160f`, Between the Testaments `44136fa3…f8a`, case studies `93d64f60…1d18`; offline archive `1dc5e082e0e35a7d3ad153c903eb3c538bb1ca8143b5e6b556015c437bd4a6eb` |
| People (not yet placed) | `DevSecObie/cyberjudah` main `3f38b92` (after #735): `people.json` `7fe35d14…909b`, `places.json` `d778f3c3…c56c`, `other.json` `b2916b26…85ed` |

## Baseline counts

| Check | Expected | Found | How |
| --- | --- | --- | --- |
| KJV books / chapters / verses | 81 / 1,362 / 36,821 | 81 / 1,362 / 36,821 | every live chapter re-downloaded and hashed against `publication.json`: 0 mismatches |
| Strong spans | 320,356 | 320,356 | same download; also the offline SQLite archive |
| Strong lexicon | every code in the text | 13,634 codes used, 0 missing from the 14,197-entry lexicon | live `/api/strongs/index.json` |
| Timeline periods / events / readable details | 21 / 991 / 517 | 21 / 991 / 517 | rebuilt with `bot/scripts/build-bs-timeline.mjs`; the revision reproduces exactly |
| Final Captivity accounts | 434 | 434 | readable events in "The American Captivity" |
| Case studies | 92 | 92 | `bot/data/bs-timeline-cases.json` |

Legitimate differences:

- The timeline geometry has 1,105 rows for 991 events: some events are drawn in more than one place and share one slug and one detail.
- 214 lifespans run past their period's edges and 8 geometry rows have an end year before the start year (for example `luther-begins-lecturing-at-wittenburg` 1512–0). All 8 come unchanged from Bible Strong's own geometry (`src/features/timeline/events.old.ts`), none has a readable detail, and no date was changed.
- Rest of Esther 10 holds verses 4–13, as the KJV numbers them. Coverage reports its 10 verses as a count. This was a real defect, fixed below.
- The classes read the Epistle of Jeremy as "Baruch 6"; the published data files it as Epistle of Jeremiah 1 (book 75), with the class's own "Baruch 6:3-6" label kept on each precept. The links resolve to book 75.
- The Apocrypha (books 67–81, 173 chapters) has no published cross references. The adapter returns an empty list there, which the reader shows as no references.

## Dataset to screen map

| CyberJudah dataset | Bible Strong contract | Screen | State |
| --- | --- | --- | --- |
| KJV with Apocrypha, 81 books | Bible text, coverage, `kjv-1611` canon | Reader, book and verse pickers, passage search, compare | Ported; offline |
| Strong tags | Strong Bible index (spans) | Strong mode in the reader, concordance counts and occurrences | Ported; offline |
| Strong definitions (public-domain Strong's via Open Scriptures, CC BY-SA) | Strong lexicon entries | Strong popover and Strong entry | Ported; online only |
| Cross references | Supplementary cross references | Verse references in the reader | Ported for books 1–66; online only |
| Precepts and class breakdowns (356 passes; 30,006 precept rows and 41,405 breakdown rows across 1,362 chapters; 15,325 class moments) | Commentary `cyberjudah` (reading index, sections, verse comments) | Commentary tab, inline commentary, verse study | Ported; online only; Bishops then Deacons first; YouTube moment links |
| Timeline (21 periods, 991 events, 517 details incl. 434 Final Captivity and 92 case studies) | Timeline events and geometry | Timeline, event details, search | Ported; text offline, images online |
| Original dictionary (Easton + Webster, Smith, ISBE, Translation Words) | Dictionaries via the fixed gateway | Dictionary and verse dictionary | Upstream content kept; online only |
| Nave Thematic Bible | Nave via the fixed gateway | Nave topics and verse topics | Upstream content kept; online only |
| People 4,081, places 1,274, other names 47 | Biblical entity (`StrongLexiconEntityDto`, chapter entities) | Chapter people row, entity profile | Not placed; needs the owner's decision |
| Class notes (309), Captains notes (231), Hidden History (204), series | none | none | Not placed; needs the owner's decision |

## Fixed in this change

1. **Rest of Esther 10:11–13 could not be reached.** Coverage carries verse counts, and the verse picker, passage browser and previous/next verse buttons numbered every chapter from 1. In Rest of Esther 10 they offered 1–10, so 1–3 led nowhere and 11–13 never appeared. `src/assets/cyberjudah/verse-numbering.json` records the one chapter that starts elsewhere (`71-10` starts at 4), `bibleCoverage.ts` turns counts into the real verse numbers, and `verify-cyberjudah-offline.mjs` now fails if that file ever disagrees with the offline archive or a chapter has a gap. The build script regenerates the file.
2. **Teaching links opened the website.** Each precept heading links to `https://cyberjudah.io/bible/<book>/<chapter>#v<verse>`. The commentary screens open only `bible://` links in the app, so every precept passage left the app for Safari. `cyberJudahSiteLinks.ts` maps those links, and only those, to the same chapter and verse in the reader. Class-note and YouTube links still open outside, as before. Unknown books, unpublished chapters (such as Rest of Esther 3) and look-alike hosts stay external.

Tests: `cyberJudahVerseNumbering-test.ts`, `cyberJudahSiteLinks-test.ts`, `BibleVerseDetailFooter-test.tsx`.

## For Codex: evidence outside this change

These sit in the resource adapter (`cyberjudah-telegram` `codex/bible-strong-staging`) or in release integration, so they are not changed here.

1. **Strong gloss leads with the wrong part of the definition.** `bot/src/bs/strongs.ts` uses `def` as the gloss and puts it before `derivation`. In the Open Scriptures source the definition is split across both fields, so G2316 θεός shows the gloss "figuratively, a magistrate; by Hebraism, very" and its popover begins there, while "a deity, especially (with G3588) the supreme Divinity" sits in `derivation`. 5,489 of 14,197 index glosses begin with a space and 5,983 with a lower-case word. Suggested: show the Strong text in Strong's own order (derivation, then definition, then KJV renderings) and derive the gloss without dropping the first half; no wording invented.
2. **Precept links name only the first verse.** The adapter writes `/bible/psalms/109#v1` for "Psalms 109:1-5", so the reader focuses verse 1 only. Writing the range as `bible://Ps.109.1-Ps.109.5` would let the existing commentary link handler focus the whole passage, and the adapter in this change would no longer be needed for new content.
3. **Release hosts.** The bundled offline catalog, the archive URLs (`mobileResourceCatalog.ts`, `offline-catalog.json`) and `.env.cyberjudah.example` all point at `cyberjudah-telegram-staging.oisrae1.workers.dev`. The hash-pinned App Check exemption in `cyberJudahPublicArchive.ts` matches those exact URLs, so moving to a production host means rebuilding the catalog and the exemption together.
4. **Dictionary and Nave in the Apocrypha.** The gateway maps books 67, 69, 70, 72, 73, 74, 80 and 81 to Bible Strong's numbering by identity. Rest of Esther, the Epistle of Jeremiah, the Song of the Three, Susanna, Bel and the Prayer of Manasses have no Bible Strong passage and return `*_PASSAGE_NOT_FOUND`. Bible Strong's verse numbering for Tobit and Sirach follows its own editions, so a verse-level dictionary or Nave match there may differ from the KJV verse. Dictionary text links use OSIS names (checked in 13 ISBE entries: Tob, Sir, 1Esd, Bar, 1Macc, 2Macc, Wis, Jdt, Sus), which this app already maps by identity; `3Macc` and `4Macc` links stay unresolved because the KJV has no such books.

## Offline support

| Resource | Native offline | Evidence |
| --- | --- | --- |
| KJV text, 81 books | Supported | `bible:KJV` archive; verify script |
| Strong index (spans, concordance) | Supported | `bible-strong:KJV` archive; native schema check |
| Timeline text | Supported | `database:TIMELINE:en` and `:fr` (same English archive) |
| Strong definitions | Not supported | no `strong-lexicon:*` entry in the CyberJudah catalog |
| Teachings (commentary) | Not supported | no commentary archive |
| Cross references | Not supported | online endpoint only |
| Dictionary, Nave | Not supported | gateway to Bible Strong's public service; downloads stay behind upstream App Check |
| Timeline and people images | Not supported | `cyberjudah.io/api/img/…`, cached only if already viewed |

None of this has been accepted on a physical iPhone. The archive checks above ran on the
archives in the repository, not on a device.

## People and the class library: proposal

Placement is not approved. The field-by-field map and the six open choices are in the report
of 28 October (*People and Classes in Bible Strong*). Proposal, using existing surfaces only:

- **People, places, other names** go into Bible Strong's biblical entity: the people row at the end of each chapter and the entity profile with its family graph. `id` → `uniqueName`, `name` → `name`, Male/Female → `category: person` with type, Group → `category: group`, `description` → `description`, `verses` → chapter entities, father/mother/partners/siblings/children → `father`, `mother`, `partner`, `sibling`, `offspring` relations with their evidence kept in the overview text. Tribe, nation, line and "same person" go in labelled overview rows. Source: KJV-built catalog only; nothing from STEPBible.
- **Class notes and series:** nothing new for the first release; afterwards the reading-plan screens fit a series (plan → section → reading), if the owner chooses that.
- **Why no adapter here:** the app reads entities from the resource API (`/v1/strong-lexicon/entities/…`), which today answers "unavailable" from `bot/src/bs/strongs.ts`. The adapter belongs there, beside the other CyberJudah adapters, so the app keeps one source of truth. Adding a second copy in the app would duplicate it. Nothing in the app needs to change for people to appear once the API serves them and the module reports available, except the owner's choices on portraits and the Strong-word tap.

## Validation

Run from `apps/expo` unless noted, with Yarn 4.12.0:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types scripts/verify-cyberjudah-offline.mjs` | 81 books, 1,362 chapters, 36,821 verses, 320,356 spans; archives, schema, John 3:16 alignment and verse numbering verified |
| `yarn workspace @bible-strong/expo typecheck` (root) | passes |
| `yarn workspace @bible-strong/expo jest` (root) | 518 suites, 3,536 tests passing |
| `yarn eslint` and `yarn prettier --check` on every changed file | clean |
| `yarn agents:architecture:check` (root) | passes (448 existing warnings) |
| `yarn agents:styles:check` (root) | passes |
| `yarn resources:architecture:check` (root) | passes |
| Live source comparison (scripts kept outside the repository) | 0 chapter mismatches; lexicon complete; timeline revision reproduced |

Not run here: device builds, the iOS signing pipeline, web export, Firebase emulator tests and
the Postgres resource integration tests. None of these files is touched.

## iPhone checklist

Still needed on a physical iPhone with the signed build:

1. Rest of Esther 10: the verse picker shows 4–13; verse detail on 10:4 has no "previous verse" and 10:13 has no "next verse"; 10:11–13 open.
2. Any chapter with teachings (for example Psalms 109): tap a precept heading. The passage opens in the app, not in Safari. YouTube and class-note links still open outside.
3. Epistle of Jeremiah 1:3 opens from the "Baruch 6:3-6" precept link in Daniel 5.
4. Download the KJV, the Strong index and the timeline; turn on airplane mode; force quit; reopen. Reading, Strong spans and timeline text work. Strong definitions, teachings, cross references, dictionary, Nave and images show Bible Strong's existing unavailable states, not blank or invented content.
5. Search "Maccabeus" with the Old Testament filter: Apocrypha results appear, offline and online.
6. Timeline: 21 periods; open an American Captivity account and check its sources, and its uncertainty and "where sources disagree" sections where the account has them.
7. Dictionary or Nave on Tobit 1:1 and on Susanna 1:1: Tobit answers; Susanna shows the existing "not found" state.
