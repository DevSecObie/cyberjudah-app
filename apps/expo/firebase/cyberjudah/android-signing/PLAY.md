# CyberJudah on Google Play

`cyberjudah-android-store.yml` builds the Google Play app, `io.cyberjudah.app`, on the production servers (`.env.cyberjudah.production.example`), with purchases off. It starts with each release merge (and can be started by hand), but it runs inside the `play-store` environment, so nothing is signed until the owner approves the run. It produces a signed App Bundle (`.aab`) as a run artifact and uploads nothing to Google.

Google holds the key that signs the app on phones (Play App Signing). The key in this workflow is only the **upload key**: it proves an upload came from us. If it is ever lost or leaked, Google can reset it; the app is not lost.

## What the owner sets up (credentials are entered only by the owner)

### 1. Make the upload key on the Mac (once)

In Terminal:

```bash
mkdir -p ~/Desktop/CyberJudah-Mobile/play-upload-key && cd ~/Desktop/CyberJudah-Mobile/play-upload-key
openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes -subj "/CN=CyberJudah Upload" -keyout upload-key.pem -out upload-cert.pem
openssl pkcs12 -export -name cyberjudah-upload -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -inkey upload-key.pem -in upload-cert.pem -out cyberjudah-upload.p12
```

The last command asks for a password twice. Pick a long one and keep it in your password manager. Then keep `cyberjudah-upload.p12` safe (for example a copy on the NAS) and remove the loose key: `rm upload-key.pem`.

The name `CyberJudah Upload` and the alias `cyberjudah-upload` must stay as written: the workflow checks both.

### 2. GitHub environment and secrets

GitHub, cyberjudah-app, Settings, Environments, New environment `play-store`:

- Required reviewers: yourself.
- Environment secrets:
  - `ANDROID_UPLOAD_KEYSTORE_BASE64`: run `base64 -i cyberjudah-upload.p12 | pbcopy` in the same folder, then paste.
  - `ANDROID_UPLOAD_KEYSTORE_PASSWORD`: the password from step 1.

### 3. Play Console app

Play Console, Create app: name **CyberJudah**, default language English (United States), App, Free. Accept the declarations.

### 4. Build and first upload

Approve the waiting "CyberJudah signed Android store build" run in GitHub Actions (or start it by hand from the release branch). When it finishes, download the `CyberJudah-Google-Play-<number>` artifact and unzip it.

Play Console, CyberJudah, Testing, Internal testing, Create new release. Accept Play App Signing when asked, upload `app-release.aab`, and save. The first upload registers the upload key.

### 5. Testers

Internal testing, Testers: create an email list (up to 100 Google accounts), save, and send the opt-in link to the testers. Each tester opens it on an Android phone signed in with that Google account, then installs from Play.

### 6. Fingerprints for Google sign-in and App Check

Play Console, Test and release, App integrity, App signing: copy the **SHA-1** and **SHA-256** of both the app signing key and the upload key.

- Firebase console, cyberjudah-app, Project settings, Your apps, Android app `io.cyberjudah.app`: Add fingerprint, all four.
- Firebase console, App Check, Apps, `io.cyberjudah.app`: register Play Integrity with the app signing key's SHA-256.
- Play Console, App integrity, Play Integrity API: link the Google Cloud project `cyberjudah-app`.

Without this, Continue with Google and offline copies fail on Android. No new build is needed after adding them.

### 7. Store listing items (before any wider test)

App content: privacy policy `https://cyberjudah.io/app/privacy`, data safety, content rating questionnaire, target audience, ads (none), account deletion URL `https://cyberjudah.io/app/delete-account`. Store listing: short and full description, icon 512x512, feature graphic 1024x500, at least two phone screenshots.

## Rules of the road

- A new personal developer account must run a **closed test with at least 12 testers for 14 days in a row** before Google allows a production release. Internal testing has no such rule.
- Each run gets a new, higher version code (1000 + the run number), so every upload is accepted.
- The staging APK from `cyberjudah-staging-builds.yml` uses the same package name with a different key. A phone that has it must uninstall it before installing from Play.
