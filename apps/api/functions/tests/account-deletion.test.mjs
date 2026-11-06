import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

// Load the real exported Firebase handlers without initializing credentials or
// connecting to a project. Only the SDK boundary is replaced.
function fixture(entries, initialFiles = [], projectId = 'bible-strong-app') {
  const documents = new Map(entries)
  const files = new Set(initialFiles)
  const fileFailures = new Set()
  const documentFailures = new Set()
  const fileAttempts = []
  const queries = []
  const removals = []
  const hooks = { beforeDelete: async () => {} }
  const snapshot = documentPath => {
    const data = documents.get(documentPath)
    return { id: documentPath.split('/').at(-1), ref: document(documentPath), exists: data !== undefined,
      data: () => data, updateTime: data === undefined ? undefined : {
        value: data, isEqual: other => other?.value === data,
      } }
  }
  const document = documentPath => ({
    path: documentPath,
    id: documentPath.split('/').at(-1),
    collection: name => collection(`${documentPath}/${name}`),
    listCollections: async () => [...new Set([...documents.keys()]
      .filter(key => key.startsWith(`${documentPath}/`))
      .map(key => key.slice(0, documentPath.length + 1) + key.slice(documentPath.length + 1).split('/')[0]))]
      .map(collection),
    get: async () => snapshot(documentPath),
    delete: async precondition => {
      await hooks.beforeDelete(documentPath, documents)
      if (precondition?.lastUpdateTime && precondition.lastUpdateTime.value !== documents.get(documentPath)) {
        throw Object.assign(new Error('document version changed'), { code: 9 })
      }
      documents.delete(documentPath)
    },
  })
  const collection = collectionPath => {
    const makeQuery = (filter, maximum = Infinity) => ({
      where: (field, operator, value) => {
        assert.equal(operator, '==')
        return makeQuery({ field, value }, maximum)
      },
      limit: count => makeQuery(filter, count),
      get: async () => {
        const matches = [...documents.entries()].filter(([key, data]) => {
          if (!key.startsWith(`${collectionPath}/`) || key.split('/').length !== collectionPath.split('/').length + 1) return false
          return !filter || filter.field.split('.').reduce((value, part) => value?.[part], data) === filter.value
        }).slice(0, maximum)
        queries.push({ collectionPath, filter, maximum, size: matches.length })
        return { empty: matches.length === 0, docs: matches.map(([key]) => snapshot(key)) }
      },
    })
    return { path: collectionPath, id: collectionPath.split('/').at(-1), ...makeQuery(),
      doc: id => document(`${collectionPath}/${id}`),
      listDocuments: async () => [...new Set([...documents.keys()]
        .filter(key => key.startsWith(`${collectionPath}/`))
        .map(key => key.split('/').slice(0, collectionPath.split('/').length + 1).join('/')))].map(document),
    }
  }
  const db = {
    collection,
    runTransaction: async callback => {
      const reads = [], deletes = []
      const signature = result => result.docs
        ? result.docs.map(doc => [doc.ref.path, doc.data()])
        : [[result.ref.path, result.data()]]
      await callback({
        get: async ref => {
          const result = await ref.get()
          reads.push([ref, signature(result)])
          return result
        },
        delete: ref => deletes.push(ref),
      })
      for (const ref of deletes) await hooks.beforeDelete(ref.path, documents)
      for (const [ref, before] of reads) {
        const after = signature(await ref.get())
        if (before.length !== after.length || before.some(([path, data], i) => path !== after[i][0] || data !== after[i][1])) {
          throw Object.assign(new Error('transaction read changed'), { code: 9 })
        }
      }
      for (const ref of deletes) documents.delete(ref.path)
    },
    batch: () => {
      const pending = []
      return {
        delete: ref => pending.push(ref.path),
        commit: async () => {
          assert.ok(pending.length <= 500)
          pending.forEach(key => documents.delete(key))
        },
      }
    },
    recursiveDelete: async ref => {
      if (documentFailures.has(ref.path)) throw new Error('firestore unavailable')
      removals.push(ref.path)
      for (const key of documents.keys()) {
        if (key === ref.path || key.startsWith(`${ref.path}/`)) documents.delete(key)
      }
    },
  }
  const bucket = {
    file: name => ({
      delete: async options => {
        fileAttempts.push(name)
        if (fileFailures.has(name)) throw new Error('storage unavailable')
        if (!files.has(name) && !options?.ignoreNotFound) throw Object.assign(new Error('not found'), { code: 404 })
        files.delete(name)
      },
    }),
  }
  const admin = { app: () => ({ options: { projectId } }), firestore: () => db, storage: () => ({ bucket: () => bucket }) }
  const wrap = options => handler => Object.assign(handler, { runtimeOptions: options })
  const functions = options => ({
    runWith: next => functions(next),
    auth: { user: () => ({ onCreate: wrap(options), onDelete: wrap(options) }) },
    firestore: { document: () => ({ onDelete: wrap(options), onUpdate: wrap(options) }) },
    https: { onRequest: wrap(options) },
  })
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    const moduleRequire = id => {
      if (id === 'firebase-admin') return admin
      if (id === 'firebase-functions/v1') return functions({})
      if (id === 'puppeteer-core' || id === '@sparticuz/chromium-min') return {}
      if (id === 'cors') return () => {}
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), `${id}.ts`))
      return require(id)
    }
    vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', { console: { log() {}, error() {} } }, { filename })(moduleRequire, module, module.exports)
    return module.exports
  }
  return { hooks, documents, files, fileFailures, documentFailures, fileAttempts, queries, removals, users: load(path.join(sourceRoot, 'users.ts')), studies: () => load(path.join(sourceRoot, 'studies.ts')) }
}

const imageNames = id => [`images/studies/${id}.jpg`, `images/studies/${id}-whatsapp.jpg`]

test('account deletion removes owned public and private studies, nested data and previews, preserving other accounts', async () => {
  const f = fixture([
    ['users/alice', { email: 'alice@example.test' }],
    ['users/alice/notes/note', { text: 'private' }],
    ['users/alice/notes/note/children/child', {}],
    ['users/bob', {}],
    ['users/bob/notes/note', {}],
    ['studies/public', { user: { id: 'alice' }, published: true, id: 'other' }],
    ['studies/private', { user: { id: 'alice' }, published: false }],
    ['studies/private/children/child', {}],
    ['studies/other', { user: { id: 'bob' }, published: true }],
  ], [...imageNames('public'), ...imageNames('private'), ...imageNames('other')])
  await f.users.deleteUser({ uid: 'alice' })
  assert.deepEqual([...f.documents.keys()].sort(), ['studies/other', 'users/bob', 'users/bob/notes/note'])
  assert.deepEqual([...f.files].sort(), imageNames('other').sort())
})

test('deletion handles more than one page and a repeated Auth event', async () => {
  const entries = Array.from({ length: 505 }, (_, i) => [`studies/study-${i}`, { user: { id: 'alice' }, published: i % 2 === 0 }])
  const f = fixture(entries)
  await f.users.deleteUser({ uid: 'alice' })
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
  assert.ok(f.queries.filter(query => query.collectionPath === 'studies' && query.size > 0).length > 1)
  assert.ok(f.queries.every(query => Number.isFinite(query.maximum)))
  assert.equal(f.users.deleteUser.runtimeOptions.failurePolicy, true)
})

test('a missing preview does not prevent deletion of the other preview', async () => {
  const f = fixture([['studies/own', { user: { id: 'alice' } }]], [imageNames('own')[1]])
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
  assert.equal(f.files.size, 0)
})

test('storage failure keeps the study discoverable and propagates for retry', async () => {
  const f = fixture([['users/alice', {}], ['studies/own', { user: { id: 'alice' } }]], imageNames('own'))
  f.fileFailures.add(imageNames('own')[1])
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), /storage unavailable/)
  assert.ok(f.documents.has('studies/own'))
  assert.ok(f.documents.has('users/alice'))
  f.fileFailures.clear()
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
  assert.equal(f.files.size, 0)
})

test('partial nested-data failure leaves the study root available to the next attempt', async () => {
  const f = fixture([
    ['users/alice', {}],
    ['studies/own', { user: { id: 'alice' } }],
    ['studies/own/children/first', {}],
    ['studies/own/children/second', {}],
  ])
  f.documentFailures.add('studies/own/children')
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), /firestore unavailable/)
  assert.ok(f.documents.has('studies/own'))
  f.documentFailures.clear()
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
})

test('account deletion removes descendants even when the profile document is missing', async () => {
  const f = fixture([['users/alice/notes/missing/children/child', {}], ['users/bob/notes/keep', {}]])
  await f.users.deleteUser({ uid: 'alice' })
  assert.deepEqual([...f.documents.keys()], ['users/bob/notes/keep'])
})

test('standalone study deletion uses the document ID and tolerates duplicate events', async () => {
  const f = fixture([], [...imageNames('own'), ...imageNames('other')])
  const handler = f.studies().deleteStudy
  const snapshot = { id: 'own', data: () => ({ id: 'other' }) }
  await handler(snapshot, { params: { studyId: 'own' } })
  await handler(snapshot, { params: { studyId: 'own' } })
  assert.deepEqual([...f.files].sort(), imageNames('other').sort())
  assert.equal(handler.runtimeOptions.failurePolicy, true)
})

test('standalone study deletion reports storage failures instead of swallowing them', async () => {
  const f = fixture([], imageNames('own'))
  f.fileFailures.add(imageNames('own')[0])
  await assert.rejects(f.studies().deleteStudy({ id: 'own', data: () => ({ id: 'own' }) }, { params: { studyId: 'own' } }), /storage unavailable/)
})


test('CyberJudah removes both app scopes and status while preserving Telegram and another reader', async () => {
  const f = fixture([
    ['users/alice', {}], ['staging_users/alice', {}],
    ['users-status/alice', {}], ['staging_users-status/alice', {}],
    ['staging_users/alice/notes/n/revisions/r', {}],
    ['studies/prod', { user: { id: 'alice' } }],
    ['staging_studies/stage', { user: { id: 'alice' } }],
    ['staging_studies/stage/revisions/r', {}],
    ['users/tg_123', {}], ['users/tg_123/notes/n', {}],
    ['studies/telegram', { user: { id: 'tg_123' } }],
    ['staging_users/bob', {}], ['studies/other', { user: { id: 'bob' } }],
  ], [], 'cyberjudah-app')
  await f.users.deleteUser({ uid: 'alice' })
  assert.deepEqual([...f.documents.keys()].sort(), [
    'staging_users/bob', 'studies/other', 'studies/telegram', 'users/tg_123', 'users/tg_123/notes/n',
  ])
})

test('CyberJudah native deletion ignores Telegram Auth identities', async () => {
  const entries = [['users/tg_123', {}], ['studies/t', { user: { id: 'tg_123' } }]]
  const f = fixture(entries, imageNames('t'), 'cyberjudah-app')
  await f.users.deleteUser({ uid: 'tg_123' })
  assert.deepEqual([...f.documents.entries()], entries)
  assert.equal(f.fileAttempts.length, 0)
})

test('staging cleanup cannot delete a production preview with the same study ID', async () => {
  const f = fixture([
    ['staging_studies/shared-id', { user: { id: 'alice' } }],
    ['studies/shared-id', { user: { id: 'bob' } }],
  ], imageNames('shared-id'), 'cyberjudah-app')
  await f.users.deleteUser({ uid: 'alice' })
  assert.ok(f.documents.has('studies/shared-id'))
  assert.deepEqual([...f.files], imageNames('shared-id'))
})


test('late revisions keep the parent discoverable and are removed on retry', async () => {
  const f = fixture([
    ['users/alice', {}], ['studies/own', { user: { id: 'alice' } }],
    ['studies/own/revisions/first', {}],
  ], [], 'cyberjudah-app')
  f.hooks.beforeDelete = async (path, documents) => {
    if (path === 'studies/own') {
      documents.set('studies/own/revisions/late', {})
      f.hooks.beforeDelete = async () => {}
    }
  }
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), { code: 9 })
  assert.ok(f.documents.has('studies/own'))
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
})

test('replacement ownership protects descendants before their deletion batch commits', async () => {
  const replacement = { user: { id: 'bob' } }, revision = { text: 'keep' }
  const f = fixture([
    ['studies/own', { user: { id: 'alice' } }], ['studies/own/revisions/r', revision],
  ], [], 'cyberjudah-app')
  f.hooks.beforeDelete = async (path, documents) => {
    if (path === 'studies/own/revisions/r') documents.set('studies/own', replacement)
  }
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), { code: 9 })
  assert.equal(f.documents.get('studies/own/revisions/r'), revision)
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.get('studies/own'), replacement)
  assert.equal(f.documents.get('studies/own/revisions/r'), revision)
})

test('a replacement parent owner survives a paused cleanup and its retry', async () => {
  const f = fixture([['studies/own', { user: { id: 'alice' } }]], [], 'cyberjudah-app')
  f.hooks.beforeDelete = async (path, documents) => {
    if (path === 'studies/own') documents.set(path, { user: { id: 'bob' } })
  }
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), { code: 9 })
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.get('studies/own')?.user.id, 'bob')
})

test('a changed profile survives the final conditional delete', async () => {
  const f = fixture([['users/alice', { generation: 1 }]], [], 'cyberjudah-app')
  f.hooks.beforeDelete = async (path, documents) => {
    if (path === 'users/alice') documents.set(path, { generation: 2 })
  }
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), { code: 9 })
  assert.equal(f.documents.get('users/alice')?.generation, 2)
})
