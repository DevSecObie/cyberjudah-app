// Note: Auth triggers restent en v1 car v2 nécessite Identity Platform
import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import { deleteStudyFiles } from './studyFiles'

export const createUser = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL, providerData, emailVerified } =
    user
  const db = admin.firestore()
  const userRef = db.collection('users').doc(uid)
  const userData = {
    id: uid,
    email,
    ...(displayName ? { displayName } : {}),
    photoURL,
    provider: providerData[0]?.providerId,
    emailVerified,
  }
  await userRef.set(userData, { merge: true })
})

const deleteUserRuntimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 540, // 9 minutes (max pour v1)
  memory: '1GB',
  failurePolicy: true,
}

export const deleteUser = functions
  .runWith(deleteUserRuntimeOpts)
  .auth.user()
  .onDelete(async (user) => {
    const cyberJudah = admin.app().options.projectId === 'cyberjudah-app'
    // Native app deletion must never erase a Telegram-owned identity.
    if (cyberJudah && user.uid.startsWith('tg_')) return
    const db = admin.firestore()
    const scopes = cyberJudah ? ['', 'staging_'] : ['']

    async function deleteDocumentTree(snapshot: admin.firestore.DocumentSnapshot) {
      const ref = snapshot.ref
      // Keep the parent discoverable if deletion of a descendant fails.
      // recursiveDelete also covers descendants with missing parent documents.
      for (const subcollection of await ref.listCollections()) {
        await db.recursiveDelete(subcollection)
      }
      // Never erase a profile/study that was replaced while cleanup was running.
      // Propagate a version conflict so the Auth trigger retries from fresh data.
      // Missing parents can still have descendants, but must not be deleted if
      // another writer creates them after this snapshot.
      if (snapshot.updateTime) await ref.delete({ lastUpdateTime: snapshot.updateTime })
    }

    // Studies live outside users/{uid}. Process bounded pages, including both
    // private and published studies, and query again after each deleted page.
    for (const scope of scopes) {
      const userRef = db.collection(`${scope}users`).doc(user.uid)
      const ownedStudies = db.collection(`${scope}studies`).where('user.id', '==', user.uid).limit(100)
      while (true) {
        const page = await ownedStudies.get()
        if (page.empty) break
        for (const study of page.docs) {
          // Files first: if Storage fails, the study remains discoverable on retry.
          // The inherited preview path belongs to production studies. Staging
          // must not delete another owner's production preview with the same ID.
          if (!scope) await deleteStudyFiles(study.id)
          await deleteDocumentTree(study)
        }
      }

      await deleteDocumentTree(await userRef.get())
      if (cyberJudah) await db.collection(`${scope}users-status`).doc(user.uid).delete()
    }
    console.log('Account data and owned studies deleted')
  })
