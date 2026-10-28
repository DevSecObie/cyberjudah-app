# CyberJudah web port

This is the actual Bible Strong Expo web application, based on upstream commit
`1268f14e2691aa784c053655659bb4a0a23871cd` (28 October 2026), with its source history
and GPL-3.0 license retained. The workspace sidebar, tabs, Home, reader, passage
search, verse focus, fonts/themes, study popovers and account screens are the upstream
components. No replacement UI or new product screens have been added.

## Run locally

Use Node and Corepack with the pinned Yarn 4.12.0. From the repository root:

```sh
corepack yarn workspaces focus @bible-strong/expo
cp apps/expo/.env.cyberjudah.example apps/expo/.env.local
corepack yarn workspace @bible-strong/expo web
```

Open http://localhost:9090. The checked-in example contains only public Firebase
client configuration and the existing CyberJudah staging resource URL. No service
account key, signing key or payment credential is included. The preview reads
scripture as a guest; owner-account cloud writes require the device smoke check. The staging rules were tested against the official Firestore emulator and published with owner approval.

The web bundle can be exported with:

```sh
corepack yarn workspace @bible-strong/expo web:export
```

Output: `apps/expo/dist`. This command builds only; it does not deploy.

## Adaptations

- CyberJudah name in the existing sidebar and app title.
- CyberJudah Firebase project configured through the upstream environment inputs.
- Firebase Storage bucket is optional for projects using authentication without a
  configured bucket; no upstream bucket is substituted.
- Explicit CyberJudah resource profile maps the KJV Strong publication to
  `CYBERJUDAH`. Every response still passes the upstream schema and publication
  identity checks. Other datasets are rejected. Both web and native adapters use
  this mapping when that profile is enabled.
- Public reading boots without App Check. Protected downloads/assistant requests
  still initialize App Check on demand and fail closed without valid configuration.
- Analytics, Sentry reporting, the upstream study-assistant endpoint and automatic
  OTA updates are disabled in the local CyberJudah environment.

## Verified locally

- Original reader layout at desktop width with CyberJudah Genesis 1 and 2.
- Chapter navigation, Home, passage lookup for John 3:16, and verse focus.
- Tabs and selected passage survive reload.
- Cross-reference excerpts and dictionary discovery around John 3:16.
- Strong display, clickable G2316 and the original Greek-definition popover.
- Typecheck; targeted Firebase, App Check and Strong HTTP tests (36 passing); upstream styling
  guard; architecture guard (existing warnings); production web export and browser boot.

## CyberJudah integration

The version and book catalogs use the actual CyberJudah publication: KJV with all 81 books, correct Apocrypha IDs, published chapters and passage aliases. The existing reader, navigation, layouts, typography and controls remain upstream Bible Strong components.

Native offline reading uses a complete canonical archive with 36,821 verses in 1,362 chapters. Every chapter hash is checked against the published source. A compatible Strong index contains 320,356 verified spans. `node --experimental-strip-types apps/expo/scripts/verify-cyberjudah-offline.mjs` verifies both archives, the native index schema and a real John 3:16 alignment. Public archive exemptions are limited to these exact URLs and hashes. Other downloads retain App Check.

Firebase uses the existing CyberJudah project. Study sync is isolated in `staging_users`, `staging_studies` and `staging_users-status`, with owner-only access. The approved rules and both private Android staging certificate fingerprints were applied on October 28, 2026. No signing secret is checked in.

The existing profile controls include the staging account-link action. It reauthenticates Firebase, completes Telegram's signed browser flow, and links only the explicitly selected pair. A returning Telegram session can restore its server-issued Firebase identity; it cannot replace an already signed-in Firebase account. Tests cover account switches, stale responses, invalid link state, and sign-out during network failure. Linked identities resolve to the same backend Ask account; the first public store version remains free reading/study, with paid Ask deferred.

## Validation and staging builds

- Full Expo test suite: 511 suites, 3,486 tests passing.
- Expo typecheck and production web export pass.
- Architecture and shared-resource boundaries pass; original styling/surface guards pass.
- All three Firestore emulator access-control tests pass.
- Android CI builds an APK using the private staging signing key. A generated-config check prevents accidental use of upstream Firebase files.
- iPhone CI compiles an unsigned archive. The owner does not yet have Apple Developer membership, so an installable/TestFlight build cannot be produced yet. The signing input and export template are prepared in `apps/expo/firebase/cyberjudah/ios-signing/`.
- The hosting workflow is in `DevSecObie/cyberjudah-telegram`, draft PR #434. Only staging deployment is authorized.

## Content and release limits

CyberJudah currently publishes KJV, classic Strong tags, Easton, topics, cross references and its commentary. It does not publish Bible Strong's other translations, aligned original-language interlinear, enhanced entities or dated timeline events. The port must show existing unavailable states for those resources; it must not fabricate equivalents. Offline downloads offer only resources that are actually packaged; the browser keeps Bible Strong's upstream online behavior.

Physical-device sign-in, account sync, download/airplane-mode reading and Apple provider setup remain acceptance checks. Apple requires the owner's developer team, signing identity and App Store Connect setup before TestFlight. No production deployment, paid transaction, merge, or store publication is part of this staging work.

Bible Strong’s original dictionary catalog and lookup behavior are retained, including Easton + Webster, Smith, ISBE and Translation Words. Staging reads the original public dictionary service through its fixed dictionary gateway, preserving source attribution. Dictionary downloads remain subject to the upstream App Check configuration; only KJV and its Strong index are prepared for CyberJudah offline use. Search and commentary routing include books 80 and 81. CyberJudah staging omits upstream donation, referral and store-download links; the existing controls, reader and navigation remain Bible Strong’s.

The Expo dependency graph received same-major updates for protobufjs 7.6.6, shell-quote 1.12.0, tar 7.5.22 and websocket-driver 0.7.5. The four critical audit advisories are removed from that graph. High/moderate/low upstream dependency advisories remain for reachability review and upgrades before a public release; this is not a clean security clearance. The original GPLv3 license and source remain in the public fork.
