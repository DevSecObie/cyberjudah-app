# CyberJudah iPhone staging signing

Apple membership was verified active on 2026-10-28. Team: `M8DUMWBXLH`. The staging app is `io.cyberjudah.app.dev`, already registered in Firebase.

`cyberjudah-ios-signed.yml` is an export-only build: it compiles on GitHub’s macOS runner, signs the archive with the approved staging assets, verifies the signature and exports an IPA. It does not upload to App Store Connect, submit for review or publish. An App Store-signed IPA is intended for a later authorized TestFlight upload, not direct device installation.

## Signing assets

The owner approved the staging App ID, distribution certificate, App Store profile and encrypted CI secrets on 2026-10-28. All three Apple resources were created and the profile verified with Sign in with Apple, Associated Domains and production App Attest. Certificate and profile expire 2027-10-28. Keep the private key and P12 password outside source control. The workflow reads only these encrypted repository secrets:

- `IOS_STAGING_CERTIFICATE_BASE64`: the distribution certificate and matching private key in a password-protected P12.
- `IOS_STAGING_CERTIFICATE_PASSWORD`: that P12 password.
- `IOS_STAGING_PROFILE_BASE64`: the App Store profile for `M8DUMWBXLH.io.cyberjudah.app.dev`.

The preflight rejects a different team, bundle ID, expired profile, device/development profile or missing capabilities. It sets signing only on the application target, leaving Pods’ target settings intact. The keychain is temporary and removed at job completion; signing files are not artifact outputs.

Run the signed workflow on the reviewed signing branch after the secrets are configured. Continue to use the unsigned staging workflow for compile-only checks. App Store Connect app creation, Apple provider credentials, TestFlight upload and physical-device acceptance remain separate steps; do not report them complete from a successful archive alone. The first public store release is free reading and study.

References: [GitHub’s certificate and profile setup](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications), [Apple manual signing](https://help.apple.com/xcode/mac/current/en.lproj/devcac6ab5b3.html), [Apple TestFlight distribution](https://help.apple.com/xcode/mac/current/en.lproj/dev2539d985f.html).
