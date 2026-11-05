import { getCurrentAuthUser } from './firebaseAuthRuntime'

/** Both immediate deletion and persisted outbox replay must retain server ownership evidence. */
export async function deleteRemoteStudy(expectedUid: string, studyId: string): Promise<void> {
  const user = getCurrentAuthUser()
  if (!user || user.uid !== expectedUid) throw new Error('The signed-in account changed.')
  const token = await user.getIdToken()
  if (getCurrentAuthUser()?.uid !== expectedUid) throw new Error('The signed-in account changed.')
  const scope = process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE === 'staging' ? 'staging' : 'production'
  const server = (
    process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ||
    'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
  ).replace(/\/+$/, '')
  const response = await fetch(
    `${server}/api/native-studies/${scope}/${encodeURIComponent(studyId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    }
  )
  const body = (await response.json().catch(() => null)) as {
    version?: unknown
    uid?: unknown
    scope?: unknown
    studyId?: unknown
    deleted?: unknown
  } | null
  if (
    !response.ok ||
    body?.version !== 1 ||
    body.uid !== expectedUid ||
    body.scope !== scope ||
    body.studyId !== studyId ||
    body.deleted !== true
  )
    throw Object.assign(new Error('Study deletion could not be completed.'), {
      code: response.status === 403 ? 'firestore/permission-denied' : 'study/deletion-incomplete',
    })
}
