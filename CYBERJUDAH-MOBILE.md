# CyberJudah mobile release baseline

The iPhone and Android branch uses Bible Strong’s released mobile interface, including **Free mode** and **Focus** in the selected verse’s Annotate toolbar. It does not use the 28.x development home/navigation redesign. The web staging branch remains separate.

## Provenance

- Mobile source: `smontlouis/bible-strong` commit `cda1eb4c96b32095129dee029cda704c621a13fa` (27.2.0, October 11, 2026).
- Apple’s public listing reports 27.2.0, released October 12. The owner’s installed Bible Strong app was observed through iPhone Mirroring and its Free mode toolbar matches this source.
- The exact commit submitted by Bible Strong to Apple is not published; this is verified release-era source, not a claim of binary-to-commit provenance.
- CyberJudah build 301 used upstream `1268f14e2691aa784c053655659bb4a0a23871cd` (28.0.1 development). Build 302 is held from distribution despite passing CI.
- CyberJudah retains its own product version 28.0.1 for TestFlight continuity; this candidate is iPhone build 303 / Android 515, using Expo 57 / React Native 0.86.3.

## Port boundaries

The original native reader, verse annotation sheet, notes and navigation remain unchanged. The home and settings retain the released native controls and layout. Their content sources, support links and product identity use CyberJudah. Bible Strong’s dictionary and Nave are retained; CyberJudah provides the Bible publication and timeline. Unpublished editorial resources are not fetched.

Firebase remains `cyberjudah-app`, with owner-only staging collections. The verified Firebase providers appear within the existing native profile card controls. Telegram linking is temporarily parked; its backend account associations and balances are untouched. Apple and Google identities are not silently merged; cross-device sync requires the same Firebase account.

The installed testing build’s account recovery, Firestore outbox, study sync and persistence formats are carried forward. The newer saved tab fields remain readable. No reset or purge is part of this update. The Downloads catalog filter and merge-safe migration checkpoint fix are included.

## Distribution and validation

The branch workflows build signed staging artifacts only. Upstream production workflows are repository-guarded and OTA delivery is disabled for CyberJudah. No merge or public release is authorized. Upload to the existing owner-only TestFlight group follows CI success, independent signing/package verification and mobile interface checks.

Required physical checks: Free mode from the verse toolbar; Downloads opens without the missing-catalog crash; Apple and Google sign-in indication; same-account study/annotation sync; relaunch and offline preservation. Automated checks do not establish these physical-device results.

## People, places and other names

Bible Strong's chapter people row, entity profile and family tree read its downloadable People module (`strong-lexicon:entities`). Bible Strong's own module is built from STEPBible/TIPNR, so CyberJudah publishes its own: `apps/expo/scripts/build-cyberjudah-entities.mjs` builds `public/offline/bible_entities.cyberjudah.sqlite.zip` in the same schema from `DevSecObie/cyberjudah` `data/{people,places,other}-kjv` (4,081 people, 1,274 places, 47 other names; every verse reference and family link as published, with the catalog's own evidence labels; coordinates only where a place has a pin). It records its source commit in `EntityMeta` and adds its checksums to the CyberJudah offline catalog.

The CyberJudah module names no Strong entries, so it stands alone: `requiresStrongLexiconCore` keeps it from depending on Bible Strong's lexicon core (STEPBible-derived), which CyberJudah does not publish. Its references use Bible Strong's book codes for books 1–66 and `src/assets/cyberjudah/entity-book-codes.json` adds the Apocrypha (67–81). Bible Strong builds are unchanged.

The archive is served from the staging web host with the other offline archives, so it is downloadable after the next staging deployment.
