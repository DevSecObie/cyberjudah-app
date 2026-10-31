import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'

// "Said in Class": the spoken words of every recording (its transcript), searched on CyberJudah's
// server, the same search the site and the Telegram app read. The transcripts are too big to keep
// on a phone; each result is a passage as it was said, with the second it was said at.

const ORIGIN = (
  process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ||
  'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
).replace(/\/+$/, '')

export type SaidInClassHit = {
  title: string
  feed: string
  date: string
  video: string
  start: number
  note: string
  excerpt: string
  /** The excerpt with each matched word wrapped in {{ }}, as the search marked it. */
  marked: string
}

export type SaidInClassResult = { signedIn: boolean; hits: SaidInClassHit[]; more: boolean }

// The search marks each matched word with a pair of private-use characters, for highlighting.
const MARKS = /[]/g

/** The passages of every recording that say the words, best first. */
export const searchSaidInClass = async (
  query: string,
  page = 0,
  fetcher: typeof fetch = fetch,
  user = getCurrentAuthUser()
): Promise<SaidInClassResult> => {
  const q = query.trim().slice(0, 200)
  if (q.length < 3) return { signedIn: !!user, hits: [], more: false }
  if (!user) return { signedIn: false, hits: [], more: false }
  const token = await user.getIdToken()
  const response = await fetcher(
    `${ORIGIN}/api/app/teachings?${new URLSearchParams({ q, page: String(page) })}`,
    { headers: { accept: 'application/json', authorization: `Bearer ${token}` } }
  )
  if (response.status === 401) return { signedIn: false, hits: [], more: false }
  if (!response.ok) throw new Error(`CYBERJUDAH_SAID_IN_CLASS_UNAVAILABLE:${response.status}`)
  const body = (await response.json()) as { ok?: boolean; hits?: SaidInClassHit[]; more?: boolean }
  if (body.ok === false) throw new Error('CYBERJUDAH_SAID_IN_CLASS_UNAVAILABLE')
  return {
    signedIn: true,
    more: !!body.more,
    hits: (body.hits ?? [])
      .filter(hit => typeof hit.video === 'string' && /^[\w-]{11}$/.test(hit.video))
      .map(hit => ({
        ...hit,
        start: Math.max(0, Math.floor(Number(hit.start) || 0)),
        excerpt: (hit.excerpt ?? '').replace(MARKS, '').replace(/\s+/g, ' ').trim(),
        marked: (hit.excerpt ?? '')
          .replace(/\uE000/g, '{{')
          .replace(/\uE001/g, '}}')
          .replace(/\s+/g, ' ')
          .trim(),
      })),
  }
}

/** A second as the classes write it: 1:04:05 or 4:05. */
export const formatMoment = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
