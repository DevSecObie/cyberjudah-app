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
