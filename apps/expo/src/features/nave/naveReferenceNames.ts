import books from '~assets/bible_versions/books-desc'
import englishBookNames from '../../../i18n/locales/en/translation_book.json'

const englishNames = englishBookNames as Record<string, string>
const bookById = new Map(books.map(book => [book.Numero, book.Nom]))

/**
 * Bible Strong's English Nave writes its verse links with French book names ("Genèse 40:20").
 * In English the link keeps its verse and takes the English name of its book ("Genesis 40:20").
 */
export const localizeNaveReferences = (html: string, language: string | undefined): string => {
  if (language !== 'en') return html
  return html.replace(
    /(<a\s+href="v=(\d+)-[^"]*">)([^<]*)(<\/a>)/g,
    (match, open: string, bookId: string, text: string, close: string) => {
      const frenchName = bookById.get(Number(bookId))
      const englishName = frenchName ? englishNames[frenchName] : undefined
      if (!frenchName || !englishName || !text.startsWith(frenchName)) return match
      return `${open}${englishName}${text.slice(frenchName.length)}${close}`
    }
  )
}

/** A topic as the reader sees it in this language. */
export const localizeNaveTopic = <T extends { description: string }>(
  topic: T | undefined,
  language: string | undefined
): T | undefined =>
  topic ? { ...topic, description: localizeNaveReferences(topic.description, language) } : topic
