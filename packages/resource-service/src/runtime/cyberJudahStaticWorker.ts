import {
  createFirebaseAppCheckConfig,
  isNativeFirebaseAppId,
  verifyFirebaseAppCheckRequest,
} from './firebaseAppCheck'

type Assets = { fetch(request: Request): Promise<Response> }
type Artifact = { target: string; sha256: string; bytes: number; resourceId?: string }
export type CyberJudahStaticManifest = {
  schemaVersion: 1
  release: string
  catalogTarget: string
  artifacts: Record<string, Artifact>
  cdn: Record<string, Artifact>
}
export type CyberJudahStaticEnv = {
  ASSETS: Assets
  FIREBASE_APP_CHECK_PROJECT_NUMBER: string
  FIREBASE_APP_CHECK_ALLOWED_APP_IDS: string
  RESOURCE_WEB_ORIGINS: string
  ARTIFACT_RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

const API = 'api.cyberjudah.io'
const CDN_HOSTS = new Set(['assets.cyberjudah.io', 'media.cyberjudah.io'])
const INTERNAL = '/__cyberjudah/'
const manifests = new WeakMap<Assets, Promise<CyberJudahStaticManifest>>()

const readManifest = (assets: Assets): Promise<CyberJudahStaticManifest> => {
  let pending = manifests.get(assets)
  if (!pending) {
    pending = (async () => {
      const response = await assets.fetch(
        new Request(`https://static.invalid${INTERNAL}manifest.json`)
      )
      if (!response.ok) throw new Error('STATIC_MANIFEST_UNAVAILABLE')
      const value = (await response.json()) as CyberJudahStaticManifest
      if (value.schemaVersion !== 1 || !value.catalogTarget.startsWith(INTERNAL))
        throw new Error('STATIC_MANIFEST_INVALID')
      return value
    })()
    manifests.set(assets, pending)
    pending.catch(() => manifests.delete(assets))
  }
  return pending
}

const failure = (status: number, code: string, requestId: string): Response =>
  Response.json(
    { status, code, requestId },
    { status, headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId } }
  )

const unavailableCode = (path: string): string => {
  if (path.startsWith('/v1/strong-bibles/')) return 'STRONG_BIBLE_PUBLICATION_INACTIVE'
  if (path.startsWith('/v1/interlinear-bibles/')) return 'INTERLINEAR_PUBLICATION_INACTIVE'
  if (path.startsWith('/v1/strong-lexicon/')) return 'STRONG_LEXICON_PUBLICATION_INACTIVE'
  if (path.startsWith('/v1/dictionaries')) return 'DICTIONARY_PUBLICATION_INACTIVE'
  if (path.startsWith('/v1/naves/')) return 'NAVE_PUBLICATION_INACTIVE'
  if (path.startsWith('/v1/timelines/')) return 'TIMELINE_PUBLICATION_INACTIVE'
  if (path.startsWith('/v1/bibles/')) return 'BIBLE_PUBLICATION_INACTIVE'
  return 'SUPPLEMENTARY_PUBLICATION_INACTIVE'
}

const unavailable = (path: string, requestId: string): Response =>
  Response.json(
    {
      _tag: 'ResourceUnavailableProblem',
      type: 'https://cyberjudah.io/problems/resource-unavailable',
      title: 'Resource unavailable',
      detail:
        'Online resource access is not available on this server yet. Installed offline copies remain available.',
      status: 503,
      code: unavailableCode(path),
      retryAfterSeconds: 300,
      requestId,
    },
    {
      status: 503,
      headers: {
        'cache-control': 'private, no-store',
        'retry-after': '300',
        'x-request-id': requestId,
      },
    }
  )

const rangeFrom = (header: string, size: number): { start: number; end: number } | undefined => {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header)
  if (!match || (!match[1] && !match[2]) || size === 0) return undefined
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < size
    ? { start, end }
    : undefined
}

const ifRangeMatches = (header: string | null, response: Response): boolean => {
  if (!header) return true
  if (header.startsWith('"')) return header === response.headers.get('etag')
  const modified = Date.parse(response.headers.get('last-modified') ?? '')
  const supplied = Date.parse(header)
  return Number.isFinite(modified) && Number.isFinite(supplied) && modified <= supplied
}

// Stream just the selected bytes; never buffer a whole 25 MiB archive in an isolate.
const sliceStream = (
  body: ReadableStream<Uint8Array>,
  start: number,
  length: number
): ReadableStream<Uint8Array> => {
  const reader = body.getReader()
  let position = 0
  let remaining = length
  const sliced = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (remaining > 0) {
          const { done, value } = await reader.read()
          if (done) throw new Error('STATIC_ASSET_TRUNCATED')
          const offset = Math.max(0, start - position)
          position += value.length
          if (offset >= value.length) continue
          const part = value.subarray(offset, offset + remaining)
          remaining -= part.length
          controller.enqueue(part)
          if (remaining === 0) {
            controller.close()
            await reader.cancel()
          }
          return
        }
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
  const runtime = globalThis as unknown as {
    FixedLengthStream?: new (length: number) => {
      readable: ReadableStream<Uint8Array>
      writable: WritableStream<Uint8Array>
    }
  }
  if (!runtime.FixedLengthStream) return sliced
  const fixed = new runtime.FixedLengthStream(length)
  void sliced.pipeTo(fixed.writable).catch(() => undefined)
  return fixed.readable
}

const serve = async (
  request: Request,
  env: CyberJudahStaticEnv,
  target: string,
  cacheControl: string,
  knownBytes?: number
): Promise<Response> => {
  if (!target.startsWith(INTERNAL)) throw new Error('STATIC_TARGET_INVALID')
  const headers = new Headers(request.headers)
  // The asset binding only receives download negotiation headers, never client credentials.
  for (const name of [...headers.keys()])
    if (!['range', 'if-range', 'if-none-match', 'if-modified-since', 'accept'].includes(name))
      headers.delete(name)
  const response = await env.ASSETS.fetch(
    new Request(`https://static.invalid${target}`, { method: request.method, headers })
  )
  if (![200, 206, 304, 416].includes(response.status)) throw new Error('STATIC_ASSET_UNAVAILABLE')
  const outgoing = new Headers(response.headers)
  outgoing.set('cache-control', cacheControl)
  outgoing.set('x-content-type-options', 'nosniff')
  if (knownBytes !== undefined) outgoing.set('accept-ranges', 'bytes')
  if (request.method === 'HEAD' && response.status === 200 && knownBytes !== undefined)
    outgoing.set('content-length', String(knownBytes))
  const requestedRange = request.headers.get('range')
  if (
    request.method === 'GET' &&
    response.status === 200 &&
    knownBytes !== undefined &&
    requestedRange &&
    ifRangeMatches(request.headers.get('if-range'), response)
  ) {
    const range = rangeFrom(requestedRange, knownBytes)
    if (!range) {
      await response.body?.cancel()
      outgoing.set('content-range', `bytes */${knownBytes}`)
      outgoing.delete('content-length')
      return new Response(null, { status: 416, headers: outgoing })
    }
    if (!response.body) throw new Error('STATIC_ASSET_BODY_MISSING')
    const length = range.end - range.start + 1
    outgoing.set('content-range', `bytes ${range.start}-${range.end}/${knownBytes}`)
    outgoing.set('content-length', String(length))
    return new Response(sliceStream(response.body, range.start, length), {
      status: 206,
      headers: outgoing,
    })
  }
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers: outgoing,
  })
}

export const createCyberJudahStaticWorker = (
  authorize: (request: Request, env: CyberJudahStaticEnv) => Promise<string | undefined> = (
    request,
    env
  ) =>
    verifyFirebaseAppCheckRequest(
      request,
      createFirebaseAppCheckConfig({
        projectNumber: env.FIREBASE_APP_CHECK_PROJECT_NUMBER,
        allowedAppIds: env.FIREBASE_APP_CHECK_ALLOWED_APP_IDS,
      })
    )
) => ({
  async fetch(request: Request, env: CyberJudahStaticEnv): Promise<Response> {
    const id = crypto.randomUUID()
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    const origins = new Set(env.RESOURCE_WEB_ORIGINS.split(',').map(value => value.trim()))
    const finish = (response: Response): Response => {
      const headers = new Headers(response.headers)
      headers.set('x-request-id', id)
      headers.set('x-content-type-options', 'nosniff')
      headers.set('referrer-policy', 'no-referrer')
      if (origin && origins.has(origin)) {
        headers.set('access-control-allow-origin', origin)
        headers.set(
          'access-control-expose-headers',
          'Content-Length, Content-Range, Accept-Ranges, ETag, X-Request-Id'
        )
        headers.append('vary', 'Origin')
      }
      return new Response(response.body, { status: response.status, headers })
    }
    if (url.hostname !== API && !CDN_HOSTS.has(url.hostname))
      return finish(failure(404, 'NOT_FOUND', id))
    if (url.pathname.startsWith(INTERNAL) || /%2f|%5c|%2e|\\/iu.test(url.pathname))
      return finish(failure(404, 'NOT_FOUND', id))
    if (origin && !origins.has(origin)) return finish(failure(403, 'ORIGIN_NOT_ALLOWED', id))
    if (request.method === 'OPTIONS') {
      const response = new Response(null, { status: 204 })
      response.headers.set('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS')
      response.headers.set(
        'access-control-allow-headers',
        'Content-Type, X-Firebase-AppCheck, Range, If-Range, If-None-Match, If-Modified-Since'
      )
      response.headers.set('access-control-max-age', '600')
      return finish(response)
    }
    const artifactPath = url.hostname === API && url.pathname.startsWith('/v1/offline-artifacts/')
    const staticPath =
      artifactPath || url.pathname === '/v1/offline-catalog' || CDN_HOSTS.has(url.hostname)
    if (staticPath && !['GET', 'HEAD'].includes(request.method))
      return finish(failure(405, 'METHOD_NOT_ALLOWED', id))
    if (!staticPath && url.hostname === API && url.pathname.startsWith('/v1/'))
      return finish(unavailable(url.pathname, id))
    try {
      // Verify before touching static assets or their cache, including HEAD/conditional requests.
      if (artifactPath) {
        const subject = await authorize(request, env)
        if (!subject) return finish(failure(401, 'APP_CHECK_REQUIRED', id))
        if (!isNativeFirebaseAppId(subject)) return finish(failure(403, 'NATIVE_APP_REQUIRED', id))
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(request.headers.get('X-Firebase-AppCheck') ?? '')
        )
        const key = Array.from(new Uint8Array(digest), byte =>
          byte.toString(16).padStart(2, '0')
        ).join('')
        if (!(await env.ARTIFACT_RATE_LIMITER.limit({ key })).success) {
          const response = failure(429, 'RESOURCE_RATE_LIMITED', id)
          response.headers.set('retry-after', '60')
          return finish(response)
        }
      }
      const manifest = await readManifest(env.ASSETS)
      if (url.hostname === API && url.pathname === '/v1/offline-catalog')
        return finish(await serve(request, env, manifest.catalogTarget, 'public, max-age=60'))
      const artifact = artifactPath
        ? manifest.artifacts[url.pathname]
        : manifest.cdn[`${url.hostname}${url.pathname}`]
      if (!artifact) return finish(failure(404, 'NOT_FOUND', id))
      const expectedHash = url.searchParams.get('sha256')
      if (expectedHash && expectedHash !== artifact.sha256)
        return finish(failure(409, 'ARTIFACT_HASH_MISMATCH', id))
      return finish(
        await serve(
          request,
          env,
          artifact.target,
          artifactPath ? 'private, no-store' : 'public, max-age=3600',
          artifact.bytes
        )
      )
    } catch {
      return finish(failure(503, 'RESOURCE_DELIVERY_UNAVAILABLE', id))
    }
  },
})

export default createCyberJudahStaticWorker()
