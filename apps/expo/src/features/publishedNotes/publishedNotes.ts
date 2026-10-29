import { storage } from '~helpers/storage'

// The notes the Telegram app lists outside the classes: "4 Chapters a Day" (a study note for
// every chapter) and the Encyclopedia. Read from CyberJudah's published data set, so a new note
// appears without an app update; the last list read is kept for offline and instant opens.
const DATA_ORIGIN = 'https://data.cyberjudah.io'
const STUDY_CACHE_KEY = 'cyberjudah.studyNotes.v1'
const ENCYCLOPEDIA_CACHE_KEY = 'cyberjudah.encyclopedia.v1'

export type StudyNoteRow = {
  title: string
  /** The note's address on cyberjudah.io, e.g. "/study/genesis/1". */
  url: string
  book: string
  /** The first chapter it covers, for ordering. */
  chapter: number
  range: string
}

export type EncyclopediaRow = { slug: string; title: string; url: string; summary: string }

type IndexRow = {
  kind?: string
  title?: string
  url?: string
  book?: string | null
  chapters?: [number, number] | null
  range?: string
}

const readJson = async <T>(path: string, fetcher: typeof fetch): Promise<T> => {
  const response = await fetcher(`${DATA_ORIGIN}${path}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_NOTES_UNAVAILABLE:${response.status}`)
  return response.json() as Promise<T>
}

const readCache = <T>(key: string): T[] | null => {
  try {
    const value = storage.getString(key)
    const parsed = value ? JSON.parse(value) : null
    return Array.isArray(parsed) && parsed.length ? (parsed as T[]) : null
  } catch {
    return null
  }
}

const isNotePath = (url: unknown): url is string =>
  typeof url === 'string' && /^\/[a-z0-9/_-]+$/i.test(url)

/** The study notes in the notes index, in the order the data set lists the books. */
export const toStudyNotes = (rows: unknown): StudyNoteRow[] =>
  (Array.isArray(rows) ? (rows as IndexRow[]) : [])
    .filter(row => row?.kind === 'study' && row.title && isNotePath(row.url))
    .map(row => ({
      title: row.title!,
      url: row.url!,
      book: row.book || 'Other',
      chapter: row.chapters?.[0] ?? 0,
      range: row.range ?? '',
    }))

export const readCachedStudyNotes = () => readCache<StudyNoteRow>(STUDY_CACHE_KEY)

export const loadStudyNotes = async (fetcher: typeof fetch = fetch) => {
  const notes = toStudyNotes(await readJson<unknown>('/api/notes/index.json', fetcher))
  if (!notes.length) throw new Error('CYBERJUDAH_NOTES_EMPTY')
  storage.set(STUDY_CACHE_KEY, JSON.stringify(notes))
  return notes
}

/** The study notes a search leaves, a section per book, chapters in order (as in Telegram). */
export const studySections = (notes: StudyNoteRow[] | undefined, query = '') => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const byBook = new Map<string, StudyNoteRow[]>()
  for (const note of notes ?? []) {
    const text = `${note.title} ${note.range}`.toLowerCase()
    if (!words.every(word => text.includes(word))) continue
    byBook.set(note.book, [...(byBook.get(note.book) ?? []), note])
  }
  return [...byBook.entries()].map(([title, data]) => ({
    title,
    data: [...data].sort((a, b) => a.chapter - b.chapter),
  }))
}

/** "Genesis 1: The Generations of the Heavens" without the reference before the colon. */
export const studyNoteHeading = (title: string) => title.replace(/^[^:]+:\s*/, '')

export const readCachedEncyclopedia = () => readCache<EncyclopediaRow>(ENCYCLOPEDIA_CACHE_KEY)

export const loadEncyclopedia = async (fetcher: typeof fetch = fetch) => {
  const rows = await readJson<unknown>('/api/encyclopedia/index.json', fetcher)
  const entries = (Array.isArray(rows) ? (rows as Partial<EncyclopediaRow>[]) : [])
    .filter(row => row?.title && isNotePath(row.url))
    .map(row => ({
      slug: row.slug ?? row.url!,
      title: row.title!,
      url: row.url!,
      summary: row.summary ?? '',
    }))
  if (!entries.length) throw new Error('CYBERJUDAH_NOTES_EMPTY')
  storage.set(ENCYCLOPEDIA_CACHE_KEY, JSON.stringify(entries))
  return entries
}

/** A note address the app opens itself: a study note or an encyclopedia entry. */
export const publishedNotePathOf = (href: string) => {
  const m = /^https:\/\/cyberjudah\.io(\/(?:study|encyclopedia)\/[a-z0-9/_-]+)(?:[?#].*)?$/i.exec(
    href
  )
  return m ? m[1].replace(/\/$/, '') : null
}
