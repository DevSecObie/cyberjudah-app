# Staging Firestore rules tests

These tests use the official Firestore emulator at `127.0.0.1:8089`, with the demo project `demo-cyberjudah-port`. They never contact the live Firebase project.

Run in an isolated test directory with `@firebase/rules-unit-testing@5.0.0` and its compatible `firebase@12.4.0` peer dependency. Copy this test into that directory and set `FIRESTORE_RULES_PATH` to the absolute path of `apps/expo/firebase/cyberjudah/firestore.rules`, then run `node --test staging-rules.test.mjs`. This keeps the emulator SDK's Firebase 12 peer requirement separate from the Expo app's Firebase 13 runtime.

The tests cover owner-only notes, tabs and revisions; study ownership and queries; cross-account access denial; and isolation from production documents. All three tests passed against the prepared rules before the owner authorized publication on October 28, 2026.
