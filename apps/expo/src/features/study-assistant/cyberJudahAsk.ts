import { fetch as expoFetch } from 'expo/fetch'
import type { HistoryMessage } from '@bible-strong/ai-contract/contract'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'

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

export type CyberJudahSource = {
  n: number
  kind: string
  title: string
  url: string
  sub?: string
  video?: string
  t?: number
  date?: string
}
export type CyberJudahAnswer = { answer: string; sources: CyberJudahSource[] }

/** A refusal the screen explains: CONSENT carries the provider the reader must agree to. */
export class CyberJudahAskError extends Error {
  constructor(
    readonly code:
      | 'SIGN_IN_REQUIRED'
      | 'CONSENT'
      | 'DAILY_LIMIT'
      | 'PAUSED'
      | 'TOO_SHORT'
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
  if (status === 429)
    return new CyberJudahAskError(error === 'free-paused' ? 'PAUSED' : 'DAILY_LIMIT')
  if (status === 400 && error === 'too-short') return new CyberJudahAskError('TOO_SHORT')
  return new CyberJudahAskError('AI_UNAVAILABLE')
}

const sourceOf = (value: unknown): CyberJudahSource | null => {
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

export async function askCyberJudah(
  input: { question: string; history: HistoryMessage[]; consent: string[] },
  signal: AbortSignal
): Promise<CyberJudahAnswer> {
  const user = getCurrentAuthUser()
  if (!user) throw new CyberJudahAskError('SIGN_IN_REQUIRED')
  const token = await user.getIdToken()
  if (signal.aborted) throw new Error('INTERRUPTED')
  const response = await expoFetch(`${origin}/api/app/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ q: input.question, history: input.history, consent: input.consent }),
    signal,
  })
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || body?.ok !== true || typeof body.answer !== 'string')
    throw errorOf(response.ok ? 503 : response.status, body)
  const sources = Array.isArray(body.sources)
    ? body.sources.map(sourceOf).filter((s): s is CyberJudahSource => !!s)
    : []
  return { answer: body.answer, sources }
}
