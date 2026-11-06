Account deletion now requires successful unpublishing and a subject-bound acknowledgment from recursive server cleanup before deleting the login. The client-only collection scan has been removed because it cannot discover already-missing parents or unlisted subcollections. Cancellation, stale sign-in, a changed account, unavailable cleanup, partial failure, timeout or malformed acknowledgment preserves the login for retry. The server endpoint remains gated until historical orphan ownership is reconciled; client distribution alone does not establish complete erasure.

Ordinary study deletion and persisted retries now require the ownership-preserving server route. Failed or unavailable cleanup remains queued; neither path falls back to deleting only the study parent.

Native account deletion requires version-3 acknowledgment that the server blocked writes, removed publications and synced Firestore records, and unlinked Telegram. The confirmation explains that Telegram history remains separate. The candidate rules reject personal-data writes from other devices and offline queues after the server installs a deletion barrier. Rollout still requires the reviewed server, rules and historical ownership reconciliation.

Release validation also corrects the share-card title type guard and formatting in three existing build helpers so the full repository checks can run without bypasses.
