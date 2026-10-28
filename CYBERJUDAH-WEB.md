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
scripture as a guest; owner-account cloud writes have not been tested.

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

## Incomplete integration — not a release candidate

The upstream interface has been brought up; complete feature parity is not yet
verified. The current CyberJudah feed supplies KJV, classic Strong tags, Easton,
topics, cross references and CyberJudah commentary. It does not supply upstream
translations, aligned interlinear, enhanced entities or dated timeline events.
The remaining work includes:

- Configure the displayed catalogs to match available CyberJudah resources.
- Integrate CyberJudah's 81-book canon with upstream book names, ordering and
  request validators; do not silently relabel books 67–81.
- Complete commentary/reading-plan/media catalog integration and audit inherited
  external support, privacy, sharing and store links.
- Verify Firebase data/sync compatibility and port the approved account-linking
  behavior through the upstream controls. Shared Telegram/Ask balances are not
  integrated into this new preview.
- Validate narrow-screen behavior, offline behavior and signed native builds.

Staging and production have not been replaced with this port. The upstream native
signing/deployment configuration is not CyberJudah's release configuration. Do not
use the upstream publish or store-build workflows for CyberJudah. The first public
store release remains free reading/study; paid Ask is for a later update.
