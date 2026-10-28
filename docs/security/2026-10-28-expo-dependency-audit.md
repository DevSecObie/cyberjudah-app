# Expo dependency audit, 2026-10-28

Scope: the `@bible-strong/expo` dependency graph (`yarn npm audit --recursive`, run from `apps/expo`) at
`codex/bible-strong-web-port` 958052f, and again after the in-range lockfile refresh in this change.

## Result

| Severity | Before (958052f) | After |
| -------- | ---------------: | ----: |
| Critical | 1 | 0 |
| High | 96 | 3 |
| Moderate | 84 | 30 |
| Low | 16 | 6 |

The handoff count (63 high) was taken earlier; advisories published since then raised it to 96 before this change.

The whole workspace (`yarn npm audit --all --recursive`, including site, world, API and resource-service)
went from 4 critical / 113 high to 3 critical / 23 high. Those remaining records are outside the Expo app
and are not part of the store release; they are listed as follow-up below.

## How the app ships

- Native (iOS/Android): a Metro JavaScript bundle plus native modules. Firebase on native is
  `@react-native-firebase/*` (native SDKs), not the JS SDK.
- Web: `app.config.ts` sets `web.output: 'single'`, so `expo export --platform web` produces a static SPA
  served from Cloudflare assets (`apps/expo/wrangler.jsonc`). No Node server code (`@expo/server`,
  `express`, `undici`) runs in production.
- Redux devtools: `redux-devtools-expo-dev-plugin` replaces itself with a no-op when
  `NODE_ENV === 'production'`, so `@redux-devtools/*` (immutable, lodash, nanoid) is not in release bundles.
  `jotai-devtools` is not imported by app code.

## Reachability of the 96 high + 1 critical records before this change

Shipped in the release bundle and plausibly reachable:

- `zod` 4.6.5 via `@assistant-ui/react` (Ask UI). Memory exhaustion when validating oversized constrained
  collections. Reachable only if Ask parses untrusted oversized payloads; paid Ask is deferred for the first
  release, but the code is bundled. Fixed: 4.6.7.

Shipped dependency, not reachable in the app:

- `@grpc/grpc-js` via `@firebase/firestore` (JS SDK). gRPC is only used by the Node build of Firestore; the
  browser and React Native builds use WebChannel. Lockfile moved 1.9.15 to 1.9.16 (fixes two of the three
  records). The third (`getAuthContext`, fixed in 1.13.6) cannot be fixed inside Firestore's `~1.9.0` range
  and is not reachable.

Development only (devtools, removed from production bundles):

- `immutable`, `lodash` (`_.template`), `nanoid` via `@redux-devtools/*`. Refreshed anyway.
- `jsondiffpatch` 0.5.0 via `jotai-devtools`: fix needs 0.7.6, outside the `^0.5.0` range. Not imported by app
  code. Remains.

Build tooling and local dev servers (Expo CLI, Metro, Babel, ESLint, Tailwind/PostCSS, Vite, i18n parser,
Sentry CLI, React Native CLI). These run on the developer machine or CI, never on a user's device:

- `proxy-addr` (critical), `express`, `body-parser`, `path-to-regexp`, `compression`: Expo/Metro dev servers.
- `undici` 6/7/8, `ws` 7/8, `http-cache-semantics`, `ip-address`: Node networking in Expo CLI, Metro,
  `@sentry/cli`, `cheerio`, `@effect/platform-node`.
- `@xmldom/xmldom`, `node-forge`: Expo config plugins (`@expo/plist`) and code-signing certificate tooling.
  On-device update signature checks are native code in `expo-updates`, not `node-forge`.
- `brace-expansion`, `@isaacs/brace-expansion`, `minimatch`, `picomatch`, `js-yaml`, `flatted`,
  `browserslist`, `joi`, `postcss`, `source-map-js`, `vite`, `@babel/plugin-transform-modules-systemjs`.
- `zod` 3.25.76 via `@expo/cli` and `eslint-plugin-react-compiler`: no 3.x fix exists (fixed only in
  4.6.6). Build tooling only. Remains.

## What changed

Lockfile only. `yarn up -R` refreshed each affected package to the newest version allowed by the ranges
already declared by its dependents. No `package.json` range, resolution or patch changed, and no package
crossed a major version.

## Remaining (3 high, Expo graph)

| Package | Path | Why it stays |
| ------- | ---- | ------------ |
| `@grpc/grpc-js` 1.9.16 | `firebase` JS SDK, Firestore | Fix is 1.13.6, outside Firestore's `~1.9.0`; Node-only code path, not in the app bundle |
| `jsondiffpatch` 0.5.0 | `jotai-devtools` | Fix is 0.7.6, outside `^0.5.0`; devtools not imported by app code |
| `zod` 3.25.76 | `@expo/cli`, `eslint-plugin-react-compiler` | No 3.x fix; build tooling only |

## Follow-up (not in this change)

- Other workspaces still carry 3 critical and 23 high records, none in the Expo app graph:
  `protobufjs` 6.11.6 via `@grpc/proto-loader` (critical; `google-gax`, API functions), `tinypool` 1.1.1 via
  `vitest` (critical x2, test runner), `undici` 7.29 and `sharp` via `miniflare`/`apps/world`,
  `extract-zip`/`follow-redirects` via Puppeteer/Chromium tooling, `dicer`, `basic-ftp`, and `lodash` 4.17.23
  via `metascraper-logo`. Fixing them needs major upgrades or tooling changes outside this release; review
  them before any of those workspaces is deployed for CyberJudah.
- `jotai-devtools` could move to a release that depends on `jsondiffpatch` 0.7.6+, or be dropped if unused.

## Validation run for this change

- `yarn npm audit --recursive` in `apps/expo` before and after (counts above).
- `yarn install --immutable` passes with the new lockfile.
- `yarn workspace @bible-strong/expo typecheck` passes (needs `NODE_OPTIONS=--max-old-space-size=8192` on a
  16 GB machine; the default heap ran out of memory).
- `yarn workspace @bible-strong/expo test`: 513 suites, 3,489 tests passed.
