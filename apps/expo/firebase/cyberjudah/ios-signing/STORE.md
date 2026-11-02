# CyberJudah store app signing

`cyberjudah-ios-store.yml` signs the App Store app, `io.cyberjudah.app`, on the production servers (`.env.cyberjudah.production.example`). It runs only when started by hand from the Actions tab, inside the `app-store` environment, and exports an IPA without uploading it.

## What the owner sets up (credentials are entered only by the owner)

1. Apple Developer, Identifiers: register `io.cyberjudah.app` with Sign in with Apple, Associated Domains and App Attest, the same capabilities as the beta.
2. Apple Developer, Profiles: an App Store distribution profile for `io.cyberjudah.app`, using the existing Apple Distribution certificate.
3. App Store Connect: a new app named CyberJudah with that bundle ID. The beta record (CyberJudah Beta) stays for testers.
4. GitHub, cyberjudah-app, Settings, Environments: create `app-store`, add yourself as a required reviewer, and add three environment secrets:
   - `IOS_PRODUCTION_CERTIFICATE_BASE64`: the same distribution P12 as the beta, base64.
   - `IOS_PRODUCTION_CERTIFICATE_PASSWORD`: its password.
   - `IOS_PRODUCTION_PROFILE_BASE64`: the new profile, base64.

`prepare-ios-signing.py` accepts only the beta and store bundle IDs, and refuses a beta profile for the store build. `verify-cyberjudah-bundle.mjs` checks the store build against its own settings file.
