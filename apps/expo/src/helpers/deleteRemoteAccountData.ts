import { getCurrentAuthUser } from './firebaseAuthRuntime'

/** No client Firestore fallback: collection queries cannot see already-missing parents. */
export async function deleteRemoteAccountData(expectedUid: string): Promise<void> {
  const user = getCurrentAuthUser()
  if (!user || user.uid !== expectedUid)
    throw Object.assign(new Error('Sign in again to delete this account.'), {
      code: 'auth/user-mismatch',
    })
  const token = await user.getIdToken(true)
  if (getCurrentAuthUser()?.uid !== expectedUid)
    throw Object.assign(new Error('Sign in again to delete this account.'), {
      code: 'auth/user-mismatch',
    })
  const server = (
    process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ||
    'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
  ).replace(/\/+$/, '')
  const response = await fetch(`${server}/api/native-account-data`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  })
  const body = (await response.json().catch(() => null)) as {
    version?: unknown
    uid?: unknown
    publicationsDeleted?: unknown
    writesBlocked?: unknown
    telegramUnlinked?: unknown
    firestoreDeleted?: unknown
    error?: unknown
  } | null
  if (
    !response.ok ||
    body?.version !== 3 ||
    body.uid !== expectedUid ||
    body.firestoreDeleted !== true ||
    body.publicationsDeleted !== true ||
    body.writesBlocked !== true ||
    body.telegramUnlinked !== true
  )
    throw Object.assign(new Error('Account deletion could not be completed. Please try again.'), {
      code:
        body?.error === 'recent_sign_in_required'
          ? 'auth/requires-recent-login'
          : 'account/deletion-incomplete',
    })
}
