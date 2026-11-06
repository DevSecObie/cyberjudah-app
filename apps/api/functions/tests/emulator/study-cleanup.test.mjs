import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test, { after } from 'node:test'
import vm from 'node:vm'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { Firestore } = require('@google-cloud/firestore')
const ts = require('typescript')
const project = 'demo-cyberjudah-deletion'
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8187', 'Requires the isolated local emulator')
const db = new Firestore({ projectId: project })
after(() => db.terminate())
const module = { exports: {} }
const source = readFileSync(new URL('../../src/deleteStudyTree.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
vm.runInThisContext(`(function(exports){${compiled}\n})`)(module.exports)
const { deleteStudyTree } = module.exports

async function clientRevision(id) {
  const now = Math.floor(Date.now() / 1000)
  // Unsigned emulator-only identity; never usable against a real Firebase project.
  const token = [ { alg: 'none', typ: 'JWT' }, {
    aud: project, iss: `https://securetoken.google.com/${project}`, sub: 'alice',
    user_id: 'alice', iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} },
  } ].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.'
  return fetch(`http://127.0.0.1:8187/v1/projects/${project}/databases/(default)/documents/studies/${id}/revisions/late`, {
    method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { text: { stringValue: 'late revision' } } }),
  })
}

test('a late revision before finalization preserves the root for retry', async () => {
  const root = db.doc('studies/emulator-before-final')
  await db.recursiveDelete(root)
  await root.set({ user: { id: 'alice' } })
  await root.collection('revisions').doc('original').set({})
  const snapshot = await root.get()
  let transactions = 0
  const wrapped = { runTransaction: async callback => {
    if (++transactions === 2) await root.collection('revisions').doc('late').set({})
    return db.runTransaction(callback)
  } }
  await assert.rejects(deleteStudyTree(wrapped, snapshot), /late data/)
  assert.equal((await root.get()).exists, true)
  await deleteStudyTree(db, await root.get())
  assert.equal((await root.get()).exists, false)
  assert.equal((await root.collection('revisions').get()).size, 0)
})

test('the deployed-rule candidate rejects a revision racing the final transaction', async () => {
  const root = db.doc('studies/emulator-during-final')
  await db.recursiveDelete(root)
  await root.set({ user: { id: 'alice' } })
  let writing, inject = true
  const wrapped = { runTransaction: callback => db.runTransaction(transaction => callback({
    get: async ref => {
      const result = await transaction.get(ref)
      if (result.docs && inject) {
        inject = false
        writing = clientRevision(root.id)
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      return result
    },
    delete: (...args) => transaction.delete(...args),
  })) }
  await deleteStudyTree(wrapped, await root.get())
  const response = await writing
  assert.equal(response.status, 403, await response.text())
  assert.equal((await root.get()).exists, false)
  assert.equal((await root.collection('revisions').get()).size, 0)
})

test('a replacement parent protects its descendants from an older cleanup snapshot', async () => {
  const root = db.doc('studies/emulator-owner-change')
  await db.recursiveDelete(root)
  await root.set({ user: { id: 'alice' } })
  const old = await root.get()
  await root.set({ user: { id: 'bob' } })
  await root.collection('revisions').doc('keep').set({ text: 'Bob' })
  await assert.rejects(deleteStudyTree(db, old), /Study changed/)
  assert.equal((await root.get()).data().user.id, 'bob')
  assert.equal((await root.collection('revisions').doc('keep').get()).data().text, 'Bob')
})

test('bounded transactions clean more than one batch and missing intermediate parents', async () => {
  const root = db.doc('studies/emulator-many')
  await db.recursiveDelete(root)
  await root.set({ user: { id: 'alice' } })
  const batch = db.batch()
  for (let i = 0; i < 405; i++) batch.set(root.collection('revisions').doc(`r${i}`), {})
  batch.set(root.collection('legacy').doc('missing').collection('children').doc('nested'), {})
  await batch.commit()
  await deleteStudyTree(db, await root.get())
  assert.equal((await root.get()).exists, false)
  assert.equal((await root.collection('revisions').get()).size, 0)
  assert.equal((await root.collection('legacy').doc('missing').collection('children').get()).size, 0)
})
