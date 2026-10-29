import { Book } from '~assets/bible_versions/books-desc'
import {
  type BibleCanonId,
  getBook,
  getBooksForCanon,
  isBibleCanonId,
} from '~helpers/bibleBookCatalog'
import { getChapterVerseCount, type BibleVersionCoverage } from '~helpers/biblesDb'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import cyberJudahVerseNumbering from '~assets/cyberjudah/verse-numbering.json'

export const resolveBibleCoverageCanonId = (
  coverage: BibleVersionCoverage | undefined,
  fallback: BibleCanonId
): BibleCanonId =>
  coverage?.canon?.id && isBibleCanonId(coverage.canon.id) ? coverage.canon.id : fallback

export const getCanonicalChapters = (book: Book) =>
  Array.from({ length: book.Chapitres }, (_, i) => i + 1)

export const getAvailableBookNumbers = (
  coverage?: BibleVersionCoverage,
  canonId: BibleCanonId = 'protestant-66'
) => getBooksForCanon(canonId, coverage?.books).map(book => book.Numero)

export const getAvailableChapters = (book: Book, coverage?: BibleVersionCoverage) => {
  const chapters = coverage?.chaptersByBook[book.Numero]
  return chapters?.length ? chapters : getCanonicalChapters(book)
}

export const findBook = getBook

export const getChapterVerseCountFromCoverage = (
  coverage: BibleVersionCoverage | undefined,
  bookNumber: number,
  chapter: number
) => coverage?.verseCountByBookChapter[`${bookNumber}-${chapter}`]

const cyberJudahFirstVerses: Record<string, number> =
  cyberJudahVerseNumbering.firstVerseByBookChapter

/**
 * Coverage gives a verse count, not verse numbers. The published KJV has one chapter whose
 * numbering does not start at 1 (Rest of Esther 10 begins at verse 4), checked against the
 * offline archive by scripts/verify-cyberjudah-offline.mjs.
 */
export const getChapterFirstVerse = (bookNumber: number, chapter: number) =>
  (usesCyberJudahEditorial() ? cyberJudahFirstVerses[`${bookNumber}-${chapter}`] : undefined) ?? 1

export const getChapterVerseNumbersFromCoverage = (
  coverage: BibleVersionCoverage | undefined,
  bookNumber: number,
  chapter: number
) => {
  const count = getChapterVerseCountFromCoverage(coverage, bookNumber, chapter)
  if (!count) return undefined
  const first = getChapterFirstVerse(bookNumber, chapter)
  return Array.from({ length: count }, (_, i) => first + i)
}

/** The number of the chapter's last verse, given its verse count. */
export const getChapterLastVerse = (bookNumber: number, chapter: number, verseCount: number) =>
  getChapterFirstVerse(bookNumber, chapter) + verseCount - 1

export const getChapterLastVerseFromCoverage = (
  coverage: BibleVersionCoverage | undefined,
  bookNumber: number,
  chapter: number
) => {
  const count = getChapterVerseCountFromCoverage(coverage, bookNumber, chapter)
  return count ? getChapterLastVerse(bookNumber, chapter, count) : undefined
}

export const getPreviousAvailableChapterLocation = (
  book: Book,
  chapter: number,
  coverage?: BibleVersionCoverage,
  canonId: BibleCanonId = 'protestant-66'
) => {
  const currentChapters = getAvailableChapters(book, coverage)
  const previousChapter = [...currentChapters].reverse().find(item => item < chapter)

  if (previousChapter) {
    return { book, chapter: previousChapter }
  }

  const availableBookNumbers = getAvailableBookNumbers(coverage, canonId)
  const currentBookIndex = availableBookNumbers.indexOf(book.Numero)
  if (currentBookIndex <= 0) return null

  const previousBook = findBook(availableBookNumbers[currentBookIndex - 1])
  if (!previousBook) return null

  const previousBookChapters = getAvailableChapters(previousBook, coverage)
  const targetChapter = previousBookChapters[previousBookChapters.length - 1]
  if (!targetChapter) return null

  return { book: previousBook, chapter: targetChapter }
}

export const getNextAvailableChapterLocation = (
  book: Book,
  chapter: number,
  coverage?: BibleVersionCoverage,
  canonId: BibleCanonId = 'protestant-66'
) => {
  const currentChapters = getAvailableChapters(book, coverage)
  const nextChapter = currentChapters.find(item => item > chapter)

  if (nextChapter) {
    return { book, chapter: nextChapter }
  }

  const availableBookNumbers = getAvailableBookNumbers(coverage, canonId)
  const currentBookIndex = availableBookNumbers.indexOf(book.Numero)
  if (currentBookIndex === -1 || currentBookIndex >= availableBookNumbers.length - 1) return null

  const nextBook = findBook(availableBookNumbers[currentBookIndex + 1])
  if (!nextBook) return null

  const nextBookChapters = getAvailableChapters(nextBook, coverage)
  const targetChapter = nextBookChapters[0]
  if (!targetChapter) return null

  return { book: nextBook, chapter: targetChapter }
}

export const getMaxChapterVerseCount = async (
  versions: string[],
  bookNumber: number,
  chapter: number
) => {
  if (!versions.length) return 0
  const counts = await Promise.all(
    versions.map(async version => {
      try {
        return await getChapterVerseCount(version, bookNumber, chapter)
      } catch {
        return 0
      }
    })
  )
  return Math.max(...counts)
}

export const getChapterVerseCountSafe = async (
  version: string,
  bookNumber: number,
  chapter: number
) => {
  try {
    return await getChapterVerseCount(version, bookNumber, chapter)
  } catch {
    return 0
  }
}
