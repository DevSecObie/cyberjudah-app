# Store release checklist

One page for each App Store or Google Play release. Store submission is **on hold** until the
owner says the rebuilt app is ready. Then follow this once per release, top to bottom.

## Before the build

- [ ] The owner has tried the release on his phone from TestFlight and said it is ready.
- [ ] One version for the release: `APP_VERSION` and the build number are set once and match
      the release notes.
- [ ] The Deployment health issue is green for this repository and for cyberjudah-telegram
      (the store app reads cyberjudah.io).
- [ ] Release notes / "What to Test" written in plain words: what changed for the reader.

## Build and submit (Bible Strong's own flow)

- [ ] Build with the upstream EAS **production** profile in `eas.json`, on Expo's servers
      (not on the owner's Mac).
- [ ] Submit with `eas submit` (iPhone first, then Android), as Bible Strong does.

## Store listing

- [ ] Privacy policy: https://cyberjudah.io/app/privacy matches what this build collects.
- [ ] Review account: the App Review demo login still works.
- [ ] Screenshots and description match this build; no "IUIC" in the listing.
- [ ] Age rating and export-compliance answers unchanged, or updated on purpose.

## After release

- [ ] Record the build number and date in the release notes; any problem goes in cyberjudah-telegram `docs/INCIDENTS.md`.
- [ ] Keep the previous build available in TestFlight until this one has run a day without problems.
