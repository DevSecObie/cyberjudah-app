// The books the classes read from: CyberJudah's public-domain library, page by page as printed,
// with every moment a class read from them. Read from CyberJudah's published data set, so a new
// book shows up without an app update. Shapes follow cyberjudah-telegram app/src/api/data.ts.
const DATA_ORIGIN = 'https://data.cyberjudah.io'

const SLUG = /^[a-z0-9][a-z0-9-]*$/i

const readJson = async <T>(path: string, fetcher: typeof fetch = fetch): Promise<T> => {
  const response = await fetcher(`${DATA_ORIGIN}${path}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_DATA_UNAVAILABLE:${response.status}`)
  return response.json() as Promise<T>
}

/** A data-set address made whole: the covers are written from the data set's root. */
export const dataUrl = (path: string | null | undefined) =>
  !path ? undefined : path.startsWith('/') ? `${DATA_ORIGIN}${path}` : path

export type LibraryRow = {
  slug: string
  title: string
  subtitle: string
  author: string
  year: number
  pages: number
  volumes: number
  chapters: number
  figures: number
  cover: string | null
  reads: number
  classes: number
}

/** A moment a class read from a book: the class, the second, and the page it read. */
export type ClassReading = {
  video: string
  vol: number
  page: number
  t: number
  ts: string
  title: string
  date: string | null
  teacher: string
  url: string | null
}

export type BookChapterRow = {
  k: number
  n: string
  title: string
  vol: number
  volume: string
  page: number
  end: number
  topics: string
  reads: number
}

export type LibraryBook = LibraryRow & {
  publisher: string
  license: string
  source: string
  items: { id: string; label: string }[]
  scan: string
  chapters: BookChapterRow[]
  reads: ClassReading[]
}

export type BookPage = {
  vol: number
  page: number
  img: number
  words: number
  text: string
  reads: Omit<ClassReading, 'page' | 'vol'>[]
}

export type LibraryChapter = BookChapterRow & { item: string | null; pages: BookPage[] }

/** The books the classes read most come first, then A to Z. */
export const byClassUse = (books: LibraryRow[]) =>
  [...books].sort((a, b) => b.classes - a.classes || a.title.localeCompare(b.title))

/** The newest class first. */
export const newestReadingsFirst = (reads: ClassReading[]) =>
  [...reads].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.t - b.t)

/** "p. 246", or "vol. 2, p. 246" in a work of several volumes. */
export const pageLabel = (book: { volumes: number }, vol: number, page: number) =>
  book.volumes > 1 ? `vol. ${vol}, p. ${page}` : `p. ${page}`

/** The printed page's scan at the archive that holds the book. */
export const scanUrl = (scan: string, item: string | null, img: number) =>
  item && scan ? scan.replace('{id}', item).replace('{img}', String(img)) : undefined

export const loadLibrary = (fetcher?: typeof fetch) =>
  readJson<LibraryRow[]>('/api/library/index.json', fetcher)

export const loadBook = (slug: string, fetcher?: typeof fetch) => {
  if (!SLUG.test(slug)) throw new Error('CYBERJUDAH_BOOK_UNKNOWN')
  return readJson<LibraryBook>(`/api/library/${slug}/book.json`, fetcher)
}

export const loadBookChapter = (slug: string, k: number, fetcher?: typeof fetch) => {
  if (!SLUG.test(slug) || !Number.isInteger(k) || k < 0) throw new Error('CYBERJUDAH_BOOK_UNKNOWN')
  return readJson<LibraryChapter>(`/api/library/${slug}/chapter/${k}.json`, fetcher)
}
