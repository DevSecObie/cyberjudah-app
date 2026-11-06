import * as admin from 'firebase-admin'

// Use the Firestore document ID, never an editable field from its payload.
// Account cleanup and the Firestore delete trigger may both run for one study.
export const deleteStudyFiles = async (studyId: string, ownerUid?: string): Promise<void> => {
  const options = admin.app().options
  // CyberJudah has no provisioned Storage bucket (verified in both consoles).
  // Do not invent a bucket or target the upstream project's bucket.
  if (options.projectId === 'cyberjudah-app' && !options.storageBucket) return
  const bucket = admin.storage().bucket()
  if (options.projectId === 'cyberjudah-app') {
    for (const name of [`images/studies/${studyId}.jpg`, `images/studies/${studyId}-whatsapp.jpg`]) {
      const file = bucket.file(name)
      let metadata
      try { [metadata] = await file.getMetadata() }
      catch (error) {
        if ((error as { code?: number }).code === 404) continue
        throw error
      }
      // Legacy paths contain no UID. Never infer file ownership from a possibly
      // reused Firestore ID. Untagged objects require ownership reconciliation.
      if (!ownerUid || metadata.metadata?.ownerUid !== ownerUid ||
          metadata.metadata?.studyId !== studyId || !metadata.generation || !metadata.metageneration) {
        throw new Error('Study preview ownership is unverified')
      }
      await bucket.file(name, { preconditionOpts: {
        ifGenerationMatch: metadata.generation,
        ifMetagenerationMatch: metadata.metageneration,
      } }).delete({ ignoreNotFound: true })
    }
    return
  }
  await bucket.file(`images/studies/${studyId}.jpg`).delete({ ignoreNotFound: true })
  await bucket.file(`images/studies/${studyId}-whatsapp.jpg`).delete({ ignoreNotFound: true })
}
