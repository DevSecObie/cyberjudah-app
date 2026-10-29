type DeletionUser = {
  uid: string
  getIdToken(forceRefresh: boolean): Promise<string>
  getIdTokenResult(): Promise<{ authTime: string }>
}

export async function requestAccountDeletion(
  user: DeletionUser,
  authorizationCode: string | undefined,
  currentUserId: () => string | undefined,
  request: typeof fetch = fetch,
  now = Date.now()
): Promise<void> {
  const idToken = await user.getIdToken(true)
  const { authTime } = await user.getIdTokenResult()
  const signedInAt = new Date(authTime).getTime()
  if (!Number.isFinite(signedInAt) || signedInAt > now + 30000 || now - signedInAt > 300000) {
    throw Object.assign(new Error('Sign in again to delete your account.'), {
      code: 'auth/requires-recent-login',
    })
  }
  if (currentUserId() !== user.uid) throw new Error('The signed-in account changed.')
  try {
    const response = await request(
      'https://us-central1-cyberjudah-app.cloudfunctions.net/deleteAccount',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: authorizationCode ? { authorizationCode } : {} }),
      }
    )
    const body = await response.json()
    if (body.error?.details?.reason === 'requires-recent-login') {
      throw Object.assign(new Error('Sign in again to delete your account.'), {
        code: 'auth/requires-recent-login',
      })
    }
    if (!response.ok || body.error || body.result?.deleted !== true) {
      throw new Error('Account deletion could not finish. Please try again.')
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/requires-recent-login') throw error
    throw new Error('Account deletion could not finish. Please try again.')
  }
}
