import { fetch as expoFetch } from 'expo/fetch'
import { uuid } from 'expo-modules-core'
import type { HistoryMessage } from '@bible-strong/ai-contract/contract'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { sourceArtworkUrl } from './cyberJudahSourceArtwork'

/**
 * Ask CyberJudah in the app: the CyberJudah server's free Ask (`POST /api/app/ask`), answered
 * from the classes and the library with the sources it cited. Any signed-in account may ask;
 * there are no credits or purchases. Bible Strong's assistant servers are never called.
 */
export const isCyberJudahAssistant = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'

const origin = (
  process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ||
  'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
).replace(/\/+$/, '')
const SITE = 'https://cyberjudah.io'
const tracePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export function secureAskEndpoint(base: string, path: string) {
  const url = new URL(base)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  )
    throw new CyberJudahAskError('AI_UNAVAILABLE')
  return `${url.origin}${path}`
}

export type CyberJudahSource = {
  n: number
  kind: string
  title: string
  url: string
  sub?: string
  video?: string
  t?: number
  date?: string
  thumb?: string
  excerpt?: string
  evidence?: 'teaching' | 'scripture' | 'reference'
}
export type CyberJudahAnswer = {
  traceId?: string
  answer: string
  sources: CyberJudahSource[]
  model?: string
  followups?: string[]
  ui?: string
  teachingFound?: boolean
}
export type CyberJudahModel = { id: string; name: string; provider: string; what?: string }
export type CyberJudahEvent = {
  delta?: string
  status?: string
  reset?: boolean
  ui?: string
  sources?: CyberJudahSource[]
  teachingFound?: boolean
}

/** A refusal the screen explains: CONSENT carries the provider the reader must agree to. */
export class CyberJudahAskError extends Error {
  traceId?: string
  constructor(
    readonly code:
      | 'SIGN_IN_REQUIRED'
      | 'CONSENT'
      | 'DAILY_LIMIT'
      | 'PAUSED'
      | 'TOO_SHORT'
      | 'MODEL_UNAVAILABLE'
      | 'AI_UNAVAILABLE',
    readonly provider?: string
  ) {
    super(code)
  }
}

export const errorOf = (status: number, body: { error?: unknown; provider?: unknown } | null) => {
  const error = typeof body?.error === 'string' ? body.error : ''
  if (status === 401) return new CyberJudahAskError('SIGN_IN_REQUIRED')
  if (status === 428 && error === 'consent')
    return new CyberJudahAskError(
      'CONSENT',
      typeof body?.provider === 'string' ? body.provider.slice(0, 80) : undefined
    )
  if (status === 429 || error === 'limit' || error === 'free-paused')
    return new CyberJudahAskError(error === 'free-paused' ? 'PAUSED' : 'DAILY_LIMIT')
  if (status === 400 && error === 'too-short') return new CyberJudahAskError('TOO_SHORT')
  if (error === 'model-unavailable') return new CyberJudahAskError('MODEL_UNAVAILABLE')
  return new CyberJudahAskError('AI_UNAVAILABLE')
}

export const sourceOf = (value: unknown): CyberJudahSource | null => {
  const s = value as Record<string, unknown> | null
  if (!s || typeof s.n !== 'number' || typeof s.title !== 'string' || typeof s.url !== 'string')
    return null
  return {
    n: s.n,
    kind: typeof s.kind === 'string' ? s.kind : '',
    title: s.title,
    url: s.url,
    sub: typeof s.sub === 'string' && s.sub ? s.sub : undefined,
    video: typeof s.video === 'string' && /^[A-Za-z0-9_-]{11}$/.test(s.video) ? s.video : undefined,
    t: typeof s.t === 'number' && Number.isFinite(s.t) && s.t >= 0 ? Math.floor(s.t) : undefined,
    date: typeof s.date === 'string' && s.date ? s.date : undefined,
    thumb: sourceArtworkUrl(s.thumb),
    excerpt: typeof s.excerpt === 'string' ? s.excerpt.slice(0, 1000) : undefined,
    evidence: ['teaching', 'scripture', 'reference'].includes(String(s.evidence))
      ? (s.evidence as CyberJudahSource['evidence'])
      : undefined,
  }
}

/** Where a source opens: the class at the moment it was said, or its page on cyberjudah.io. */
export const sourceLink = (s: CyberJudahSource): string | undefined => {
  if (s.video) return `https://www.youtube.com/watch?v=${s.video}${s.t ? `&t=${s.t}s` : ''}`
  if (/^https:\/\//.test(s.url)) return s.url
  if (s.url.startsWith('/') && !s.url.startsWith('//')) return `${SITE}${s.url}`
  return undefined
}

/** The minutes and seconds a moment starts at, as a class timestamp reads. */
export const timestamp = (t: number) => {
  const h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = t % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** One random support identifier per attempt; never a UID or a credential. Automatic
 * retries are deliberately disabled because a repeated inference may consume more usage. */
export async function askCyberJudah(
  input: Parameters<typeof performAsk>[0],
  signal: AbortSignal,
  event?: (value: CyberJudahEvent) => void
): Promise<CyberJudahAnswer> {
  const traceId = uuid.v4()
  try {
    return { ...(await performAsk(input, signal, event, traceId)), traceId }
  } catch (error) {
    if (error instanceof Error) Object.assign(error, { traceId })
    throw error
  }
}

async function performAsk(
  input: {
    question: string
    history: HistoryMessage[]
    consent: string[]
    model?: string
    account?: string
    /** The passage the reader opened Ask from (askReading). */
    reading?: string
  },
  signal: AbortSignal,
  event: ((value: CyberJudahEvent) => void) | undefined,
  traceId: string
): Promise<CyberJudahAnswer> {
  const user = getCurrentAuthUser()
  if (!user || (input.account && user.uid !== input.account))
    throw new CyberJudahAskError('SIGN_IN_REQUIRED')
  const token = await user.getIdToken()
  if (getCurrentAuthUser()?.uid !== user.uid) throw new CyberJudahAskError('SIGN_IN_REQUIRED')
  if (signal.aborted) throw new Error('INTERRUPTED')
  const response = await expoFetch(secureAskEndpoint(origin, '/api/app/ask'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Trace-ID': traceId,
    },
    body: JSON.stringify({
      q: input.question,
      history: input.history,
      consent: input.consent,
      ui: 'study-v1',
      ...(input.model ? { model: input.model } : {}),
      ...(input.reading ? { reading: input.reading.slice(0, 40) } : {}),
      ...(event ? { stream: true } : {}),
    }),
    signal,
  })
  if (response.ok && response.headers?.get('content-type')?.includes('application/x-ndjson')) {
    if (!response.body) throw new CyberJudahAskError('AI_UNAVAILABLE')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = '',
      result: CyberJudahAnswer | undefined,
      size = 0
    const line = (raw: string) => {
      if (!raw.trim()) return
      const value = JSON.parse(raw) as Record<string, unknown>
      if (typeof value.error === 'string') throw errorOf(503, value)
      if (value.done === true && typeof value.answer === 'string') result = answerOf(value)
      else if (typeof value.ui === 'string' && value.ui.length <= 60000)
        event?.({
          ui: value.ui,
          sources: Array.isArray(value.sources)
            ? value.sources
                .map(sourceOf)
                .filter((s): s is CyberJudahSource => !!s)
                .slice(0, 12)
            : [],
          teachingFound: value.teachingFound === true,
        })
      else if (typeof value.delta === 'string') event?.({ delta: value.delta })
      else if (typeof value.status === 'string') event?.({ status: value.status })
      else if (value.reset === true) event?.({ reset: true })
    }
    try {
      for (;;) {
        if (signal.aborted) throw new Error('INTERRUPTED')
        const { value, done } = await reader.read()
        pending += decoder.decode(value, { stream: !done })
        size += value?.byteLength ?? 0
        if (size > 1_000_000 || pending.length > 150_000) throw new Error('ANSWER_TOO_LARGE')
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''
        lines.forEach(line)
        if (done) {
          line(pending)
          break
        }
      }
      if (!result) throw new Error('INCOMPLETE_STREAM')
      return result
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || body?.ok !== true || typeof body.answer !== 'string')
    throw errorOf(response.ok ? 503 : response.status, body)
  return answerOf(body)
}

function answerOf(body: Record<string, unknown>): CyberJudahAnswer {
  const sources = Array.isArray(body.sources)
    ? body.sources.map(sourceOf).filter((s): s is CyberJudahSource => !!s)
    : []
  return {
    answer: String(body.answer).slice(0, 60000),
    sources: sources.slice(0, 12),
    model: typeof body.model === 'string' ? body.model : undefined,
    followups: Array.isArray(body.followups)
      ? body.followups
          .filter((s): s is string => typeof s === 'string' && s.length <= 400)
          .slice(0, 3)
      : [],
    ...(typeof body.ui === 'string' && body.ui.length <= 60000
      ? { ui: body.ui, teachingFound: body.teachingFound === true }
      : {}),
  }
}

export async function askModels(signal: AbortSignal): Promise<{
  models: CyberJudahModel[]
  default: string
  maxQuestionLength: number
  purchasesEnabled: boolean
}> {
  const user = getCurrentAuthUser()
  if (!user) throw new CyberJudahAskError('SIGN_IN_REQUIRED')
  const response = await expoFetch(secureAskEndpoint(origin, '/api/app/ask/models'), {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    signal,
  })
  if (!response.ok) throw new Error('MODELS_UNAVAILABLE')
  const body = await response.json()
  if (!Array.isArray(body.models) || typeof body.default !== 'string')
    throw new Error('MODELS_UNAVAILABLE')
  return {
    models: body.models.filter(
      (m: CyberJudahModel) =>
        typeof m.id === 'string' && typeof m.name === 'string' && typeof m.provider === 'string'
    ),
    default: body.default,
    maxQuestionLength: body.maxQuestionLength === 4000 ? 4000 : 400,
    purchasesEnabled: body.billing?.purchasesEnabled === true,
  }
}

export async function reportAskAnswer(
  model: string | undefined,
  reason: 'wrong' | 'harmful',
  signal: AbortSignal,
  traceId?: string
) {
  const user = getCurrentAuthUser()
  if (!user) throw new CyberJudahAskError('SIGN_IN_REQUIRED')
  // Only model, reason and the optional random support ID; never the question/answer.
  const response = await expoFetch(secureAskEndpoint(origin, '/api/app/ask/report'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({
      model,
      reason,
      ...(traceId && tracePattern.test(traceId) ? { traceId } : {}),
    }),
    signal,
  })
  if (!response.ok) throw new Error('REPORT_UNAVAILABLE')
}
