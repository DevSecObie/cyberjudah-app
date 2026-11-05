// Firebase's own window for deleting a login without signing in again.
export const RECENT_SIGN_IN_MS = 5 * 60 * 1000

type DeletableUser = {
  uid: string
  getIdTokenResult(forceRefresh?: boolean): Promise<{ authTime: string }>
}

type AccountDeletionSteps = {
  /** Confirms the sign-in where the provider needs it and revokes its tokens (Sign in with Apple). */
  revokeProvider: () => Promise<void>
  /** Must succeed while the reader can still authenticate to the publication service. */
  unpublishStudies: () => Promise<void>
  /** Must acknowledge recursive server cleanup, including missing parents. */
  deleteRemoteData: () => Promise<void>
  isCurrentUser: () => boolean
  deleteLogin: () => Promise<void>
}

/**
 * Deletes an account only after its known data stores have acknowledged deletion:
 * 1. the provider step (Apple users sign in again, then the app's Apple tokens are revoked);
 * 2. a recent-sign-in check, because Firebase refuses to delete an older login;
 * 3. published studies;
 * 4. authenticated recursive server cleanup (no client-only fallback);
 * 5. the login.
 * If any step fails, the later ones do not run and the reader can try again. Deletion
 * across stores and batches is not atomic; a failure can leave partially deleted data.
 */
export async function deleteAccountWithData(
  user: DeletableUser,
  {
    revokeProvider,
    unpublishStudies,
    deleteRemoteData,
    isCurrentUser,
    deleteLogin,
  }: AccountDeletionSteps,
  now: () => number = Date.now
): Promise<void> {
  const assertCurrentUser = () => {
    if (!isCurrentUser())
      throw Object.assign(new Error('The signed-in account changed. Please sign in again.'), {
        code: 'auth/user-mismatch',
      })
  }
  assertCurrentUser()
  await revokeProvider()
  assertCurrentUser()
  const { authTime } = await user.getIdTokenResult(true)
  const signedInAt = new Date(authTime).getTime()
  if (!Number.isFinite(signedInAt) || now() - signedInAt > RECENT_SIGN_IN_MS)
    throw Object.assign(new Error('Sign in again to delete this account.'), {
      code: 'auth/requires-recent-login',
    })
  assertCurrentUser()
  await unpublishStudies()
  assertCurrentUser()
  await deleteRemoteData()
  assertCurrentUser()
  await deleteLogin()
}
