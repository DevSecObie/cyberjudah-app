# Native account deletion and Apple revocation

## Scope

The existing native Delete account modal is unchanged. Its unprotected auth adapter now calls an
authenticated `deleteAccount` callable in `us-central1`, instead of deleting the Firebase login
directly. This includes the missing mobile data-deletion path without depending on PR #4 or editing
the iPhone/content branches. There are no new screens, dependencies, build settings, or purchases.

This is a native-client change. The Expo Web auth adapter is not changed and does not acquire this
Apple revocation flow. Do not claim that a web account-deletion URL has been delivered by this PR.

## Security and deletion order

1. Require Firebase project `cyberjudah-app` on both client and server. Firebase's callable framework
   verifies the caller's ID token; the handler derives the UID exclusively from that authenticated
   context. Anonymous, stale, future-dated, disabled, and revoked sessions are refused.
2. For an Apple-linked account, invoke the existing native Apple login sheet, reauthenticate the
   **same Firebase user**, refresh its Firebase ID token, and send only the fresh authorization code.
   Cancellation, a different Apple account, incomplete credentials, or an account switch stops here.
3. On the server, require recent Apple authentication. Generate a five-minute ES256 client-secret JWT
   with Node's built-in crypto. Exchange the single-use code at Apple's `/auth/token`. Verify the
   returned identity's RS256 signature against Apple's keys, issuer, audience, subject, and times.
   The Apple subject must match the provider UID from the authenticated Firebase user's record.
4. POST the exchanged refresh token to Apple's `/auth/revoke`. Any configuration, exchange,
   verification, network, or revocation failure stops **before** Firestore or Auth deletion.
5. Recursively delete the owner's private and published studies and revisions, known generated study
   images, user documents and descendants (including conversations and orphaned descendants), and
   sync-status documents in both the normal and `staging_` namespaces. Account identities are shared
   across these namespaces: this is whole-account deletion, not merely a staging-data reset.
6. Delete the Firebase Auth user last. The existing modal then closes and calls the existing logout
   cleanup. Non-Apple accounts use the same data-first path without contacting Apple.

Study-image deletion, including the existing deletion triggers, targets the CyberJudah bucket
`cyberjudah-app.firebasestorage.app`, not Bible Strong's bucket. Existing not-found handling remains
idempotent. No arbitrary UID, token, client ID, bucket, or URL is accepted from the caller.

Deletion across Firestore, Storage, Apple, and Auth is **not transactional**. A later failure can leave
partially removed data or revoked Apple authorization while retaining the Firebase login. Retrying
finishes remaining data cleanup; Apple-linked retries obtain a new code. An Auth failure is not
reported as success. This does not promise deletion of owner-managed backups, local exports, or
service-provider logs; their retention policies need separate owner review.

Codes, refresh tokens, private keys, provider bodies, and provider exceptions are neither persisted
nor logged. The callable returns generic failures. Private signing material never reaches the app.

## Owner-controlled rollout prerequisites

No function has been deployed, no paid action has been taken, and no real user has been deleted.

- Review this sensitive authentication/account-data change before any rollout.
- Provision these Firebase function secrets through the owner's secure process, never source code:
  `APPLE_SIGN_IN_CLIENT_ID`, `APPLE_SIGN_IN_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID`, and
  `APPLE_SIGN_IN_PRIVATE_KEY` (the original PKCS#8 `.p8` contents, including actual newlines).
- The client ID must match the native app's actual Apple authorization audience, not the Firebase
  app ID or Google client ID. Confirm the bundle identifier, Apple key capability, and team/key pair.
- Confirm the service account has CyberJudah Auth deletion, Firestore recursive deletion, and access
  to the CyberJudah study-image bucket, with no dependency on Bible Strong permissions.
- An owner-approved backend rollout must precede the app release: the new callable and the existing
  `deleteStudy`/`deleteUser` triggers share the corrected study-image helper. Do not ship the updated
  client before the callable exists. Missing configuration fails closed; it does not fall back to
  deleting only the login. No deployment command was run for this work.
- Apple-linked deletion needs an Apple-capable native authentication environment. Cross-platform
  Apple reauthentication on Android and the Web deletion path are not implemented by this PR.
  These are release-review gaps, not a claim of complete App Store/Play compliance.

## Fixture validation

From `apps/api/functions`, run `node --test tests/*.test.mjs` (or the workspace `test` script).
The new suite transpiles the real callable, Apple service, native adapter, and request helper, while
replacing SDK/network boundaries. All cryptographic test keys are generated in memory; no Apple
credentials, live Firebase users, or paid APIs are used. Tests forbid unmocked network and logging.

Coverage includes successful ordering; password/Google paths; own/other-account isolation; both data
namespaces; conversations/orphan descendants; pagination; missing/expired/mismatched/forged Apple
identities; JWT signing; code exchange/revocation failures; session recency and revocation; disabled
users; wrong projects; malformed requests; cancellation/account switches; data/storage/Auth failures;
and retries. This is fixture evidence, **not** a native-device, emulator, or real Apple acceptance run.

## Official protocol references

- [Apple: Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple: Token validation](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens)
- [Apple: Token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- [Apple: Creating a client secret](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret)
- [Firebase: Callable functions and automatic ID-token validation](https://firebase.google.com/docs/functions/callable)
- [Firebase: Sign in with Apple and account deletion](https://firebase.google.com/docs/auth/ios/apple#token_revocation)
