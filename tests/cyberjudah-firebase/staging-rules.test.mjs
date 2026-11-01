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
test('the server-owned subscription cannot be set or changed by the account owner', async () => {
  const owner = db('alice')
  for (const root of ['users', 'staging_users']) {
    const path = `${root}/alice`
    await assertFails(setDoc(doc(owner, path), { subscription: 'premium' }))
    await assertSucceeds(setDoc(doc(owner, path), { displayName: 'Reader' }))
    await assertFails(updateDoc(doc(owner, path), { subscription: 'premium' }))
    await env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), path), { displayName: 'Reader', subscription: 'server' })
    )
    await assertSucceeds(updateDoc(doc(owner, path), { displayName: 'Renamed' }))
    await assertFails(updateDoc(doc(owner, path), { subscription: 'premium' }))
    await assertSucceeds(deleteDoc(doc(owner, path)))
  }
})
test("a study's revision history is as private as the study", async () => {
  const owner = db('alice'),
    path = 'studies/private'
  await assertSucceeds(setDoc(doc(owner, path), { user: { id: 'alice' }, title: 'fixture' }))
  await assertSucceeds(setDoc(doc(owner, path + '/revisions/one'), { text: 'previous' }))
  await assertSucceeds(getDoc(doc(owner, path + '/revisions/one')))
  for (const uid of ['bob', null]) {
    await assertFails(getDoc(doc(db(uid), path + '/revisions/one')))
    await assertFails(setDoc(doc(db(uid), path + '/revisions/two'), { text: 'planted' }))
  }
  await assertSucceeds(deleteDoc(doc(owner, path + '/revisions/one')))
})
test('Delete account can remove everything the owner keeps, and nothing of anyone else', async () => {
  for (const [users, studies, status] of [
    ['users', 'studies', 'users-status'],
    ['staging_users', 'staging_studies', 'staging_users-status'],
  ]) {
    await env.withSecurityRulesDisabled(async ctx => {
      const admin = ctx.firestore()
      await setDoc(doc(admin, `${users}/alice`), { displayName: 'Reader', subscription: 'server' })
      await setDoc(doc(admin, `${users}/alice/notes/n1`), { text: 'fixture' })
      await setDoc(doc(admin, `${status}/alice`), { lastSeen: 1 })
      await setDoc(doc(admin, `${studies}/mine`), { user: { id: 'alice' } })
      // A revision written without its own user field, as older clients did.
      await setDoc(doc(admin, `${studies}/mine/revisions/r1`), { text: 'previous' })
      await setDoc(doc(admin, `${studies}/theirs`), { user: { id: 'bob' } })
    })
    const alice = db('alice')
    await assertFails(deleteDoc(doc(alice, `${studies}/theirs`)))
    for (const path of [
      `${users}/alice/notes/n1`,
      `${studies}/mine/revisions/r1`,
      `${studies}/mine`,
      `${status}/alice`,
      `${users}/alice`,
    ])
      await assertSucceeds(deleteDoc(doc(alice, path)))
  }
})
