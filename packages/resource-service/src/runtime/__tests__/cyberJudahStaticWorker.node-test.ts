import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createFirebaseAppCheckConfig, verifyFirebaseAppCheckRequest } from '../firebaseAppCheck'
import {
  createCyberJudahStaticWorker,
  type CyberJudahStaticEnv,
  type CyberJudahStaticManifest,
} from '../cyberJudahStaticWorker'

const native = '1:123:ios:release'
const web = '1:123:web:web'
const route = '/v1/offline-artifacts/bibles/fixture.zip'
const hash = 'a'.repeat(64)
const manifest: CyberJudahStaticManifest = {
  schemaVersion: 1,
  release: 'fixture',
  catalogTarget: '/__cyberjudah/catalog.json',
  artifacts: { [route]: { target: '/__cyberjudah/files/fixture.zip', sha256: hash, bytes: 8 } },
  cdn: {
    'assets.cyberjudah.io/pictures/fixture.jpg': {
      target: '/__cyberjudah/files/fixture.jpg',
      sha256: hash,
      bytes: 8,
    },
  },
}
const setup = (subject?: string) => {
  const assetRequests: Request[] = []
  const limiterKeys: string[] = []
  const env: CyberJudahStaticEnv = {
    ASSETS: {
      async fetch(request) {
        assetRequests.push(request)
        const path = new URL(request.url).pathname
        if (path.endsWith('manifest.json')) return Response.json(manifest)
        if (path.endsWith('catalog.json')) return Response.json({ resourceCount: 1 })
        if (request.headers.has('if-none-match')) return new Response(null, { status: 304 })
        if (request.headers.has('range'))
          return new Response('part', { status: 206, headers: { 'content-range': 'bytes 0-3/8' } })
        return new Response('artifact', { headers: { etag: 'fixture' } })
      },
    },
    FIREBASE_APP_CHECK_PROJECT_NUMBER: '123',
    FIREBASE_APP_CHECK_ALLOWED_APP_IDS: `${native},${web}`,
    RESOURCE_WEB_ORIGINS: 'https://cyberjudah.io',
    ARTIFACT_RATE_LIMITER: {
      async limit({ key }) {
        limiterKeys.push(key)
        return { success: true }
      },
    },
  }
  return {
    env,
    assetRequests,
    limiterKeys,
    worker: createCyberJudahStaticWorker(async () => subject),
  }
}
const request = (path: string, init?: RequestInit) =>
  new Request(`https://api.cyberjudah.io${path}`, init)

test('serves the catalog publicly but rejects missing or web attestation before any asset/cache read', async () => {
  for (const subject of [undefined, web]) {
    const f = setup(subject)
    const denied = await f.worker.fetch(
      request(route, { headers: { 'if-none-match': 'fixture' } }),
      f.env
    )
    assert.equal(denied.status, subject ? 403 : 401)
    assert.equal(denied.headers.get('cache-control'), 'private, no-store')
    assert.equal(f.assetRequests.length, 0)
    assert.equal(f.limiterKeys.length, 0)
    assert.equal((await f.worker.fetch(request('/v1/offline-catalog'), f.env)).status, 200)
  }
})

test('preserves ranges, conditional requests and HEAD only after native attestation and rate limiting', async () => {
  const f = setup(native)
  const response = await f.worker.fetch(
    request(`${route}?sha256=${hash}`, {
      headers: {
        range: 'bytes=0-3',
        'X-Firebase-AppCheck': 'secret-token',
        authorization: 'secret-auth',
        cookie: 'secret-cookie',
      },
    }),
    f.env
  )
  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 0-3/8')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const internal = f.assetRequests.at(-1)!
  for (const header of ['X-Firebase-AppCheck', 'authorization', 'cookie'])
    assert.equal(internal.headers.has(header), false)
  assert.equal(f.limiterKeys[0].length, 64)
  assert.notEqual(f.limiterKeys[0], 'secret-token')
  assert.equal(
    (await f.worker.fetch(request(route, { headers: { 'if-none-match': 'fixture' } }), f.env))
      .status,
    304
  )
  const head = await f.worker.fetch(request(route, { method: 'HEAD' }), f.env)
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-length'), '8')
  assert.equal(await head.text(), '')
})

test('streams correct single ranges when the asset binding ignores Range, including suffixes and If-Range', async () => {
  const f = setup(native)
  const original = f.env.ASSETS.fetch
  f.env.ASSETS.fetch = req =>
    req.headers.has('range')
      ? Promise.resolve(new Response('artifact', { headers: { etag: '"fixture"' } }))
      : original(req)
  for (const [range, expected, contentRange] of [
    ['bytes=2-4', 'tif', 'bytes 2-4/8'],
    ['bytes=-2', 'ct', 'bytes 6-7/8'],
    ['bytes=6-', 'ct', 'bytes 6-7/8'],
  ]) {
    const response = await f.worker.fetch(request(route, { headers: { range } }), f.env)
    assert.equal(response.status, 206)
    assert.equal(response.headers.get('content-range'), contentRange)
    assert.equal(await response.text(), expected)
  }
  for (const range of ['bytes=9-', 'bytes=0-1,3-4', 'bytes=-0', 'invalid']) {
    const response = await f.worker.fetch(request(route, { headers: { range } }), f.env)
    assert.equal(response.status, 416)
    assert.equal(response.headers.get('content-range'), 'bytes */8')
  }
  const full = await f.worker.fetch(
    request(route, { headers: { range: 'bytes=2-4', 'if-range': '"old"' } }),
    f.env
  )
  assert.equal(full.status, 200)
  assert.equal(await full.text(), 'artifact')
})

test('does not expose protected bytes through internal, alternate-host, encoded or missing routes', async () => {
  const f = setup(native)
  for (const url of [
    'https://api.cyberjudah.io/__cyberjudah/files/fixture.zip',
    'https://assets.cyberjudah.io/__cyberjudah/files/fixture.zip',
    `https://assets.cyberjudah.io${route}`,
    `https://media.cyberjudah.io${route}`,
    `https://cyberjudah-app.workers.dev${route}`,
    'https://api.cyberjudah.io/v1/offline-artifacts/bibles%2ffixture.zip',
    'https://api.cyberjudah.io/v1/offline-artifacts/missing.zip',
  ])
    assert.equal((await f.worker.fetch(new Request(url), f.env)).status, 404, url)
  assert.equal((await f.worker.fetch(request(`${route}?sha256=wrong`), f.env)).status, 409)
  assert.equal((await f.worker.fetch(request(route, { method: 'POST' }), f.env)).status, 405)
})

test('enforces the exact CDN manifest, CORS allowlist, and rate limit without upstream fallbacks', async () => {
  const f = setup(native)
  const cdn = await f.worker.fetch(
    new Request('https://assets.cyberjudah.io/pictures/fixture.jpg', {
      headers: { origin: 'https://cyberjudah.io' },
    }),
    f.env
  )
  assert.equal(cdn.status, 200)
  assert.equal(cdn.headers.get('access-control-allow-origin'), 'https://cyberjudah.io')
  assert.equal(
    (
      await f.worker.fetch(
        request('/v1/offline-catalog', { headers: { origin: 'https://unowned.example' } }),
        f.env
      )
    ).status,
    403
  )
  f.env.ARTIFACT_RATE_LIMITER = {
    async limit() {
      return { success: false }
    },
  }
  const limited = await f.worker.fetch(request(route), f.env)
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
})

test('returns explicit wire-compatible unavailable problems for unimplemented online GET and POST routes', async () => {
  const f = setup()
  for (const [path, method, code] of [
    ['/v1/bibles/KJV/books/1/chapters/1', 'GET', 'BIBLE_PUBLICATION_INACTIVE'],
    ['/v1/strong-lexicon/entries', 'GET', 'STRONG_LEXICON_PUBLICATION_INACTIVE'],
    ['/v1/commentaries/reading-index', 'POST', 'SUPPLEMENTARY_PUBLICATION_INACTIVE'],
    ['/v1/search-events', 'POST', 'SUPPLEMENTARY_PUBLICATION_INACTIVE'],
  ]) {
    const response = await f.worker.fetch(request(path, { method }), f.env)
    assert.equal(response.status, 503)
    const problem = (await response.json()) as { code: string; _tag: string }
    assert.equal(problem.code, code)
    assert.equal(problem._tag, 'ResourceUnavailableProblem')
  }
  assert.equal(f.assetRequests.length, 0)
})

test('uses the upstream JWT verifier against signed tokens and rejects wrong project, audience, expiry or app', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  const keys = createLocalJWKSet({ keys: [{ ...jwk, alg: 'RS256', kid: 'fixture' }] })
  const f = setup()
  const worker = createCyberJudahStaticWorker((req, env) =>
    verifyFirebaseAppCheckRequest(
      req,
      createFirebaseAppCheckConfig({
        projectNumber: env.FIREBASE_APP_CHECK_PROJECT_NUMBER,
        allowedAppIds: env.FIREBASE_APP_CHECK_ALLOWED_APP_IDS,
      }),
      keys
    )
  )
  const sign = (
    issuer = 'https://firebaseappcheck.googleapis.com/123',
    audience = 'projects/123',
    subject = native,
    expiry = '1h'
  ) =>
    new SignJWT({})
      .setProtectedHeader({ typ: 'JWT', alg: 'RS256', kid: 'fixture' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(subject)
      .setExpirationTime(expiry)
      .sign(privateKey)
  for (const token of [
    await sign('https://firebaseappcheck.googleapis.com/999'),
    await sign(undefined, 'projects/999'),
    await sign(undefined, undefined, '1:123:ios:unknown'),
    await sign(undefined, undefined, undefined, '-30s'),
    'malformed',
  ])
    assert.equal(
      (await worker.fetch(request(route, { headers: { 'X-Firebase-AppCheck': token } }), f.env))
        .status,
      401
    )
  assert.equal(f.assetRequests.length, 0)
  const valid = await sign()
  assert.equal(
    (await worker.fetch(request(route, { headers: { 'X-Firebase-AppCheck': valid } }), f.env))
      .status,
    200
  )
})
