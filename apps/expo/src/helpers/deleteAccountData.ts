import { collection, doc, firebaseDb, getDocs, query, where, writeBatch } from './firebase'
import { SUBCOLLECTION_NAMES } from './firestoreSubcollectionNames'

// Firestore accepts at most 500 writes in one batch.
const BATCH_SIZE = 400

type DeletableRef = Parameters<ReturnType<typeof writeBatch>['delete']>[0]

/**
 * Deletes every document the account owner keeps in Firestore, before the login itself is deleted:
 * each synced subcollection, the studies they own with their history, the sync status and the
 * profile. CyberJudah's Firebase project has no deletion function, so the app removes these itself;
 * the rules let only the owner do so. Paths go through the same staging scope as every other write.
 * Everything is listed before anything is deleted, so a failed read deletes nothing.
 */
export async function deleteOwnAccountData(userId: string): Promise<number> {
  const refs: DeletableRef[] = []
  for (const name of SUBCOLLECTION_NAMES) {
    const snapshot = await getDocs(collection(firebaseDb, 'users', userId, name))
    for (const document of snapshot.docs) refs.push(document.ref)
  }
  const studies = await getDocs(
    query(collection(firebaseDb, 'studies'), where('user.id', '==', userId))
  )
  for (const study of studies.docs) {
    const revisions = await getDocs(collection(study.ref, 'revisions'))
    for (const revision of revisions.docs) refs.push(revision.ref)
    refs.push(study.ref)
  }
  refs.push(doc(firebaseDb, 'users-status', userId), doc(firebaseDb, 'users', userId))
  for (let start = 0; start < refs.length; start += BATCH_SIZE) {
    const batch = writeBatch(firebaseDb)
    for (const ref of refs.slice(start, start + BATCH_SIZE)) batch.delete(ref)
    await batch.commit()
  }
  return refs.length
}

// Firebase's own window for deleting a login without signing in again.
export const RECENT_SIGN_IN_MS = 5 * 60 * 1000

type DeletableUser = { uid: string; getIdTokenResult(): Promise<{ authTime: string }> }

/**
 * Deletes the account's data, then the login. Firebase refuses to delete a login that signed in
 * too long ago, so that is checked first: the reader is asked to sign in again before anything goes,
 * rather than losing their data and keeping the account.
 */
export async function deleteAccountWithData(
  user: DeletableUser,
  deleteLogin: () => Promise<void>,
  now = Date.now()
): Promise<void> {
  const { authTime } = await user.getIdTokenResult()
  const signedInAt = new Date(authTime).getTime()
  if (!Number.isFinite(signedInAt) || now - signedInAt > RECENT_SIGN_IN_MS)
    throw Object.assign(new Error('Sign in again to delete this account.'), {
      code: 'auth/requires-recent-login',
    })
  await deleteOwnAccountData(user.uid)
  await deleteLogin()
}
