import books from '~assets/cyberjudah/books.json'

/** "/study/esther/11" → Esther's Greek additions, chapter 11: the chapter a study note is on. */
export const noteChapter = (notePath: string) => {
  const match = /^\/study\/([a-z0-9-]+)\/([1-9]\d*)$/.exec(notePath)
  if (!match) return undefined
  const chapter = Number(match[2])
  // The notes keep the Greek additions with Esther (/study/esther/11-16).
  const book = books.find(
    entry =>
      (entry.slug === match[1] || entry.slug === `${match[1]}-greek`) &&
      entry.chapters.includes(chapter)
  )
  return book ? { chapters: `${book.id}|${chapter}`, title: `${book.name} ${chapter}` } : undefined
}
