# CyberJudah iPhone staging signing

The staging workflow compiles a real iPhone archive with signing disabled. This checks native compilation; an unsigned archive cannot be installed on an iPhone. No certificate, provisioning profile, App Store submission, or TestFlight upload is included.

## Ready in this repository

- Bundle identifier: `io.cyberjudah.app.dev`, already registered with Firebase.
- CyberJudah Firebase configuration and Google OAuth URL scheme.
- Sign in with Apple entitlement, background audio, tablet support and the original Bible Strong native interface.
- `CYBERJUDAH_APPLE_TEAM_ID` build input and export settings template.
- Build artifact: `CyberJudah-staging-iPhone-unsigned` in the staging workflow.

## Once the owner has Apple access

1. Enroll in the Apple Developer Program and accept Apple's agreements personally. This is required for TestFlight distribution.
2. Install full Xcode and add the Apple account in Xcode Settings → Accounts.
3. Register `io.cyberjudah.app.dev` in that Apple team; enable Sign in with Apple and Associated Domains. Register the same team ID in the existing Firebase iOS dev app. Configure Apple sign-in service credentials before claiming Apple login is ready.
4. Create a staging app record in App Store Connect using that bundle identifier.
5. Set `CYBERJUDAH_APPLE_TEAM_ID` to the actual team ID, regenerate the iOS project, and choose that team under Signing & Capabilities. Rebuild a signed Release archive in Xcode. Do not treat the unsigned CI zip as a signed installer.
6. Copy `ExportOptions.plist.example` outside source control and replace the team placeholder. Its destination is **export**, so using it does not upload or publish. Xcode can export a signed archive after the team, certificate and profiles are available.
7. With separate owner approval, upload the signed build through Xcode's Organizer to TestFlight. Install through TestFlight and test Google/Apple login, notes and highlights sync, guest reading, downloads and airplane-mode reading.

The first public store version remains free reading and study. Paid Ask and store purchases are deferred. Keep staging on the staging data namespace.

References: [Apple beta distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/), [Apple app signing](https://help.apple.com/xcode/mac/current/en.lproj/dev3a05256b8.html), [TestFlight](https://developer.apple.com/testflight/).
