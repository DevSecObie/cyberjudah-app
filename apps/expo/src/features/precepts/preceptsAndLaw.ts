import books from '~assets/cyberjudah/books.json'

// CyberJudah's precepts (topics with the scripture the classes read on them) and the Handbook of
// the Law, from the published data the Telegram app reads.
const DATA_ORIGIN = 'https://data.cyberjudah.io'

export type Scripture = {
  label: string
  url: string
  text: { verse: number; text: string }[]
  key?: boolean
}
export type PreceptRow = { slug: string; title: string; refs: number }
export type Precept = { slug: string; title: string; refs: Scripture[] }
export type LawPart = {
  n: number
  title: string
  sections: { id: string; title: string; laws: number }[]
}
export type LawSection = {
  id: string
  title: string
  part: { n: number; title: string }
  entries: { id: string; text: string; refs: Scripture[]; citation?: string }[]
}

const read = async <T>(path: string, fetcher: typeof fetch): Promise<T> => {
  const response = await fetcher(`${DATA_ORIGIN}${path}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_DATA_UNAVAILABLE:${response.status}`)
  return (await response.json()) as T
}

export const loadPreceptIndex = (fetcher: typeof fetch = fetch) =>
  read<PreceptRow[]>('/api/precepts/index.json', fetcher)

export const loadPrecept = async (slug: string, fetcher: typeof fetch = fetch) => {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('CYBERJUDAH_PRECEPT_SLUG_INVALID')
  const precept = await read<Precept>(`/api/precepts/${slug}.json`, fetcher)
  return { ...precept, refs: inBibleOrder(precept.refs) }
}

// The KJV 1611 order: the Old Testament (1-39), the Apocrypha (67-81), then the New (40-66).
const kjv1611Rank = (id: number) => (id <= 39 ? id : id >= 67 ? id - 27 : id + 15)
const bookOrder = new Map(books.map(book => [book.slug, kjv1611Rank(book.id)]))
const firstVerse = (scripture: Scripture) => scripture.text[0]?.verse ?? 0
const chapterOf = (scripture: Scripture) => Number(/\/(\d+)(?:#|$)/.exec(scripture.url)?.[1] ?? 0)
const slugOf = (scripture: Scripture) => /^\/bible\/([a-z0-9-]+)\//.exec(scripture.url)?.[1] ?? ''

/** A precept's scriptures in the order of the Bible (KJV 1611 with the Apocrypha). */
export const inBibleOrder = (refs: Scripture[]) =>
  [...refs].sort(
    (a, b) =>
      (bookOrder.get(slugOf(a)) ?? 999) - (bookOrder.get(slugOf(b)) ?? 999) ||
      chapterOf(a) - chapterOf(b) ||
      firstVerse(a) - firstVerse(b)
  )

/** Whether a scripture includes the verse "slug/chapter/verse". */
export const scriptureHasVerse = (scripture: Scripture, at: string) => {
  const [slug, chapter, verse] = at.split('/')
  return (
    slugOf(scripture) === slug &&
    chapterOf(scripture) === Number(chapter) &&
    scripture.text.some(line => line.verse === Number(verse))
  )
}

export const loadLawIndex = (fetcher: typeof fetch = fetch) =>
  read<LawPart[]>('/api/laws/index.json', fetcher)

export const loadLawSection = (id: string, fetcher: typeof fetch = fetch) => {
  if (!/^[0-9]{1,2}[A-Z]$/.test(id)) throw new Error('CYBERJUDAH_LAW_SECTION_INVALID')
  return read<LawSection>(`/api/laws/${id}.json`, fetcher)
}

/** The precepts filed under their first letter, A to Z, narrowed by a search. */
export const preceptSections = (rows: PreceptRow[], query = '') => {
  const needle = query.trim().toLowerCase()
  const letters = new Map<string, PreceptRow[]>()
  for (const row of rows) {
    if (needle && !row.title.toLowerCase().includes(needle)) continue
    const letter = row.title.charAt(0).toUpperCase()
    letters.set(letter, [...(letters.get(letter) ?? []), row])
  }
  return [...letters]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data: data.sort((a, b) => a.title.localeCompare(b.title)) }))
}

/** A passage's text as one reading, "1 In the beginning… 2 And the earth…". */
export const scriptureText = (scripture: Scripture) =>
  scripture.text.map(verse => verse.text).join(' ')
