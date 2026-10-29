import books from '~assets/cyberjudah/books.json'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import { getSupportedOsisBookId } from '~helpers/osisReference'

const BOOKS_BY_SLUG = new Map(books.map(book => [book.slug, book]))
const SITE_BIBLE_LINK =
  /^https:\/\/(?:www\.)?cyberjudah\.io\/bible\/([a-z0-9-]+)\/([1-9]\d*)\/?(?:\?[^#]*)?(?:#v([1-9]\d*))?$/u

/**
 * CyberJudah teachings link each passage to its page on cyberjudah.io. Inside the app the same
 * published chapter opens in the reader; anything else stays an external link.
 */
export const cyberJudahSiteLinkToOsis = (href: string): string | undefined => {
  if (!usesCyberJudahEditorial()) return undefined
  const match = SITE_BIBLE_LINK.exec(href.trim())
  if (!match) return undefined
  const book = BOOKS_BY_SLUG.get(match[1])
  const chapter = Number(match[2])
  const osis = book && getSupportedOsisBookId(book.id)
  if (!book || !osis || !book.chapters.includes(chapter)) return undefined
  return match[3] ? `${osis}.${chapter}.${match[3]}` : `${osis}.${chapter}`
}
