import * as admin from 'firebase-admin'

/** CyberJudah revisions are owned through their study parent, not a child UID. */
export async function deleteStudyTree(
  db: admin.firestore.Firestore,
  study: admin.firestore.DocumentSnapshot
): Promise<void> {
  if (!study.updateTime) throw new Error('Study snapshot has no version')
  const expectedVersion = study.updateTime
  const rootCollections = new Map<string, admin.firestore.CollectionReference>()
  // Query this even when initially empty: it is the client-writable child path.
  rootCollections.set('revisions', study.ref.collection('revisions'))
  const pending: admin.firestore.DocumentReference[] = []

  async function checkOwner(transaction: admin.firestore.Transaction) {
    const current = await transaction.get(study.ref)
    if (!current.updateTime || !current.updateTime.isEqual(expectedVersion)) {
      throw new Error('Study changed during account cleanup; retry from a fresh owner query')
    }
  }

  async function flush() {
    if (!pending.length) return
    const batch = pending.splice(0)
    await db.runTransaction(async transaction => {
      await checkOwner(transaction)
      for (const ref of batch) transaction.delete(ref)
    })
  }

  async function visit(ref: admin.firestore.DocumentReference) {
    for (const collection of await ref.listCollections()) {
      if (ref.path === study.ref.path) rootCollections.set(collection.id, collection)
      // listDocuments includes missing parents with surviving descendants.
      for (const child of await collection.listDocuments()) {
        await visit(child)
        pending.push(child)
        if (pending.length === 400) await flush()
      }
    }
  }

  await visit(study.ref)
  await flush()
  await db.runTransaction(async transaction => {
    await checkOwner(transaction)
    for (const collection of rootCollections.values()) {
      const late = await transaction.get(collection.limit(1))
      if (!late.empty) throw new Error('Study received late data; retry cleanup')
    }
    transaction.delete(study.ref, { lastUpdateTime: expectedVersion })
  })
}
