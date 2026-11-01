import { getBook } from '~helpers/bibleBookCatalog'
import i18n from '~i18n'

/**
 * The passage a reader opened Ask from, as an English reference the server's King James book list
 * reads ("Genesis 1:3", "Exodus 12:1-3"): verses of one chapter, from the first selected to the
 * last when they run on, else the first alone. Anything else gives none.
 */
export function askReading(verseIds: string[]): string | undefined {
  const parsed = verseIds
    .map(id => id.split('-').map(Number))
    .filter(parts => parts.length === 3 && parts.every(n => Number.isInteger(n) && n > 0))
  if (!parsed.length) return undefined
  const [book, chapter] = parsed[0]
  if (parsed.some(([b, c]) => b !== book || c !== chapter)) return undefined
  const name = getBook(book)?.Nom
  if (!name) return undefined
  const english = i18n.t(name, { lng: 'en' })
  const verses = [...new Set(parsed.map(([, , v]) => v))].sort((a, b) => a - b)
  const first = verses[0]
  const last = verses.at(-1)!
  const runsOn = last - first === verses.length - 1
  return `${english} ${chapter}:${first}${runsOn && last > first ? `-${last}` : ''}`.slice(0, 40)
}
