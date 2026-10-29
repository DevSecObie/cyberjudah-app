import type { ResolvedPassageMediaLibraryItem } from '~features/bible/passageMedia'
import { storage } from '~helpers/storage'

// The classes come from CyberJudah's published notes index, so a newly published class appears
// without an app update. The last list read is kept on the phone for offline and instant opens.
const DATA_ORIGIN = 'https://data.cyberjudah.io'
const CACHE_KEY = 'cyberjudah.classLibrary.v1'
const SERIES_ORDER = ['IUIC in the ClassRoom', '15 Minutes w/ The Captains', 'Our Hidden History']
const CLASS_KINDS = new Set(['class', 'captains', 'history'])
// A neutral dark placeholder while a thumbnail loads.
const PLACEHOLDER_BLURHASH = 'L03+Gm%M00t7_3ofWBWB00of~qWB'

export type CyberJudahClass = ResolvedPassageMediaLibraryItem & {
  series: string
  date: string
  teacher: string
}

type NoteRow = {
  kind?: string
  title?: string
  url?: string
  date?: string
  series?: string
  teacher?: string
  videoId?: string | null
}
type HistoryRow = { videoId?: string | null; duration?: number }

const isVideoId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value)

/** Every published class with a video, grouped by series in their order, newest first. */
export const toClassLibrary = (notes: unknown, history: unknown = []): CyberJudahClass[] => {
  if (!Array.isArray(notes)) return []
  const durations = new Map<string, number>()
  if (Array.isArray(history)) {
    for (const row of history as HistoryRow[]) {
      if (isVideoId(row?.videoId) && Number.isFinite(row.duration) && row.duration! > 0) {
        durations.set(row.videoId, row.duration!)
      }
    }
  }
  const seen = new Set<string>()
  const classes: CyberJudahClass[] = []
  for (const row of notes as NoteRow[]) {
    if (!row || !CLASS_KINDS.has(row.kind ?? '') || !isVideoId(row.videoId)) continue
    if (!row.title || !row.series || seen.has(row.videoId)) continue
    seen.add(row.videoId)
    const workId = `cyberjudah-class-${row.videoId}`
    classes.push({
      workId,
      editionId: `${workId}:en`,
      attributionLabel: 'CyberJudah',
      reference: '',
      strongCodes: [],
      provider: 'youtube',
      providerId: row.videoId,
      sourceUrl: `https://www.youtube.com/watch?v=${row.videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`,
      blurHash: PLACEHOLDER_BLURHASH,
      title: row.title,
      durationSeconds: durations.get(row.videoId) ?? 0,
      categories: ['classroom'],
      series: row.series,
      subtitle: [row.date, row.teacher].filter(Boolean).join(' · '),
      date: row.date ?? '',
      teacher: row.teacher ?? '',
    })
  }
  const seriesRank = (series: string) => {
    const index = SERIES_ORDER.indexOf(series)
    return index < 0 ? SERIES_ORDER.length : index
  }
  return classes.sort(
    (a, b) =>
      seriesRank(a.series) - seriesRank(b.series) ||
      a.series.localeCompare(b.series) ||
      b.date.localeCompare(a.date)
  )
}

export const readCachedClassLibrary = (): CyberJudahClass[] | null => {
  try {
    const value = storage.getString(CACHE_KEY)
    const parsed = value ? JSON.parse(value) : null
    return Array.isArray(parsed) && parsed.length ? (parsed as CyberJudahClass[]) : null
  } catch {
    return null
  }
}

/** Read the published classes and keep them for the next open; never empties a kept list. */
export const loadClassLibrary = async (
  fetcher: typeof fetch = fetch
): Promise<CyberJudahClass[]> => {
  const read = async (path: string) => {
    const response = await fetcher(`${DATA_ORIGIN}${path}`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`CYBERJUDAH_CLASSES_UNAVAILABLE:${response.status}`)
    return response.json()
  }
  const [notes, history] = await Promise.all([
    read('/api/notes/index.json'),
    read('/api/history/index.json').catch(() => []),
  ])
  const classes = toClassLibrary(notes, history)
  if (!classes.length) throw new Error('CYBERJUDAH_CLASSES_EMPTY')
  storage.set(CACHE_KEY, JSON.stringify(classes))
  return classes
}

export const getCachedClassById = (workId: string): CyberJudahClass | null =>
  readCachedClassLibrary()?.find(item => item.workId === workId) ?? null
