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

/** The study notes in the notes index. */
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

// The King James Bible's 1611 order: the Old Testament, the Apocrypha, then the New Testament.
// Some Apocrypha books go by more than one name in the data set.
const KJV_1611_ORDER = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Esther',
  'Job',
  'Psalms',
  'Proverbs',
  'Ecclesiastes',
  'Song of Solomon',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  '1 Esdras',
  '2 Esdras',
  'Tobit',
  'Judith',
  ['Rest of Esther', 'Esther (Greek)'],
  'Wisdom of Solomon',
  ['Ecclesiasticus', 'Sirach'],
  'Baruch',
  ['Epistle of Jeremy', 'Epistle of Jeremiah'],
  'Song of the Three Children',
  'Susanna',
  'Bel and the Dragon',
  ['Prayer of Manasses', 'Prayer of Manasseh'],
  '1 Maccabees',
  '2 Maccabees',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
]
const BOOK_RANK = new Map(
  KJV_1611_ORDER.flatMap((names, rank) =>
    (Array.isArray(names) ? names : [names]).map(name => [name.toLowerCase(), rank] as const)
  )
)
const bookRank = (book: string) => BOOK_RANK.get(book.toLowerCase()) ?? KJV_1611_ORDER.length

/** The study notes a search leaves, a section per book in the 1611 order, chapters in order. */
export const studySections = (notes: StudyNoteRow[] | undefined, query = '') => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const byBook = new Map<string, StudyNoteRow[]>()
  for (const note of notes ?? []) {
    const text = `${note.title} ${note.range}`.toLowerCase()
    if (!words.every(word => text.includes(word))) continue
    byBook.set(note.book, [...(byBook.get(note.book) ?? []), note])
  }
  return [...byBook.entries()]
    .sort(([a], [b]) => bookRank(a) - bookRank(b))
    .map(([title, data]) => ({
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
