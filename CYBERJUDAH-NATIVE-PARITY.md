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
| Dictionary, encyclopedia, Nave, commentaries and cross-references | Both environments now serve original Nave from CyberJudah infrastructure. Production also serves the existing CyberJudah teaching topics on their original links. The production dictionary currently lists Easton. Complete the combined dictionary and search indexes, encyclopedia and commentary editions. Verify verse-ID mappings in the Apocrypha. |
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

CyberJudah’s [staging PostgreSQL 17 project](https://console.neon.tech/app/projects/still-feather-50015410) in AWS US West (Oregon) holds both publications in `cyberjudah_resources_staging`. The publisher runs the Resource service migrations and `resources:import --bundle` separately for each language. The `cyberjudah_nave_reader` role has SELECT on `resource_publications`, `nave_topics`, and `nave_verse_links`. Cloudflare Hyperdrive uses this role, verifies the Neon host against ISRG Root X1, and disables SQL result caching.

The private Worker uses `packages/resource-service/wrangler.cyberjudah-staging.jsonc`. Deploy that explicit config and run `scripts/smokeNaveResourceService.mjs` through its private service binding before switching the staging gateway to `REFERENCE_HOSTING=nave-self-hosted`. The gateway preserves CyberJudah's book numbering. After a release, check both Hebrews 11:1 responses through `/bs/v1/naves/{en,fr}/verses/58-11-1/topics`, the self-hosting response header, the original dictionary catalog, and app startup. To roll back routing, restore the previous staging gateway version. Publications and Firebase user data have separate lifecycles.

For the combined dictionary, the legacy English public archive contains 8,620 headwords. The normalized distribution requires a publisher-authorized package or a reproducible import with the reference Bible corpora and cross-dictionary indexes. Check work identity, revision, counts, attribution, verse links, and CyberJudah’s existing editorial exclusions before activation. The legacy archive alone has not been verified as the production edition.

### Production publication and rollback

The [production PostgreSQL project](https://console.neon.tech/app/projects/sparkling-mouse-68843135) is separate from staging and uses the Neon Free plan. Both canonical revisions above were imported into `cyberjudah_resources_production`. The production Hyperdrive pool verifies the database hostname and uses a dedicated reader role with SELECT on the three publication tables. Firebase accounts and user collections are outside that role’s scope.

The private production deployment uses `packages/resource-service/wrangler.cyberjudah-production.jsonc`. Its verified version is `91896352-1e00-4142-9343-d18e6ed60b23`. The public Worker `cyberjudah-nave-production` version `f2ec01da-1178-427d-a925-f36504ab80d6` serves only `cyberjudah.io/bs/reference/v1/naves/*`. The app setting `EXPO_PUBLIC_NAVE_API_URL=https://cyberjudah.io/bs/reference` selects this service for Nave. Other resources keep their existing base URL.

On 5 November 2026 both online editions passed the public checks for topic detail, search, pagination, random topics, Hebrews 11:1, and a missing topic. The mobile data schemas accepted the responses. For each language, the public API returned all 5,313 topic IDs, titles and initials across 11 pages and matched the downloadable SQLite edition. The legacy index and all 71 topic detail hashes matched the pre-release snapshot. [Original English Faith](https://cyberjudah.io/bs/reference/v1/naves/en/topics/faith), [original French La foi](https://cyberjudah.io/bs/reference/v1/naves/fr/topics/faith), and [CyberJudah’s Faith](https://cyberjudah.io/bs/v1/naves/en/topics/faith) resolve separately.

Run `node bot/scripts/verify-owned-nave.mjs https://cyberjudah.io/bs/reference/v1/naves/` in the gateway repository after changes. If this first release must be withdrawn, remove just the new pattern from the publication Worker's routes and apply its triggers. Retain the database, private Worker and previous topic gateway while investigating. For subsequent releases restore the last verified Worker version and rerun the same checks.

On 5 November 2026 both production and staging catalogs delivered the checked English and French offline ZIPs. Each ZIP and its extracted database matched the native release SHA-256 values. Each database passed SQLite integrity checks and returned its own Faith article from the Hebrews 11:1 lookup. The staging iPhone app downloads its copies from the staging host. Physical iPhone acceptance in airplane mode is the remaining offline release check.

## iPhone build and device acceptance

The [first native staging archive](https://github.com/DevSecObie/cyberjudah-app/actions/runs/42082746095) exposed a NitroModules 0.37.2 Swift module import failure on React Native 0.88. Nitro’s version macros are consumed only in its C++ implementation. The Yarn patch moves the version-header import there and exports the renderer header referenced by its public headers.

The [replacement signed staging build](https://github.com/DevSecObie/cyberjudah-app/actions/runs/42096970714) on commit `7e9db9c935eaecab1f037ee233e69fcafa7782d6` passed the app tests, Xcode Release archive, code-signature check, bundle settings check and export. The downloaded artifact matched GitHub's digest. Independent verification of its IPA confirmed the deep code signature, Apple sign-in entitlement, CyberJudah staging Firebase identity, and both canonical Nave revisions in the bundle. Version 28.3.0 (311), minimum iOS 16.4, bundle ID `io.cyberjudah.app.dev`, IPA SHA-256 `e17fcac1dbad5a067fdd2e4895336012db3d18ba96da03e5326d0878cf441ed5`. This run produced a GitHub artifact. TestFlight distribution and physical-device acceptance are separate steps.

Apple already had a different beta numbered 311. The [signed build 312](https://github.com/DevSecObie/cyberjudah-app/actions/runs/42117094085) uses commit `c2b888cc5164c5b1ff64ea1942257b50f646478f`. Its IPA SHA-256 is `8d01c5c6abacfea6135b1249133ee6e09227660b142885e0969c94a4eadf9eb0`. The downloaded IPA passed independent signature, provisioning profile, Firebase identity, and English/French catalog checks. Apple received CyberJudah Beta 28.3.0 (312) at 3:09 p.m. Pacific on 5 November 2026 and finished processing it.

For the physical iPhone test, update to build 312 and download both Nave editions in Download manager while online. Turn on Airplane Mode, turn off Wi-Fi, and fully quit and reopen the app. Open the Nave topic list, use its language filter and search for **Faith** in English and **La foi** in French. Open each article. Record the iOS version, device model, and whether each search and article opens offline.

Record the upstream version, candidate commit, iOS version and device for each run. Compare the same route and gesture side by side. Capture a clean launch, an upgrade preserving a study, account recovery, reader and Free Note actions, online/offline navigation, class playback and an Ask citation. Save traces showing owned content and backend origins throughout. A web screenshot or green export alone cannot establish mobile parity. Recheck on Android when its build enters device testing.

[Upstream mobile source](https://github.com/smontlouis/bible-strong/tree/62bf039e528bca7bd0a02e649902d4820fbed5ae) · [Apple listing](https://apps.apple.com/us/app/bible-strong-learn-and-study/id1454738221) · [Resource gateway draft](https://github.com/DevSecObie/cyberjudah-telegram/pull/534)
