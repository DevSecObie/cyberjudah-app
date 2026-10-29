import books from '~assets/cyberjudah/books.json'
import verseTags from '~assets/cyberjudah/verse-tags.json'

// The verses of each precept topic and each law, built from the published precepts and Handbook of
// the Law by scripts/build-cyberjudah-verse-tags.mjs.
type VerseTagData = {
  tags: Record<string, string>
  chapters: Record<string, Record<string, string[]>>
}
const data = verseTags as VerseTagData

export type VerseTag = { key: string; label: string; kind: 'precept' | 'law'; at: string }

/** The precept and law tags on each verse of a chapter. */
export const chapterVerseTags = (bookNumber: number, chapter: number) => {
  const slug = books.find(book => book.id === bookNumber)?.slug
  const verses = slug ? data.chapters[`${slug}/${chapter}`] : undefined
  const tags: Record<number, VerseTag[]> = {}
  for (const [verse, keys] of Object.entries(verses ?? {})) {
    tags[Number(verse)] = keys.map(key => ({
      key,
      kind: key.startsWith('l:') ? 'law' : 'precept',
      label: key.startsWith('l:') ? `Law ${data.tags[key]}` : (data.tags[key] ?? key),
      at: `${slug}/${chapter}/${verse}`,
    }))
  }
  return tags
}

/** Where a tag opens: its precept at the verse it sits on, or its law in the Handbook of the Law. */
export const verseTagRoute = (key: string, at = '') =>
  key.startsWith('l:')
    ? {
        pathname: '/(explore)/law-section' as const,
        params: { id: key.slice(2).split('.')[0], law: key.slice(2) },
      }
    : { pathname: '/(explore)/precept' as const, params: { slug: key.slice(2), at } }
