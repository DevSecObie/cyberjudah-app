# CyberJudah native app parity

Updated 5 November 2026. The product baseline is the Bible Strong native iPhone app, followed by Android. Retain the upstream flows, layouts, gestures and public route contracts. Use CyberJudah’s publications, accounts, course content, API, storage and update service. Telegram account linking remains parked.

## Baseline and release decision

Apple’s US listing reports Bible Strong 28.0.2. Use upstream source revision `62bf039e528bca7bd0a02e649902d4820fbed5ae` as the reference for that version. The fork revision inspected was `bf807626023654550a82c20b7908b18a0cda46e3`. A trial merge into that revision reported 46 conflicted paths, including the reader’s study links, maps, resource contracts and CyberJudah timeline assets. Keep CyberJudah asset IDs, book numbering, Firebase UIDs and local note IDs throughout reconciliation. Test native flows against a phone running the upstream release.

Build 311’s App Store submission was marked Removed. The replacement remains on hold. This branch carries the 28.0.2 native startup dependency fixes, two verified Nave publications, direct class-link loading and native sharing to CyberJudah’s web app.

## Evidence and remaining work

| Native surface | CyberJudah implementation and release test |
| --- | --- |
| Reader, tabs, navigation, verse actions and parallel reading | Use the existing Expo reader, sheet controls and tab stack. Validate a clean install, tab switching, verse selection, context menus, parallel reading with supported editions, and every book in the picker. The KJV data verification covers 81 books, 1,362 chapters and 36,821 verses. |
| Hebrew/Greek, Strong’s, interlinear and maps | The fork has the BHG text, English interlinear archive, Strong index and entity data. The live online BHG coverage route returned 404 with INTERLINEAR_UNSUPPORTED. Compare online and downloaded word taps, definitions, concordance, related entries, people, places, maps and map navigation. |
| Dictionary, encyclopedia, Nave, commentaries and cross-references | Production returned the Easton work alone and a CyberJudah topic publication for Nave. Staging used the original Nave edition through an external proxy. Keep Easton + Webster and the original Nave entries distinct from local editorial material. Complete the dictionary directory and search indexes, topic and verse links, encyclopedia and commentary editions. Verify verse-ID mappings in the Apocrypha. |
| Free Note, highlights, bookmarks, study editor and published studies | Exercise the original note and study creation gestures, editing, deletion, tagging and links. Verify guest data, offline edits, relaunch, account adoption, two-device reconciliation, and reader-specific Firestore access. Existing Firebase project is cyberjudah-app. |
| Profile, onboarding, backups and migration | Test Apple, Google and email sign-ins through the native sheets. Confirm linked providers shown, sign-out, reinstall, account recovery, backup/restore and old-data migration. Use staging accounts and collections. |
| Reading plans, daily reading and audio | Inventory every upstream entry point including progress, reminders, background playback, downloads and language selection. Match catalog entries to hosted CyberJudah material with provenance; run lock-screen and airplane-mode checks. |
| Search, timeline, people, places and home | Verify search filters, offline results, relationships and source links. Check timeline rows, date controls, horizontal and vertical pan across all periods. Verify portraits in each context. Compare home cards, widgets and resumed activity with the upstream phone. |
| Classes, transcripts, course notes and media | Open the same class from home, search, history and an Ask citation in a clean install. The player now requests the shared class catalog on a direct link. Verify playback inside the app at the cited second and offline index interruption/restart. Class videos currently embed YouTube; self-hosted playback needs CyberJudah’s source recordings and authorized hosting. |
| Ask and AI | Retain source thumbnails, custom progress, transcript timecodes, citations and related scriptures. Exercise a factual question, follow-up, and recovery on interruption. Verify CyberJudah’s server owns retrieval and credentials and that doctrine is grounded in cited teaching. |
| Public links, saved links and sharing | The candidate uses the environment’s CyberJudah web origin for reader, Strong and editorial shares. Follow a copied link in a fresh browser. Separate pending app PRs 65 and 69 concern owned link previews; select one after integration testing. |
| Offline delivery, account services and operations | Verify ownership of release and staging origins, storage, database, content indexes, auth providers, Firestore rules, notification credentials, telemetry, and update-signing keys. Trace content fetches from both the gateway and resource service with upstream hosts blocked. Test timeouts, corrupt archives and interrupted downloads. |
| Public site, World and external experiences | Track the monorepo’s separate site, World and study-assistant service wherever the native app launches them. Before enabling a destination, verify a CyberJudah service, a working return path and its editorial data. |

## Original Nave on CyberJudah infrastructure

Resource Studio rebuilt the English and French publications using the source archive locations in its mobile inventory and the metadata in `apps/resource-studio/config/resource-publications/nave-{en,fr}.json`. The validated manifests preserve Orville J. Nave’s attribution. Each language contains 5,313 topics, 30,896 verse or chapter indexes and 141,448 topic references.

| Language | Canonical revision | Example |
| --- | --- | --- |
| English | nave-en-a3ca283196d0eb084276 | Hebrews 11:1 → Faith and Hope |
| French | nave-fr-358b8cf8a5e5f48554de | The stable faith topic opens La foi |

The two ZIPs in the Expo public offline directory are server assets requested by the Downloads screen. The catalog records both the ZIP and SQLite hashes. The offline verifier checks database integrity, topic counts, and the Hebrews 11:1 link in both languages.

The native monorepo contains the upstream Resource service and publishing tools. The tested local configuration uses PostgreSQL 17 with pgvector, imports the validated bundles, then serves the upstream HTTP contract. Run the Resource service’s documented migration, `resources:import --bundle` for each language, and `smokeNaveResourceService.mjs` with the owned origin in RESOURCE_API_BASE_URL. For hosted staging, set up CyberJudah’s own database connection and artifact storage. The stock wrangler.jsonc points to Bible Strong’s domains and account resources; keep those out of the CyberJudah deployment. The separate gateway draft adds the REFERENCE_PUBLICATIONS private binding and REFERENCE_HOSTING=self-hosted.

For the combined dictionary, the legacy English public archive contains 8,620 headwords. The normalized distribution requires a publisher-authorized package or a reproducible import with the reference Bible corpora and cross-dictionary indexes. Check work identity, revision, counts, attribution, verse links, and CyberJudah’s existing editorial exclusions before activation. The legacy archive alone has not been verified as the production edition.

## Acceptance on the next signed iPhone build

Record the upstream version, candidate commit, iOS version and device for each run. Compare the same route and gesture side by side. Capture a clean launch, an upgrade preserving a study, account recovery, reader and Free Note actions, online/offline navigation, class playback and an Ask citation. Save traces showing owned content and backend origins throughout. A web screenshot or green export alone cannot establish mobile parity. Recheck on Android when its build enters device testing.

[Upstream mobile source](https://github.com/smontlouis/bible-strong/tree/62bf039e528bca7bd0a02e649902d4820fbed5ae) · [Apple listing](https://apps.apple.com/us/app/bible-strong-learn-and-study/id1454738221) · [Resource gateway draft](https://github.com/DevSecObie/cyberjudah-telegram/pull/534)
