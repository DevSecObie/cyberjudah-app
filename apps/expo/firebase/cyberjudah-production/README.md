# CyberJudah store app: Firebase file

The App Store app is `io.cyberjudah.app`. The beta (`io.cyberjudah.app.dev`) keeps using `../cyberjudah/`.

1. Firebase console, project `cyberjudah-app`, Project settings, Your apps, Add app, iOS.
2. Bundle ID `io.cyberjudah.app`, nickname `CyberJudah`. App Store ID can be added later.
3. Download `GoogleService-Info.plist` and save it in this folder.

The file holds the project's public client settings, like `../cyberjudah/GoogleService-Info.plist`; it is not a secret. `cyberjudah-ios-store.yml` stops if it is missing, and `verify-cyberjudah-native-config.mjs` checks that its bundle ID is `io.cyberjudah.app`.

If the Firebase API key is restricted to iOS apps, add `io.cyberjudah.app` to that list too.
