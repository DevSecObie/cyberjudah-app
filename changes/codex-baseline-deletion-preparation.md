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

Validation: 32 focused API/native orchestration tests pass. Root deletion now
requires the snapshot's Firestore updateTime; replacing a study or profile before
the final delete causes a retry instead of erasing that replacement. This does
not yet protect descendants or previews against replacement during their cleanup.
One executable acceptance case still **fails** with
`CYBERJUDAH_STRICT_ACCEPTANCE=1`: a late revision survives. Ordinary runs mark
that case as TODO; those runs do not constitute deletion acceptance. No production
or device deletion was run. API typecheck and TSLint pass with the actual SDK
dependencies installed from the repository lockfile.

Run with the repository dependencies installed:

```sh
node --test apps/api/functions/tests/*.test.mjs apps/expo/scripts/test-account-deletion-baseline.mjs
CYBERJUDAH_STRICT_ACCEPTANCE=1 node --test apps/api/functions/tests/account-deletion.test.mjs
```

Remaining implementation/verification:
- Resolve late writes and descendant/preview ownership races without silently
  adopting indefinite markers. Check affected historical ownership; current parent attribution alone
  does not establish the owner of orphan/reused-ID history.
- Integrate and test both required publication stores and native Telegram unlink.
  Current existing publication API still addresses one configured Worker.
- Verify actual staging file usage before declaring file cleanup complete.
- Deploy and verify the reviewed Auth trigger before shipping the client switch.
- Add an isolated explicit CyberJudah deployment configuration; existing
  `.firebaserc` remains `bible-strong-app`. Never use the broad package deploy
  command or deploy unrelated functions. Verify runtime/project/bucket first.
- Expo/Jest suite, real emulator, native/offline tests, and deployed acceptance
  remain outstanding. The focused SDK tests mock services.
- The inherited Node.js 20 deployment runtime was decommissioned on October 30,
  2026. An isolated v1 deployment needs Node.js 22 and validation on that runtime;
  do not reuse the legacy default project or broad API deploy command.
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
the server traversal remains upstream's, extended only for its scoped collections.
