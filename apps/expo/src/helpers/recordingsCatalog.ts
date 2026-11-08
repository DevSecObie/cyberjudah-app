import books from '~assets/cyberjudah/books.json'
import bundled from '~assets/cyberjudah/apocrypha-recordings.json'
import { runWithRequestDeadline } from './resourceAppCheckRequest'

export const RECORDINGS_CATALOG_URL = 'https://cyberjudah.io/api/recordings/catalog'
const AUDIO_ORIGIN = 'https://cyberjudah.io/api/audio/'
const booksByNumber = new Map(books.map(book => [book.id, book]))

export type RecordingChapter = {
  slug: string
  chapter: number
  audio: string
  sha256: string
}
export type RecordingsCatalog = { chapters: RecordingChapter[] }

/** The same 81 book identities and slugs used by CyberJudah's Bible reader and site links. */
export const getRecordingBookSlug = (book: number) => booksByNumber.get(book)?.slug

export const parseRecordingsCatalog = (value: unknown): RecordingsCatalog => {
  const catalog = value as Partial<RecordingsCatalog> | null
  if (!catalog || !Array.isArray(catalog.chapters)) throw new Error('RECORDINGS_CATALOG_INVALID')
  const chapters = catalog.chapters.map(row => {
    if (
      !row ||
      typeof row.slug !== 'string' ||
      !/^[a-z0-9-]+$/.test(row.slug) ||
      !Number.isSafeInteger(row.chapter) ||
      row.chapter < 1 ||
      typeof row.audio !== 'string' ||
      !new RegExp(`^recordings/[a-z0-9-]+/${row.slug}/${row.chapter}\\.m4a$`).test(row.audio) ||
      typeof row.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(row.sha256)
    ) {
      throw new Error('RECORDINGS_CATALOG_INVALID')
    }
    return { slug: row.slug, chapter: row.chapter, audio: row.audio, sha256: row.sha256 }
  })
  return { chapters }
}

export const loadRecordingsCatalog = (fetcher: typeof fetch = fetch, signal?: AbortSignal) =>
  runWithRequestDeadline(
    async requestSignal => {
      const response = await fetcher(RECORDINGS_CATALOG_URL, {
        headers: { accept: 'application/json' },
        signal: requestSignal,
      })
      if (!response.ok) throw new Error(`RECORDINGS_CATALOG_UNAVAILABLE:${response.status}`)
      return parseRecordingsCatalog(await response.json())
    },
    signal,
    10_000
  )

export const getRecordingAudioUrl = (
  book: number,
  chapter: number,
  catalog?: RecordingsCatalog | null
): string => {
  const identity = booksByNumber.get(book)
  if (!identity?.chapters.includes(chapter)) return ''
  if (catalog) {
    const recording = catalog.chapters.find(
      row => row.slug === identity.slug && row.chapter === chapter
    )
    return recording ? `${AUDIO_ORIGIN}${recording.audio}?v=${recording.sha256}` : ''
  }
  const recording = (
    bundled.books as Record<string, { slug: string; reader: string; chapters: number[] }>
  )[book]
  if (!recording?.chapters.includes(chapter)) return ''
  const audio = `recordings/${recording.reader}/${recording.slug}/${chapter}.m4a`
  const sha256 = (bundled.sha256 as Record<string, string>)[audio]
  return sha256 ? `${AUDIO_ORIGIN}${audio}?v=${sha256}` : ''
}
