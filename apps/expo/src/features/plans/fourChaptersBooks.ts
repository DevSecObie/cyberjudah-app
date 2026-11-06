import type { ComputedPlan } from '~common/types'
import catalog from '~assets/cyberjudah/books.json'

/** Reuse chapter identities from the existing series without changing its daily progress. */
export const getFourChaptersBooks = (sections: ComputedPlan['sections']) => {
  const byBook = new Map<number, { day: number; title: string }[]>()
  let day = 0
  for (const section of sections) {
    for (const reading of section.data) {
      day += 1
      const ids = new Set<number>()
      for (const slice of reading.slices) {
        if (slice.type === 'Chapter') ids.add(Number(slice.chapters.split('|')[0]))
        if (slice.type === 'Text' && slice.notePath) {
          const book = catalog.find(book => book.slug === slice.notePath!.split('/')[2])
          // The published Greek Esther notes share the /study/esther path.
          if (book)
            ids.add(book.id === 17 && reading.title?.includes('Rest of Esther') ? 71 : book.id)
        }
      }
      for (const id of ids) {
        if (!byBook.has(id)) byBook.set(id, [])
        byBook.get(id)!.push({ day, title: reading.title || `Day ${day}` })
      }
    }
  }
  return [
    { title: 'The Old Testament', books: catalog.filter(book => book.id <= 39) },
    { title: 'The Apocrypha', books: catalog.filter(book => book.id >= 67) },
    { title: 'The New Testament', books: catalog.filter(book => book.id >= 40 && book.id <= 66) },
  ].map(section => ({
    title: section.title,
    books: section.books
      .filter(book => byBook.has(book.id))
      .map(book => ({
        title: book.name,
        readings: byBook.get(book.id)!,
      })),
  }))
}
