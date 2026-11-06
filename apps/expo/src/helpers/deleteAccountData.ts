// Firebase's own window for deleting a login without signing in again.
export const RECENT_SIGN_IN_MS = 5 * 60 * 1000

type DeletableUser = {
  uid: string
  getIdTokenResult(forceRefresh?: boolean): Promise<{ authTime: string }>
}

type AccountDeletionSteps = {
  /** Confirms the sign-in where the provider needs it and revokes its tokens (Sign in with Apple). */
  revokeProvider: () => Promise<void>
  unpublishStudies: () => Promise<void>
  deleteLogin: () => Promise<void>
}

/**
 * Follow Bible Strong's Auth-trigger flow: delete the login here, then let the
 * deployed onDelete function recursively clean Firestore and Storage with retries.
 * CyberJudah additionally confirms Apple revocation and removes Worker publications
 * while the Firebase identity is still available. A failed prerequisite stops here.
 * Deploy and verify the server cleanup before releasing this client.
 */
export async function deleteAccountWithData(
  user: DeletableUser,
  { revokeProvider, unpublishStudies, deleteLogin }: AccountDeletionSteps,
  now: () => number = Date.now
): Promise<void> {
  await revokeProvider()
  const { authTime } = await user.getIdTokenResult(true)
  const signedInAt = new Date(authTime).getTime()
  if (!Number.isFinite(signedInAt) || now() - signedInAt > RECENT_SIGN_IN_MS)
    throw Object.assign(new Error('Sign in again to delete this account.'), {
      code: 'auth/requires-recent-login',
    })
  await unpublishStudies()
  await deleteLogin()
}
