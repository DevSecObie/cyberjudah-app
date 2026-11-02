import { collection, doc, firebaseDb, getDocs, query, where, writeBatch } from './firebase'
import { SUBCOLLECTION_NAMES } from './firestoreSubcollectionNames'

// Firestore accepts at most 500 writes in one batch.
const BATCH_SIZE = 400

// Older builds kept studies under the profile too; the rules still let the owner delete them.
const ACCOUNT_SUBCOLLECTIONS = [...SUBCOLLECTION_NAMES, 'studies'] as const

type DeletableRef = Parameters<ReturnType<typeof writeBatch>['delete']>[0]

/**
 * Deletes every document the account owner keeps in Firestore, before the login itself is deleted:
 * each synced subcollection, the studies they own with their history, the sync status and the
 * profile. CyberJudah's Firebase project runs no deletion function, so the app removes these
 * itself; the rules let only the owner do so. Paths go through the same staging scope as every
 * other write. Everything is listed before anything is deleted, so a failed read deletes nothing.
 */
export async function deleteOwnAccountData(userId: string): Promise<number> {
  const refs: DeletableRef[] = []
  for (const name of ACCOUNT_SUBCOLLECTIONS) {
    const snapshot = await getDocs(collection(firebaseDb, 'users', userId, name))
    for (const document of snapshot.docs) refs.push(document.ref)
  }
  const studies = await getDocs(
    query(collection(firebaseDb, 'studies'), where('user.id', '==', userId))
  )
  for (const study of studies.docs) {
    // History first: its rule looks up the study, so the study must still exist.
    const revisions = await getDocs(collection(study.ref, 'revisions'))
    for (const revision of revisions.docs) refs.push(revision.ref)
    refs.push(study.ref)
  }
  // The profile goes last, so a failed run can be tried again from the same account.
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

type DeletableUser = {
  uid: string
  getIdTokenResult(forceRefresh?: boolean): Promise<{ authTime: string }>
}

type AccountDeletionSteps = {
  /** Confirms the sign-in where the provider needs it and revokes its tokens (Sign in with Apple). */
  revokeProvider: () => Promise<void>
  deleteLogin: () => Promise<void>
}

/**
 * Deletes an account in an order that never leaves a reader with a login and no data:
 * 1. the provider step (Apple users sign in again, then the app's Apple tokens are revoked);
 * 2. a recent-sign-in check, because Firebase refuses to delete an older login;
 * 3. every document the account keeps in Firestore;
 * 4. the login.
 * If any step fails, the later ones do not run and the reader can try again.
 */
export async function deleteAccountWithData(
  user: DeletableUser,
  { revokeProvider, deleteLogin }: AccountDeletionSteps,
  now: () => number = Date.now
): Promise<void> {
  await revokeProvider()
  const { authTime } = await user.getIdTokenResult(true)
  const signedInAt = new Date(authTime).getTime()
  if (!Number.isFinite(signedInAt) || now() - signedInAt > RECENT_SIGN_IN_MS)
    throw Object.assign(new Error('Sign in again to delete this account.'), {
      code: 'auth/requires-recent-login',
    })
  await deleteOwnAccountData(user.uid)
  await deleteLogin()
}
