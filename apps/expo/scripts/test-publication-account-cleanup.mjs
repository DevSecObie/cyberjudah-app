import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const servers = ['https://cyberjudah.io', 'https://cyberjudah-telegram-staging.oisrae1.workers.dev']
function fixture(server = servers[0]) {
  let current = { uid: 'alice', getIdToken: async () => 'test-token-alice' }
  const requests = []
  const f = { requests, setCurrent: value => { current = value }, response: async () => ({ ok: true }) }
  const source = readFileSync(new URL('../src/features/studies/publishedStudies.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
    process: { env: { EXPO_PUBLIC_CYBERJUDAH_API_URL: server } }, AbortSignal,
    fetch: async (url, init) => { requests.push({ url, ...init }); return f.response(url) },
  })(id => {
    if (id === '~helpers/firebaseAuthRuntime') return { getCurrentAuthUser: () => current }
    if (id === './studyMarkdown') return { studyMarkdown: () => '' }
    throw new Error(`Unexpected import: ${id}`)
  }, module, module.exports)
  return { ...f, set response(value) { f.response = value }, run: module.exports.deleteNativeWorkerAccountData }
}

test('account cleanup calls both existing stores with the same captured identity', async () => {
  for (const configured of servers) {
    const f = fixture(configured)
    await f.run('alice')
    assert.deepEqual(f.requests.map(r => r.url), ['/api/published-studies', '/api/firebase/link'].flatMap(path => servers.map(s => `${s}${path}`)))
    assert.ok(f.requests.every(r => r.method === 'DELETE' && r.headers.authorization === 'Bearer test-token-alice'))
  }
})

test('either store failure rejects cleanup so Auth deletion cannot proceed', async () => {
  for (const failing of servers) {
    const f = fixture()
    f.response = async url => url.startsWith(failing)
      ? { ok: false, status: 503, json: async () => ({ error: 'store_unavailable' }) } : { ok: true }
    await assert.rejects(f.run('alice'), /store_unavailable/)
  }
})

test('an account switch stops cleanup without using the replacement identity', async () => {
  const f = fixture()
  f.response = async () => { f.setCurrent({ uid: 'bob' }); return { ok: true } }
  await assert.rejects(f.run('alice'), /account_changed/)
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].headers.authorization, 'Bearer test-token-alice')
})

test('unknown environments and mismatched identities send no cleanup requests', async () => {
  const unknown = fixture('https://unrelated.example')
  await assert.rejects(unknown.run('alice'), /environment_unknown/)
  assert.equal(unknown.requests.length, 0)
  const wrong = fixture()
  await assert.rejects(wrong.run('bob'), /account_changed/)
  assert.equal(wrong.requests.length, 0)
})

for (const platform of ['ts', 'web.ts']) test(`${platform}: Auth deletion cannot target a switched account`, async () => {
  let current = { uid: 'bob' }
  const deleted = []
  const module = { exports: {} }
  const source = readFileSync(new URL(`../src/helpers/firebaseAuthRuntime.${platform}`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`)(() => ({
    getAuth: () => ({ currentUser: current }), firebaseApp: {}, deleteUser: async user => deleted.push(user.uid),
  }), module, module.exports)
  await assert.rejects(module.exports.deleteCurrentAuthUser('alice'), { code: 'auth/user-mismatch' })
  assert.deepEqual(deleted, [])
  current = { uid: 'alice' }
  await module.exports.deleteCurrentAuthUser('alice')
  assert.deepEqual(deleted, ['alice'])
})
