import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function fixture() {
  const effects = []
  const firebase = {
    firebaseDb: {},
    collection: () => ({}), doc: () => ({}), query: () => ({}), where: () => ({}),
    getDocs: async () => { effects.push('read'); return { docs: [] } },
    writeBatch: () => ({ delete() {}, commit: async () => { effects.push('data') } }),
  }
  const source = readFileSync(new URL('../src/helpers/deleteAccountData.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  const require = id => {
    if (id === './firebase') return firebase
    if (id === './firestoreSubcollectionNames') return { SUBCOLLECTION_NAMES: [] }
    throw new Error(`Unexpected dependency: ${id}`)
  }
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`)(require, module, module.exports)
  const user = { uid: 'alice', getIdTokenResult: async () => ({ authTime: new Date().toISOString() }) }
  return { effects, user, run: module.exports.deleteAccountWithData }
}

test('publication failure leaves private data and Firebase login untouched', async () => {
  const f = fixture()
  await assert.rejects(f.run(f.user, {
    revokeProvider: async () => f.effects.push('provider'),
    unpublishStudies: async () => { throw new Error('publication unavailable') },
    deleteLogin: async () => f.effects.push('login'),
  }), /publication unavailable/)
  assert.deepEqual(f.effects, ['provider'])
})

test('provider cancellation cannot remove publications or private data', async () => {
  const f = fixture()
  await assert.rejects(f.run(f.user, {
    revokeProvider: async () => { throw new Error('cancelled') },
    unpublishStudies: async () => f.effects.push('publications'),
    deleteLogin: async () => f.effects.push('login'),
  }), /cancelled/)
  assert.deepEqual(f.effects, [])
})

test('successful deletion delegates private-data cleanup to the Auth trigger', async () => {
  const f = fixture()
  await f.run(f.user, {
    revokeProvider: async () => f.effects.push('provider'),
    unpublishStudies: async () => f.effects.push('publications'),
    deleteLogin: async () => f.effects.push('login'),
  })
  assert.deepEqual(f.effects, ['provider', 'publications', 'login'])
})

test('expired authentication stops before publication removal', async () => {
  const f = fixture()
  f.user.getIdTokenResult = async () => ({ authTime: '2026-01-01T00:00:00Z' })
  await assert.rejects(f.run(f.user, {
    revokeProvider: async () => f.effects.push('provider'),
    unpublishStudies: async () => f.effects.push('publications'),
    deleteLogin: async () => f.effects.push('login'),
  }, () => Date.parse('2026-01-02T00:00:00Z')), { code: 'auth/requires-recent-login' })
  assert.deepEqual(f.effects, ['provider'])
})

test('Auth deletion failure never triggers client Firestore cleanup', async () => {
  const f = fixture()
  await assert.rejects(f.run(f.user, {
    revokeProvider: async () => f.effects.push('provider'),
    unpublishStudies: async () => f.effects.push('publications'),
    deleteLogin: async () => { throw new Error('auth unavailable') },
  }), /auth unavailable/)
  assert.deepEqual(f.effects, ['provider', 'publications'])
})
