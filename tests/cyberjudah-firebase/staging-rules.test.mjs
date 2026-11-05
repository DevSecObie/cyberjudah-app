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
  const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8089'
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(emulator)) throw new Error('Loopback emulator required')
  const projectId = process.env.FIRESTORE_TEST_PROJECT ?? 'demo-cyberjudah-port'
  if (!projectId.startsWith('demo-')) throw new Error('Demo project required')
  const [host, port] = emulator.split(':')
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(port),
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
test('client cleanup cannot bypass ownership-preserving study deletion or delete another owner', async () => {
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
    await assertFails(deleteDoc(doc(alice, `${studies}/mine`)))
    for (const path of [
      `${users}/alice/notes/n1`,
      `${studies}/mine/revisions/r1`,
      `${status}/alice`,
      `${users}/alice`,
    ])
      await assertSucceeds(deleteDoc(doc(alice, path)))
    await assertFails(deleteDoc(doc(alice, `${studies}/mine`)))
  }
})

test('only the server controls deletion ownership and a deleted study ID cannot be reused', async () => {
  for (const root of ['studies', 'staging_studies']) {
    const ledger = `study_deletion_owners/${root}:retained-owner`
    await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), ledger), {
      version: 1, user: { id: 'alice' }, studyRoot: root, studyId: 'retained-owner',
    }))
    for (const uid of ['alice', 'bob']) {
      const client = db(uid)
      await assertFails(getDoc(doc(client, ledger)))
      await assertFails(setDoc(doc(client, ledger), { user: { id: uid } }))
      await assertFails(deleteDoc(doc(client, ledger)))
      await assertFails(setDoc(doc(client, `${root}/retained-owner`), { user: { id: uid } }))
      await assertFails(setDoc(doc(client, `${root}/retained-owner/revisions/new`), { user: { id: uid }, text: 'late' }))
    }
  }
})

// Historical IDs require a trusted inventory and an approved server-side quarantine. A ledger
// for future deletions cannot prove that an unrecorded old ID was never reclaimed.
test('quarantining an unresolved historical ID prevents recreation and access through a replaced parent', async () => {
  for (const root of ['studies', 'staging_studies']) {
    const path = `${root}/historical-unresolved`
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), path + '/revisions/old'), { text: 'private older content' })
      // Model a parent already recreated before quarantine; its current owner is not evidence
      // of ownership of the older revision.
      await setDoc(doc(ctx.firestore(), path), { user: { id: 'bob' } })
      await setDoc(doc(ctx.firestore(), `study_deletion_owners/${root}:historical-unresolved`), {
        version: 1, state: 'ownership-unresolved', studyRoot: root, studyId: 'historical-unresolved',
      })
    })
    for (const uid of ['alice', 'bob']) {
      await assertFails(getDoc(doc(db(uid), path + '/revisions/old')))
      await assertFails(setDoc(doc(db(uid), path), { user: { id: uid } }))
    }
    await env.withSecurityRulesDisabled(ctx => deleteDoc(doc(ctx.firestore(), path)))
    await assertFails(setDoc(doc(db('bob'), path), { user: { id: 'bob' } }))
    await env.withSecurityRulesDisabled(async ctx => {
      await deleteDoc(doc(ctx.firestore(), path + '/revisions/old'))
      await deleteDoc(doc(ctx.firestore(), `study_deletion_owners/${root}:historical-unresolved`))
    })
  }
})
