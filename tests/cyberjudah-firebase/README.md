# Staging Firestore rules tests

These tests use the official Firestore emulator at `127.0.0.1:8089`, with the demo project `demo-cyberjudah-port`. They never contact the live Firebase project.

Run in an isolated test directory with `@firebase/rules-unit-testing@5.0.0` and its compatible `firebase@12.4.0` peer dependency. Copy this test into that directory and set `FIRESTORE_RULES_PATH` to the absolute path of `apps/expo/firebase/cyberjudah/firestore.rules`, then run `node --test staging-rules.test.mjs`. This keeps the emulator SDK's Firebase 12 peer requirement separate from the Expo app's Firebase 13 runtime.

The eight tests cover owner-only notes, tabs and revisions; study ownership and queries; cross-account denial; isolation between production and staging; the server-owned subscription field; rejection of parent-only study deletion; server-only ownership records; deleted-ID reuse; and an unresolved historical ID whose parent was already recreated by another account. Quarantine blocks revision reads without assigning the historical content to that new parent owner.

`FIRESTORE_EMULATOR_HOST` may select another loopback port and `FIRESTORE_TEST_PROJECT` another `demo-` project. Non-local hosts and non-demo projects are rejected. These are candidate-rule tests, not proof of the deployed rule version or of historical ownership reconciliation. Legacy IDs without an ownership/quarantine record remain a release blocker until inventoried and reviewed.
