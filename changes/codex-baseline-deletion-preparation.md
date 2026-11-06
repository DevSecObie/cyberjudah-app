# Baseline deletion preparation — not deployable

This draft starts from mobile release `b36333cd`, not the broader Worker deletion
PR. It retains Bible Strong's Auth-trigger recursive cleanup and retry policy.

Changes:
- Use the deployed Firebase configuration instead of the legacy project's bucket.
- For `cyberjudah-app`, clean both app scopes and status records, excluding `tg_`
  identities. Staging cleanup cannot remove a production preview with the same ID.
- Stop native account deletion when publication removal fails, after provider
  confirmation and recent authentication rather than before them.
- Follow the upstream client flow: delete Firebase Auth and let its onDelete
  handler perform recursive private-data cleanup. Remove the separate client
  Firestore traversal. This branch must not ship before the trigger is verified.

Validation on Node 22.23.4: 44 focused API/native tests pass with no TODOs,
plus four real Firestore emulator tests pass against the repository's CyberJudah
rules. API SDK typecheck and TSLint pass. Full Expo typecheck, targeted ESLint,
and five deletion Jest tests now pass with installed workspace dependencies. The emulator verifies late-revision
retry, a client write racing finalization, replacement-owner descendant safety,
and more than 400 descendants including missing intermediate parents.

CyberJudah study cleanup still traverses descendants from the Auth trigger. Each
bounded deletion batch transaction checks the original parent's updateTime.
The final transaction checks the parent and the client-writable revisions query
before deleting the parent. Late revisions leave the study discoverable for the
existing Auth-trigger retry. No new persistent records or retention policy were
introduced. The upstream implementation remains the fallback for other projects.

Run with the repository dependencies installed:

```sh
node --test apps/api/functions/tests/*.test.mjs apps/expo/scripts/test-account-deletion-baseline.mjs apps/expo/scripts/test-publication-account-cleanup.mjs
firebase emulators:exec --only firestore --project demo-cyberjudah-deletion --config firebase.deletion-test.json "node --test apps/api/functions/tests/emulator/study-cleanup.test.mjs"
```

Remaining implementation/verification:
- The tested study/revision races are fixed. This is not a proof against arbitrary
  privileged writes or writes after account deletion. Profile-subtree cleanup
  still uses upstream recursive deletion; stale clients/custom tokens can recreate
  account data under the current rules. Verify the writer and re-enrollment paths.
- Preview deletion now requires matching custom metadata `ownerUid` and `studyId`,
  and enforces both GCS generation and metageneration preconditions. Untagged or
  differently owned objects stop cleanup without being deleted. Existing-object
  inventory and trusted metadata-writer verification remain required; no metadata
  was backfilled or ownership inferred from Firestore IDs. Live Storage inspection
  on November 6 is complete: Firebase Storage shows Get started and the authorized
  Google Cloud console shows no live buckets for cyberjudah-app. If deployment has
  no configured bucket, preview cleanup now skips Storage access rather than
  inventing a target. This does not inventory soft-deleted buckets or other projects.
- The client now calls both existing publication stores, then native-only unlink
  on both Workers. It captures the UID, rejects account switches, and blocks Auth
  deletion if any call fails. Backend companion branch:
  `codex/baseline-native-unlink-20261106` in cyberjudah-telegram. It must be verified
  and deployed to both Workers before the client ships. Six Workers/D1 tests and
  sixteen identity/unlink tests pass; Telegram wallets/chats/publications and other
  users' links/device grants survive. Both Workers have independent hash keys.
- Post-deletion profile writes and already-authorized publish/link requests still
  need a final policy and implementation. The user has been asked whether to allow
  delayed server cleanup without deletion records, or require immediate cleanup
  with temporary records. No answer is assumed. Neither delay nor records have
  been implemented. A delay alone is not proof of safety: custom-token recreation,
  profile provisioning, and final cleanup of external stores must also be verified.
- Verify actual staging file usage before declaring file cleanup complete.
- Deploy and verify the reviewed Auth trigger before shipping the client switch.
- Add an isolated explicit CyberJudah deployment configuration; existing
  `.firebaserc` remains `bible-strong-app`. Never use the broad package deploy
  command or deploy unrelated functions. Verify runtime/project/bucket first.
- Full Expo test suite, native/offline tests, and deployed acceptance remain outstanding.
  The four study-tree emulator tests supplement the mocked API/native tests.
- Firebase runtime and API engine now target Node 22, tested locally. Node 20
  was decommissioned October 30, 2026. This does not change the legacy default
  Firebase project; explicit isolated deployment remains required.
  Source: https://cloud.google.com/functions/docs/runtime-support

Billing was rechecked after the user's payment: Firebase now displays Blaze and
Functions Get started; CyberJudah remains linked to Firebase Payment. No payment,
billing mutation, deployment, rules change, retention change, PR merge, or build
was performed by this draft. Build number remains unchanged.

Upstream comparison was repeated directly against `smontlouis/bible-strong`:
`apps/expo/src/features/profile/components/DeleteAccountModal.tsx` calls
`deleteCurrentAuthUser()` after typed confirmation, then logs out.
`apps/api/functions/src/users.ts` supplies Auth onDelete cleanup with retry policy.
CyberJudah retains its existing Apple revocation and Worker-publication prerequisite;
the Auth-trigger design remains upstream's, with scoped collections and the
transactional study traversal needed for CyberJudah's revision history.

Additional backend source verification at main `3e425df8`:
- `firebase-auth.ts` can mint a linked native UID without an existence check.
- `device-auth.ts` exchange also mints that UID after checking only the link;
  approved device-signin rows and already issued custom tokens need consideration.
- `firestore-admin.ts` privileged deletion resolves both the linked native UID
  and legacy Telegram UID. Native deletion must not reuse that Telegram eraser.
- Publication bulk deletion remains local per Worker; the candidate client now
  invokes both stores. The companion native unlink deletes only `account_links`
  and matching approved `device_signins`, and rechecks links before returning
  freshly minted native tokens. Already-issued credentials remain a release gate.
The independent staging reference service was not changed.
