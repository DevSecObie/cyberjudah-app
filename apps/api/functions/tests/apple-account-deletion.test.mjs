import assert from 'node:assert/strict'
import { generateKeyPairSync, sign, verify, createPublicKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nativeRoot = path.resolve(root, '../../expo/src/helpers')
const now = Math.floor(Date.now() / 1000)
const appleKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
const clientKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const configuration = {
  clientId: 'io.cyberjudah.app',
  teamId: 'fixture-team',
  keyId: 'fixture-key',
  privateKey: clientKey.privateKey.export({ type: 'pkcs8', format: 'pem' }),
}
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const identity = (claims = {}, header = {}, key = appleKey.privateKey) => {
  const unsigned = `${encode({ alg: 'RS256', kid: 'fixture-apple-key', ...header })}.${encode({
    iss: 'https://appleid.apple.com',
    aud: configuration.clientId,
    sub: 'apple-owner',
    iat: now,
    exp: now + 300,
    ...claims,
  })}`
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`
}

// No real SDK, credentials or network: only Node crypto and the production source run here.
function loader(mocks, globals = {}) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const moduleRequire = id => {
      if (id in mocks) return mocks[id]
      if (id.startsWith('node:') || id === 'crypto') return require(id)
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), `${id}.ts`))
      throw new Error(`Unexpected dependency: ${id}`)
    }
    vm.runInNewContext(
      `(function(require,module,exports){${compiled}\n})`,
      {
        Buffer,
        URL,
        URLSearchParams,
        AbortSignal,
        Date,
        Error,
        console: new Proxy(
          {},
          {
            get: () => () => {
              throw new Error('Unexpected logging')
            },
          }
        ),
        fetch: () => {
          throw new Error('Real network is forbidden')
        },
        ...globals,
      },
      { filename }
    )(moduleRequire, module, module.exports)
    return module.exports
  }
  return load
}

class HttpsError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

function fixture(options = {}) {
  const events = []
  const requests = []
  const documents = new Map()
  const files = new Set()
  for (const prefix of ['', 'staging_']) {
    for (const uid of ['owner', 'other']) {
      documents.set(`${prefix}users/${uid}`, {})
      documents.set(`${prefix}users/${uid}/notes/note`, {})
      documents.set(`${prefix}users/${uid}/assistantConversations/chat/turns/turn`, {})
      documents.set(`${prefix}users/${uid}/orphan/missing/children/child`, {})
      documents.set(`${prefix}users-status/${uid}`, {})
      const studyId = `${prefix}${uid}-study`
      documents.set(`${prefix}studies/${studyId}`, { user: { id: uid }, published: true })
      documents.set(`${prefix}studies/${studyId}/revisions/revision`, {})
      files.add(`images/studies/${studyId}.jpg`)
      files.add(`images/studies/${studyId}-whatsapp.jpg`)
    }
  }
  const document = documentPath => ({
    path: documentPath,
    delete: async () => {
      events.push(`status:${documentPath}`)
      if (options.failStatus) throw new Error('status failure with sensitive payload')
      documents.delete(documentPath)
    },
  })
  const collection = name => ({
    doc: uid => document(`${name}/${uid}`),
    where: (field, operator, uid) => {
      assert.equal(field, 'user.id')
      assert.equal(operator, '==')
      assert.equal(uid, 'owner')
      return {
        limit: maximum => ({
          get: async () => {
            if (options.failRead) throw new Error('read failure')
            const docs = [...documents]
              .filter(
                ([key, value]) =>
                  key.startsWith(`${name}/`) &&
                  key.split('/').length === 2 &&
                  value.user?.id === uid
              )
              .slice(0, maximum)
              .map(([key]) => ({ id: key.split('/')[1], ref: document(key) }))
            return { empty: !docs.length, docs }
          },
        }),
      }
    },
  })
  const record = {
    uid: 'owner',
    providerData: options.apple === false ? [] : [{ providerId: 'apple.com', uid: 'apple-owner' }],
    ...options.user,
  }
  const admin = {
    firestore: () => ({
      collection,
      recursiveDelete: async ref => {
        events.push(`tree:${ref.path}`)
        if (options.failTree) throw new Error('tree failure')
        for (const key of documents.keys())
          if (key === ref.path || key.startsWith(`${ref.path}/`)) documents.delete(key)
      },
    }),
    storage: () => ({
      bucket: bucketName => {
        assert.equal(bucketName, 'cyberjudah-app.firebasestorage.app')
        return {
          file: name => ({
            delete: async settings => {
              assert.equal(settings.ignoreNotFound, true)
              events.push(`file:${name}`)
              if (options.failStorage) throw new Error('storage failure')
              files.delete(name)
            },
          }),
        }
      },
    }),
    auth: () => ({
      getUser: async uid => {
        assert.equal(uid, 'owner')
        events.push('lookup')
        return record
      },
      deleteUser: async uid => {
        assert.equal(uid, 'owner')
        events.push('auth:delete')
        if (options.failAuth) throw new Error('auth failure')
      },
    }),
  }
  const fetchFixture = async (url, init) => {
    assert.ok(url.startsWith('https://appleid.apple.com/auth/'))
    assert.equal(init.redirect, 'manual')
    assert.ok(init.signal instanceof AbortSignal)
    requests.push({ url, init })
    const endpoint = new URL(url).pathname
    events.push(`apple:${endpoint}`)
    if (options.failNetwork) throw new Error('network failure with sensitive payload')
    if (endpoint === '/auth/keys') {
      return {
        ok: !options.failKeys,
        json: async () => ({
          keys: [
            {
              ...appleKey.publicKey.export({ format: 'jwk' }),
              kid: 'fixture-apple-key',
              alg: 'RS256',
              use: 'sig',
            },
          ],
        }),
      }
    }
    assert.equal(init.method, 'POST')
    assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded')
    const fields = init.body
    assert.equal(fields.get('client_id'), configuration.clientId)
    const [header, payload, signature] = fields.get('client_secret').split('.')
    assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), {
      alg: 'ES256',
      kid: configuration.keyId,
    })
    const claims = JSON.parse(Buffer.from(payload, 'base64url'))
    assert.equal(claims.iss, configuration.teamId)
    assert.equal(claims.sub, configuration.clientId)
    assert.equal(claims.aud, 'https://appleid.apple.com')
    assert.equal(claims.exp - claims.iat, 300)
    assert.ok(
      verify(
        'sha256',
        Buffer.from(`${header}.${payload}`),
        {
          key: createPublicKey(clientKey.privateKey),
          dsaEncoding: 'ieee-p1363',
        },
        Buffer.from(signature, 'base64url')
      )
    )
    if (endpoint === '/auth/token') {
      assert.equal(fields.get('grant_type'), 'authorization_code')
      assert.equal(fields.get('code'), 'fixture-authorization-code')
      return {
        ok: !options.failExchange,
        json: async () =>
          options.tokens ?? {
            refresh_token: 'fixture-refresh-token',
            id_token: identity(options.claims, options.header, options.signingKey),
          },
      }
    }
    assert.equal(endpoint, '/auth/revoke')
    assert.equal(fields.get('token'), 'fixture-refresh-token')
    assert.equal(fields.get('token_type_hint'), 'refresh_token')
    return { ok: !options.failRevoke }
  }
  const wrap = runtimeOptions => handler => Object.assign(handler, { runtimeOptions })
  const functions = {
    https: { HttpsError },
    runWith: runtimeOptions => ({ https: { onCall: wrap(runtimeOptions) } }),
  }
  const env = {
    GCLOUD_PROJECT: 'cyberjudah-app',
    APPLE_SIGN_IN_CLIENT_ID: configuration.clientId,
    APPLE_SIGN_IN_TEAM_ID: configuration.teamId,
    APPLE_SIGN_IN_KEY_ID: configuration.keyId,
    APPLE_SIGN_IN_PRIVATE_KEY: configuration.privateKey,
    ...options.env,
  }
  const load = loader(
    { 'firebase-admin': admin, 'firebase-functions/v1': functions },
    {
      process: { env },
      fetch: fetchFixture,
    }
  )
  const { deleteAccount } = load(path.join(root, 'src/accountDeletion.ts'))
  const context = {
    auth: {
      uid: 'owner',
      token: {
        auth_time: now,
        firebase: { sign_in_provider: options.apple === false ? 'password' : 'apple.com' },
      },
    },
  }
  return { deleteAccount, context, events, requests, documents, files, load }
}

test('Apple deletion exchanges and verifies a code, revokes first, removes both namespaces and deletes only its own login last', async () => {
  const f = fixture()
  const otherDocuments = [...f.documents].filter(([key]) => key.includes('other'))
  assert.equal(
    (await f.deleteAccount({ authorizationCode: 'fixture-authorization-code' }, f.context)).deleted,
    true
  )
  assert.deepEqual([...f.documents], otherDocuments)
  assert.ok([...f.files].every(name => name.includes('other')))
  assert.equal(f.events.at(-1), 'auth:delete')
  assert.ok(
    f.events.indexOf('apple:/auth/revoke') < f.events.findIndex(event => event.startsWith('file:'))
  )
  assert.equal(f.deleteAccount.runtimeOptions.maxInstances, 3)
  assert.ok(f.deleteAccount.runtimeOptions.secrets.includes('APPLE_SIGN_IN_PRIVATE_KEY'))
})

test('password/Google accounts use the same recursive data deletion without Apple requests', async () => {
  for (const provider of ['password', 'google.com']) {
    const f = fixture({ apple: false })
    f.context.auth.token.firebase.sign_in_provider = provider
    await f.deleteAccount({}, f.context)
    assert.equal(f.requests.length, 0)
    assert.equal(f.events.at(-1), 'auth:delete')
  }
})

test('unauthenticated, anonymous, stale/future/revoked/disabled and wrong-project sessions cannot delete data', async () => {
  for (const scenario of [
    'absent',
    'anonymous',
    'stale',
    'future',
    'invalid-time',
    'revoked',
    'disabled',
    'wrong-project',
  ]) {
    const f = fixture({
      env: scenario === 'wrong-project' ? { GCLOUD_PROJECT: 'bible-strong-app' } : {},
      user:
        scenario === 'disabled'
          ? { disabled: true }
          : scenario === 'revoked'
            ? { tokensValidAfterTime: new Date((now + 1) * 1000).toISOString() }
            : {},
    })
    if (scenario === 'absent') delete f.context.auth
    if (scenario === 'anonymous') f.context.auth.token.firebase.sign_in_provider = 'anonymous'
    if (scenario === 'stale') f.context.auth.token.auth_time = now - 301
    if (scenario === 'future') f.context.auth.token.auth_time = now + 60
    if (scenario === 'invalid-time') f.context.auth.token.auth_time = NaN
    const before = [...f.documents]
    await assert.rejects(
      f.deleteAccount({ authorizationCode: 'fixture-authorization-code' }, f.context)
    )
    assert.deepEqual([...f.documents], before, scenario)
    assert.equal(f.requests.length, 0, scenario)
    assert.ok(
      f.events.every(event => event === 'lookup'),
      scenario
    )
  }
})

test('rejects attacker-selected UIDs, tokens, configuration and malformed payloads before SDK access', async () => {
  for (const data of [
    null,
    [],
    'code',
    { uid: 'other' },
    { token: 'stolen' },
    { client_id: 'other' },
    { authorizationCode: '' },
    { authorizationCode: 123 },
    { authorizationCode: 'x'.repeat(4097) },
  ]) {
    const f = fixture()
    await assert.rejects(f.deleteAccount(data, f.context), { code: 'invalid-argument' })
    assert.deepEqual(f.events, [])
  }
})

test('Apple-linked accounts require both an authorization code and fresh Apple reauthentication', async () => {
  for (const scenario of ['missing-code', 'password-session', 'unexpected-code']) {
    const f = fixture({ apple: scenario !== 'unexpected-code' })
    if (scenario === 'password-session') f.context.auth.token.firebase.sign_in_provider = 'password'
    await assert.rejects(
      f.deleteAccount(
        scenario === 'missing-code' ? {} : { authorizationCode: 'fixture-authorization-code' },
        f.context
      )
    )
    assert.deepEqual(f.events, ['lookup'])
  }
})

test('Apple failures and invalid identities never revoke another identity or start data deletion', async () => {
  const strangerKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  for (const options of [
    { failExchange: true },
    { failKeys: true },
    { failNetwork: true },
    { failRevoke: true },
    { tokens: {} },
    { tokens: { refresh_token: 'fixture', id_token: 'malformed' } },
    { claims: { sub: 'another-apple-user' } },
    { claims: { aud: 'another.app' } },
    { claims: { iss: 'https://attacker.invalid' } },
    { claims: { exp: now - 1 } },
    { claims: { iat: now - 301 } },
    { claims: { iat: now + 60 } },
    { claims: { nbf: now + 60 } },
    { header: { alg: 'none' } },
    { header: { kid: 'unknown-key' } },
    { signingKey: strangerKey.privateKey },
    { env: { APPLE_SIGN_IN_PRIVATE_KEY: '' } },
  ]) {
    const f = fixture(options)
    const before = [...f.documents]
    await assert.rejects(
      f.deleteAccount({ authorizationCode: 'fixture-authorization-code' }, f.context),
      error =>
        error.code === 'unavailable' && !/fixture|sensitive|token|payload|BEGIN/.test(error.message)
    )
    assert.deepEqual([...f.documents], before)
    assert.ok(f.events.every(event => event === 'lookup' || event.startsWith('apple:')))
    if (!options.failRevoke) assert.ok(!f.events.includes('apple:/auth/revoke'))
  }
})

test('Firestore/Storage failures preserve the login and retry remaining data; Auth failure is not reported as success', async () => {
  for (const failure of ['failRead', 'failTree', 'failStorage', 'failStatus', 'failAuth']) {
    const options = { apple: false, [failure]: true }
    const f = fixture(options)
    await assert.rejects(f.deleteAccount({}, f.context), { code: 'unavailable' })
    if (failure !== 'failAuth') assert.ok(!f.events.includes('auth:delete'))
    options[failure] = false
    await f.deleteAccount({}, f.context)
    assert.equal(f.events.at(-1), 'auth:delete')
  }
})

test('study cleanup pages through more than one batch and never removes another owner', async () => {
  const f = fixture({ apple: false })
  for (let i = 0; i < 205; i++) f.documents.set(`studies/extra-${i}`, { user: { id: 'owner' } })
  await f.deleteAccount({}, f.context)
  assert.ok([...f.documents.values()].every(value => value.user?.id !== 'owner'))
  assert.ok(f.documents.has('studies/other-study'))
})

test('native request preserves the recent-login error, rejects account switches and sends only a code to CyberJudah', async () => {
  const load = loader({})
  const { requestAccountDeletion } = load(path.join(nativeRoot, 'requestAccountDeletion.ts'))
  const user = {
    uid: 'owner',
    getIdToken: async force => {
      assert.equal(force, true)
      return 'fixture-firebase-token'
    },
    getIdTokenResult: async () => ({ authTime: new Date(now * 1000).toISOString() }),
  }
  let calls = 0
  const request = async (url, init) => {
    calls++
    assert.equal(url, 'https://us-central1-cyberjudah-app.cloudfunctions.net/deleteAccount')
    assert.equal(init.headers.Authorization, 'Bearer fixture-firebase-token')
    assert.deepEqual(JSON.parse(init.body), {
      data: { authorizationCode: 'fixture-authorization-code' },
    })
    return { ok: true, json: async () => ({ result: { deleted: true } }) }
  }
  await requestAccountDeletion(user, 'fixture-authorization-code', () => 'owner', request)
  await assert.rejects(requestAccountDeletion(user, undefined, () => 'other', request))
  for (const authTime of [
    'invalid',
    new Date((now - 301) * 1000).toISOString(),
    new Date((now + 60) * 1000).toISOString(),
  ]) {
    await assert.rejects(
      requestAccountDeletion(
        { ...user, getIdTokenResult: async () => ({ authTime }) },
        undefined,
        () => 'owner',
        request
      ),
      { code: 'auth/requires-recent-login' }
    )
  }
  assert.equal(calls, 1)
  await assert.rejects(
    requestAccountDeletion(
      user,
      undefined,
      () => 'owner',
      async () => ({
        ok: false,
        json: async () => ({ error: { details: { reason: 'requires-recent-login' } } }),
      })
    ),
    { code: 'auth/requires-recent-login' }
  )
  for (const response of [
    { ok: false, json: async () => ({ error: { message: 'sensitive token' } }) },
    { ok: true, json: async () => ({ result: {} }) },
  ]) {
    await assert.rejects(
      requestAccountDeletion(
        user,
        undefined,
        () => 'owner',
        async () => response
      ),
      { message: 'Account deletion could not finish. Please try again.' }
    )
  }
})

test('the existing native deletion action reauthenticates Apple without replacing the UI or deleting Auth locally', async () => {
  for (const scenario of [
    'apple',
    'google',
    'cancel',
    'mismatch',
    'missing-code',
    'switch',
    'wrong-project',
    'signed-out',
  ]) {
    const events = []
    const user = {
      uid: 'owner',
      providerData: scenario === 'google' ? [] : [{ providerId: 'apple.com' }],
    }
    let currentUser = scenario === 'signed-out' ? null : user
    const load = loader({
      '@react-native-firebase/app': {
        getApp: () => ({
          options: {
            projectId: scenario === 'wrong-project' ? 'bible-strong-app' : 'cyberjudah-app',
          },
        }),
      },
      '@react-native-firebase/auth': {
        getAuth: () => ({ currentUser }),
        AppleAuthProvider: {
          credential: (token, nonce) => {
            assert.equal(token, 'fixture-identity-token')
            assert.equal(nonce, 'fixture-nonce')
            return 'fixture-credential'
          },
        },
        reauthenticateWithCredential: async (account, credential) => {
          assert.equal(account.uid, 'owner')
          assert.equal(credential, 'fixture-credential')
          events.push('reauth')
          if (scenario === 'mismatch') throw new Error('identity mismatch')
        },
      },
      '@invertase/react-native-apple-authentication': {
        appleAuth: {
          Operation: { LOGIN: 'LOGIN' },
          performRequest: async request => {
            assert.equal(request.requestedOperation, 'LOGIN')
            events.push('apple')
            if (scenario === 'cancel') throw new Error('cancelled')
            if (scenario === 'switch') currentUser = { uid: 'other' }
            return {
              identityToken: 'fixture-identity-token',
              nonce: 'fixture-nonce',
              authorizationCode: scenario === 'missing-code' ? null : 'fixture-authorization-code',
            }
          },
        },
      },
      './requestAccountDeletion': {
        requestAccountDeletion: async (account, code, currentUserId) => {
          assert.equal(account.uid, 'owner')
          assert.equal(currentUserId(), 'owner')
          assert.equal(code, scenario === 'google' ? undefined : 'fixture-authorization-code')
          events.push('delete')
        },
      },
    })
    const { deleteCurrentAuthUser } = load(path.join(nativeRoot, 'firebaseAuthRuntime.ts'))
    if (['apple', 'google', 'signed-out'].includes(scenario)) {
      await deleteCurrentAuthUser()
      assert.deepEqual(
        events,
        scenario === 'apple'
          ? ['apple', 'reauth', 'delete']
          : scenario === 'google'
            ? ['delete']
            : []
      )
    } else {
      await assert.rejects(deleteCurrentAuthUser())
      assert.ok(!events.includes('delete'), scenario)
    }
  }
})
