import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
let env
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cyberjudah-port',
    firestore: {
      host: '127.0.0.1',
      port: 8089,
      rules: await readFile(
        process.env.FIRESTORE_RULES_PATH ??
          new URL('../../apps/expo/firebase/cyberjudah/firestore.rules', import.meta.url),
        'utf8'
      ),
    },
  })
})
after(async () => env?.cleanup())
const db = uid =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore()
test('staging notes, tabs and revisions are accessible only to their owner', async () => {
  for (const path of [
    'staging_users/alice',
    'staging_users/alice/notes/n',
    'staging_users/alice/notes/n/revisions/r',
    'staging_users/alice/tabGroups/main',
    'staging_users-status/alice',
  ]) {
    await assertSucceeds(setDoc(doc(db('alice'), path), { text: 'fixture' }))
    await assertSucceeds(getDoc(doc(db('alice'), path)))
    for (const uid of ['bob', null]) {
      await assertFails(getDoc(doc(db(uid), path)))
      await assertFails(setDoc(doc(db(uid), path), { text: 'overwrite' }))
      await assertFails(deleteDoc(doc(db(uid), path)))
    }
  }
})
test('staging studies cannot be read, transferred or changed by another account', async () => {
  const path = 'staging_studies/private',
    owner = db('alice')
  await assertSucceeds(setDoc(doc(owner, path), { user: { id: 'alice' }, title: 'fixture' }))
  await assertSucceeds(setDoc(doc(owner, path + '/revisions/one'), { text: 'previous' }))
  await assertSucceeds(
    getDocs(query(collection(owner, 'staging_studies'), where('user.id', '==', 'alice')))
  )
  for (const uid of ['bob', null]) {
    await assertFails(getDoc(doc(db(uid), path)))
    await assertFails(getDoc(doc(db(uid), path + '/revisions/one')))
    await assertFails(setDoc(doc(db(uid), path + '/revisions/one'), { text: 'overwrite' }))
    await assertFails(updateDoc(doc(db(uid), path), { title: 'overwrite' }))
  }
  await assertFails(updateDoc(doc(owner, path), { 'user.id': 'bob' }))
})
test('the original production document is untouched by staging writes', async () => {
  const owner = db('alice')
  await assertSucceeds(setDoc(doc(owner, 'users/alice'), { displayName: 'Original' }))
  await assertSucceeds(setDoc(doc(owner, 'staging_users/alice'), { displayName: 'Staging' }))
  assert.equal((await getDoc(doc(owner, 'users/alice'))).data().displayName, 'Original')
  await assertFails(getDoc(doc(db('bob'), 'users/alice')))
})
