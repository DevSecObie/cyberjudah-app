# Baseline deletion preparation — not deployable

This draft starts from mobile release `b36333cd`, not the broader Worker deletion
PR. It retains Bible Strong's Auth-trigger recursive cleanup and retry policy.

Changes:
- Use the deployed Firebase configuration instead of the legacy project's bucket.
- For `cyberjudah-app`, clean both app scopes and status records, excluding `tg_`
  identities. Staging cleanup cannot remove a production preview with the same ID.
- Stop native account deletion when publication removal fails, after provider
  confirmation and recent authentication rather than before them.

Validation: 28 focused API/native orchestration tests pass. Two executable
acceptance cases reproduce upstream limitations and **fail** when run with
`CYBERJUDAH_STRICT_ACCEPTANCE=1`: a late revision survives and a replacement
parent owner can be deleted. Ordinary runs mark these two as TODO; those runs do
not constitute deletion acceptance. No production or device deletion was run.

Run with the repository dependencies installed:

```sh
node --test apps/api/functions/tests/*.test.mjs apps/expo/scripts/test-account-deletion-baseline.mjs
CYBERJUDAH_STRICT_ACCEPTANCE=1 node --test apps/api/functions/tests/account-deletion.test.mjs
```

Remaining implementation/verification:
- Resolve both concurrency acceptance failures without silently adopting indefinite
  markers. Check affected historical ownership; current parent attribution alone
  does not establish the owner of orphan/reused-ID history.
- Integrate and test both required publication stores and native Telegram unlink.
  Current existing publication API still addresses one configured Worker.
- Verify actual staging file usage before declaring file cleanup complete.
- Switch off client Firestore cleanup only when the reviewed Auth trigger is
  deployed and verified. The current app helper intentionally still has the base
  client cleanup; this is preparatory work, not the completed baseline switch.
- Add an isolated explicit CyberJudah deployment configuration; existing
  `.firebaserc` remains `bible-strong-app`. Never use the broad package deploy
  command or deploy unrelated functions. Verify runtime/project/bucket first.
- Full SDK typecheck, lint, Expo/Jest suite, real emulator, native/offline tests,
  and deployed acceptance remain outstanding. The focused SDK tests mock services.

Billing was rechecked after the user's payment: Firebase now displays Blaze and
Functions Get started; CyberJudah remains linked to Firebase Payment. No payment,
billing mutation, deployment, rules change, retention change, PR merge, or build
was performed by this draft. Build number remains unchanged.
