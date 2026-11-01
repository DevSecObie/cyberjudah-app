import books from '~assets/cyberjudah/books.json'

// The precepts the classes lined up with each verse, from the published chapter data the Telegram
// app reads: the scripture read with the verse, why it goes with it, and the class it came from.
const DATA_ORIGIN = 'https://data.cyberjudah.io'

export type VersePrecept = {
  verses: string
  kind: 'precept' | 'opened'
  ref: { book: string; chapter: number; verses: string; label: string; url: string }
  text: string
  point?: string
  why?: string
  note: { label: string; url: string; date: string; teacher: string }
  ts?: string
}

const slugOfBook = (bookNumber: number) => books.find(book => book.id === bookNumber)?.slug

/** The verse numbers a precept is lined up with ("27-28" → 27, 28; "1,26" → 1, 26). */
export const preceptVerses = (verses: string) =>
  verses.split(',').flatMap(part => {
    const [from, to] = part.trim().split('-').map(Number)
    if (!Number.isInteger(from) || from < 1) return []
    const last = Number.isInteger(to) && to >= from ? Math.min(to, from + 200) : from
    return Array.from({ length: last - from + 1 }, (_, index) => from + index)
  })

export const loadChapterPrecepts = async (
  bookNumber: number,
  chapter: number,
  fetcher: typeof fetch = fetch
): Promise<VersePrecept[]> => {
  const slug = slugOfBook(bookNumber)
  if (!slug) return []
  const response = await fetcher(`${DATA_ORIGIN}/api/concordance/${slug}/${chapter}.json`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) return []
  const data = (await response.json()) as { precepts?: VersePrecept[] }
  return (data.precepts ?? []).filter(precept => precept?.ref?.label && precept.note?.label)
}

export type PreceptChip = { key: string; label: string }

/** The scriptures read with each verse, keyed by the first verse; a verse with any shows the "p". */
export const preceptChipsByVerse = (precepts: VersePrecept[]) => {
  const chips: Record<number, PreceptChip[]> = {}
  for (const precept of precepts) {
    for (const part of precept.verses.split(',')) {
      const first = preceptVerses(part)[0]
      if (!first) continue
      const list = (chips[first] ??= [])
      if (!list.some(chip => chip.label === precept.ref.label)) {
        list.push({ key: `${first}:${precept.ref.label}`, label: precept.ref.label })
      }
    }
  }
  return chips
}

/** The precepts for one verse: those whose verses include it, the Bishops' and Deacons' first. */
export const preceptsForVerse = (precepts: VersePrecept[], verse: number) => {
  const rank = (teacher = '') => (/^bishop/i.test(teacher) ? 0 : /^deacon/i.test(teacher) ? 1 : 2)
  return precepts
    .filter(precept => preceptVerses(precept.verses).includes(verse))
    .sort(
      (a, b) =>
        rank(a.note.teacher) - rank(b.note.teacher) || b.note.date.localeCompare(a.note.date)
    )
}
