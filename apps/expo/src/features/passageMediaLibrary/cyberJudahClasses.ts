import type { ResolvedPassageMediaLibraryItem } from '~features/bible/passageMedia'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { storage } from '~helpers/storage'

// The classes come from CyberJudah's published class feeds (the ones the Telegram app lists), so
// a newly published class appears without an app update. The last list read is kept on the
// phone for offline and instant opens.
const DATA_ORIGIN = 'https://data.cyberjudah.io'
const CACHE_KEY = 'cyberjudah.classLibrary.v2'
// A neutral dark placeholder while a thumbnail loads.
const PLACEHOLDER_BLURHASH = 'L03+Gm%M00t7_3ofWBWB00of~qWB'

const TRUTH = 'The Truth Shall Make You Free'
const SENSE = 'Giving The Sense From A to Z'
/** The library's sections in the Telegram app's order: the collection each class is filed in. */
export const CLASS_COLLECTIONS = [
  'Sabbath classes',
  '15 Min w/ Captains',
  'Our Hidden History',
  SENSE,
  TRUTH,
  'Shows',
] as const
export type ClassCollection = (typeof CLASS_COLLECTIONS)[number]

export type CyberJudahClass = ResolvedPassageMediaLibraryItem & {
  /** The library section it is listed under. */
  series: ClassCollection
  /** The show or run it belongs to, if any ("The Power Hour", "Giving The Sense From A to Z"). */
  collection: string
  date: string
  year: string
  teacher: string
  /** Words a search matches besides the title: books, topics and the chapters it opens. */
  keywords: string
  /** The class's page on cyberjudah.io, whose notes the player shows under the video. */
  notesPath: string
}

type FeedRow = {
  title?: string
  url?: string
  date?: string
  year?: string
  teacher?: string
  collection?: string
  allBooks?: string[]
  books?: string[]
  topics?: string[]
  opens?: { label?: string }[]
  videoId?: string | null
  duration?: number
}
type Feed = 'classes' | 'captains' | 'history'

const isVideoId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value)

const collectionOf = (feed: Feed, collection: string): ClassCollection => {
  if (feed === 'history') return 'Our Hidden History'
  if (feed === 'captains') return collection === SENSE ? SENSE : '15 Min w/ Captains'
  if (collection.startsWith(TRUTH)) return TRUTH
  return collection ? 'Shows' : 'Sabbath classes'
}

/** Every published class with a video, filed by collection in the Telegram app's order, newest first. */
export const toClassLibrary = (feeds: Partial<Record<Feed, unknown>>): CyberJudahClass[] => {
  const seen = new Set<string>()
  const classes: CyberJudahClass[] = []
  for (const feed of ['classes', 'captains', 'history'] as const) {
    const rows = feeds[feed]
    if (!Array.isArray(rows)) continue
    for (const row of rows as FeedRow[]) {
      if (!row || !row.title || !row.url || !isVideoId(row.videoId) || seen.has(row.videoId))
        continue
      seen.add(row.videoId)
      const workId = `cyberjudah-class-${row.videoId}`
      const collection = (row.collection ?? '').trim()
      const date = row.date ?? ''
      const teacher = row.teacher ?? ''
      const series = collectionOf(feed, collection)
      const show = collection && collection !== series ? collection : ''
      classes.push({
        workId,
        editionId: `${workId}:en`,
        attributionLabel: 'CyberJudah',
        reference: '',
        strongCodes: [],
        provider: 'youtube',
        providerId: row.videoId,
        sourceUrl: `https://www.youtube.com/watch?v=${row.videoId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`,
        blurHash: PLACEHOLDER_BLURHASH,
        title: row.title,
        durationSeconds: Number.isFinite(row.duration) && row.duration! > 0 ? row.duration! : 0,
        categories: ['classroom'],
        series,
        collection,
        subtitle: [date, teacher, show].filter(Boolean).join(' · '),
        date,
        year: row.year || date.slice(0, 4),
        teacher,
        keywords: [
          collection,
          ...(row.allBooks ?? row.books ?? []),
          ...(row.topics ?? []),
          ...(row.opens ?? []).map(open => open.label ?? ''),
        ]
          .filter(Boolean)
          .join(' '),
        notesPath: row.url,
      })
    }
  }
  const rank = (series: ClassCollection) => CLASS_COLLECTIONS.indexOf(series)
  return classes.sort((a, b) => rank(a.series) - rank(b.series) || b.date.localeCompare(a.date))
}

export const readCachedClassLibrary = (): CyberJudahClass[] | null => {
  try {
    const value = storage.getString(CACHE_KEY)
    const parsed = value ? JSON.parse(value) : null
    return Array.isArray(parsed) && parsed.length ? (parsed as CyberJudahClass[]) : null
  } catch {
    return null
  }
}

/** Read the published classes and keep them for the next open; never empties a kept list. */
export const loadClassLibrary = async (
  fetcher: typeof fetch = fetch
): Promise<CyberJudahClass[]> => {
  const read = async (path: string) => {
    const response = await fetcher(`${DATA_ORIGIN}${path}`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`CYBERJUDAH_CLASSES_UNAVAILABLE:${response.status}`)
    return response.json()
  }
  const [classes, captains, history] = await Promise.all([
    read('/search/classes.json'),
    read('/search/captains.json').catch(() => []),
    read('/api/history/index.json').catch(() => []),
  ])
  const library = toClassLibrary({ classes, captains, history })
  if (!library.length) throw new Error('CYBERJUDAH_CLASSES_EMPTY')
  storage.set(CACHE_KEY, JSON.stringify(library))
  return library
}

/** The classes a search and the filters leave, in library order. */
export const filterClassLibrary = (
  classes: CyberJudahClass[],
  {
    query = '',
    series,
    teacher,
    year,
    collection,
  }: {
    query?: string
    series?: string
    teacher?: string
    year?: string
    collection?: string
  }
) => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return classes.filter(item => {
    if (series && item.series !== series) return false
    if (teacher && item.teacher !== teacher) return false
    if (year && item.year !== year) return false
    if (collection && item.collection !== collection) return false
    if (!words.length) return true
    const text = `${item.title} ${item.teacher} ${item.keywords}`.toLowerCase()
    return words.every(word => text.includes(word))
  })
}

const SITE = 'https://cyberjudah.io'

const escapeHtml = (text: string) =>
  text
    .replace(/&(?!#?\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** A timestamp link into this class's own video, which the player seeks instead of opening. */
export const CLASS_SEEK_PREFIX = 'cyberjudah-seek:'

const toHref = (url: string, videoId: string) => {
  url = url.replace(/&amp;/g, '&')
  const video = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})&t=(\d+)s?$/.exec(
    url
  )
  if (video && video[1] === videoId) return `${CLASS_SEEK_PREFIX}${video[2]}`
  if (url.startsWith('/')) {
    const osis = cyberJudahSiteLinkToOsis(`${SITE}${url}`)
    return osis ? `bible://${osis}` : `${SITE}${url}`
  }
  return /^https:\/\//.test(url) ? url : ''
}

const formatSeek = (label: string, url: string, videoId: string) => {
  const href = toHref(url, videoId)
  return href ? `<a class="ts" href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : ''
}

// Inline Markdown of the notes: timestamps, links, bold and italic; the notes' own small HTML
// tags stay.
const inline = (text: string, videoId: string): string =>
  text
    .split(/(<\/?(?:b|i|sup|span|p)\b[^>]*>)/)
    .map((part, index) =>
      index % 2
        ? part
        : escapeHtml(part)
            .replace(/\*?\[\[([\d:]+)\]\(([^)\s]+)\)\]\*?/g, (_m, label, url) =>
              formatSeek(label, url, videoId)
            )
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
              const href = toHref(url, videoId)
              return href ? `<a href="${escapeHtml(href)}">${label}</a>` : label
            })
            .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
            .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    )
    .join('')

const ARROW =
  '<svg height="20" width="20" viewBox="0 0 96 96"><path fill="currentColor" d="M12 52h62.344L52.888 73.456a4 4 0 105.657 5.656l28.283-28.284a4 4 0 000-5.656L58.544 16.888a4.001 4.001 0 00-5.657 5.657L74.343 44H12a4 4 0 000 8z"/></svg>'

// A quoted passage as the reader's verse block (as in Bible Strong's studies): the verses
// under the reference and version, and the whole block opens the passage in the Bible.
const verseBlock = (quote: string, heading?: string) => {
  const verses = [...quote.matchAll(/<a href="bible:\/\/([^"]+)">/g)].map(match => match[1])
  const text = quote.replace(/<sup><a href="[^"]*">(\d+)<\/a><\/sup>/g, '<sup>$1</sup>')
  const title = heading ? /<a href="[^"]*">([^<]+)<\/a>/.exec(heading)?.[1] : undefined
  const seek = heading ? /<a class="ts"[^>]*>[^<]*<\/a>/.exec(heading)?.[0] : undefined
  const target = verses.length > 1 ? `${verses[0]}-${verses[verses.length - 1]}` : (verses[0] ?? '')
  const open = target ? ` data-href="bible://${target}" role="link"` : ''
  return (
    `<div class="block-verse"${open}><div class="block-verse--top">` +
    `${title ? `<span>${title}</span>` : ''}<b>KJV</b>${seek ?? ''}</div>` +
    `<div class="block-verse--content">${text}</div>` +
    `<span class="block-verse--arrow">${ARROW}</span></div>`
  )
}

const indentOf = (line: string) => line.length - line.trimStart().length
const isListItem = (line: string) => /^[-*]\s+/.test(line) && !/^\*\[/.test(line)

// One level of the notes, with the level's own indentation already removed: headings,
// paragraphs, scripture quotes, nested lists (the precepts under a verse) and reading cards.
const blocksToHtml = (lines: string[], videoId: string): string => {
  const out: string[] = []
  let i = 0
  const isBlank = (line?: string) => !line || !line.trim()
  while (i < lines.length) {
    const line = lines[i]
    if (isBlank(line)) {
      i++
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      out.push(`<h${level}>${inline(heading[2], videoId)}</h${level}>`)
      i++
    } else if (/^-{3,}\s*$/.test(line)) {
      out.push('<hr>')
      i++
    } else if (/^<div class="reading">/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^<\/div>/.test(lines[i])) body.push(lines[i++])
      i++
      out.push(`<div class="reading">${blocksToHtml(body, videoId)}</div>`)
    } else if (/^<\/?div\b/.test(line)) {
      i++
    } else if (line.startsWith('>')) {
      const body: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        body.push(lines[i++].replace(/^>\s?/, ''))
      }
      const quote = blocksToHtml(body, videoId)
      if (/<a href="bible:\/\//.test(quote)) {
        const passage = /^<p class="passage">(.*)<\/p>$/.exec(out.at(-1) ?? '')
        if (passage) out.pop()
        out.push(verseBlock(quote, passage?.[1]))
      } else {
        // A quote that isn't scripture, such as a dictionary reading.
        out.push(`<blockquote>${quote}</blockquote>`)
      }
    } else if (isListItem(line)) {
      const items: string[] = []
      while (i < lines.length && isListItem(lines[i])) {
        const body = [lines[i].replace(/^[-*]\s+/, '')]
        i++
        // The item runs on while lines are indented under it, blank lines included.
        while (i < lines.length) {
          if (isBlank(lines[i])) {
            let next = i
            while (next < lines.length && isBlank(lines[next])) next++
            if (next < lines.length && indentOf(lines[next]) >= 2) {
              while (i < next) body.push(lines[i++].trim())
              continue
            }
            break
          }
          if (indentOf(lines[i]) < 2) break
          body.push(lines[i++].replace(/^ {2}/, ''))
        }
        items.push(`<li>${blocksToHtml(body, videoId)}</li>`)
        let next = i
        while (next < lines.length && isBlank(lines[next])) next++
        if (next < lines.length && isListItem(lines[next])) i = next
      }
      out.push(`<ul>${items.join('')}</ul>`)
    } else {
      const body: string[] = []
      while (
        i < lines.length &&
        !isBlank(lines[i]) &&
        !/^(#{1,4}\s|>|-{3,}\s*$|<\/?div\b)/.test(lines[i]) &&
        !isListItem(lines[i])
      ) {
        body.push(lines[i++].trim())
      }
      const text = body.join(' ')
      if (/^Precepts:$/.test(text)) out.push('<p class="label">Precepts</p>')
      else if (/^<(?:p|span)\b/.test(text)) out.push(inline(text, videoId))
      else if (/^\*\*\[/.test(text)) out.push(`<p class="passage">${inline(text, videoId)}</p>`)
      else out.push(`<p>${inline(text, videoId)}</p>`)
    }
  }
  return out.join('')
}

/** The notes as HTML: headings, scripture quotes, precepts nested under each verse. */
export const classNotesToHtml = (markdown: string, videoId: string): string =>
  blocksToHtml(
    markdown
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.replace(/\s+$/, ''))
      // The class index and full-session links at the foot are the website's own navigation.
      .filter(line => !/^\[Class Notes Index\]/.test(line)),
    videoId
  )

/** A class's published notes; Bible links open in the reader, timestamps seek the video. */
export const loadClassNotes = async (
  notesPath: string,
  videoId: string,
  fetcher: typeof fetch = fetch
): Promise<string> => {
  if (!/^\/[a-z0-9/_-]+$/i.test(notesPath)) throw new Error('CYBERJUDAH_NOTES_PATH_INVALID')
  const response = await fetcher(`${DATA_ORIGIN}/api/notes${notesPath}.json`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_NOTES_UNAVAILABLE:${response.status}`)
  const note = (await response.json()) as { body?: unknown }
  if (typeof note.body !== 'string' || !note.body.trim()) throw new Error('CYBERJUDAH_NOTES_EMPTY')
  return classNotesToHtml(note.body, videoId)
}

export const getCachedClassById = (workId: string): CyberJudahClass | null =>
  readCachedClassLibrary()?.find(item => item.workId === workId) ?? null
