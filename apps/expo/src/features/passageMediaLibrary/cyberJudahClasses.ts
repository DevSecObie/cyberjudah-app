import type { ResolvedPassageMediaLibraryItem } from '~features/bible/passageMedia'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { storage } from '~helpers/storage'
import type { PublishedNote } from '~features/notesExport/notePdf'

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

/**
 * The notes as the app's own blocks, for drawing with native components: the same reading as
 * blocksToHtml, kept as a tree so a long class is laid out a block at a time. Inline text stays
 * the small HTML that `inline` makes (links, bold, italic, verse numbers).
 */
export type NoteBlock =
  | { type: 'heading'; level: number; html: string }
  | { type: 'paragraph'; html: string; variant?: 'label' | 'passage' }
  | { type: 'rule' }
  | { type: 'reading'; blocks: NoteBlock[] }
  | { type: 'quote'; blocks: NoteBlock[] }
  | { type: 'list'; items: NoteBlock[][] }
  /** Something the class brought out from the news, placed where in the class it came up. */
  | { type: 'news'; blocks: NoteBlock[] }
  | {
      type: 'verse'
      title?: string
      seek?: { href: string; label: string }
      target: string
      blocks: NoteBlock[]
    }

const blocksOf = (lines: string[], videoId: string): NoteBlock[] => {
  const out: NoteBlock[] = []
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
      out.push({
        type: 'heading',
        level: Math.min(heading[1].length, 4),
        html: inline(heading[2], videoId),
      })
      i++
    } else if (/^-{3,}\s*$/.test(line)) {
      out.push({ type: 'rule' })
      i++
    } else if (/^<div class="reading">/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^<\/div>/.test(lines[i])) body.push(lines[i++])
      i++
      out.push({ type: 'reading', blocks: blocksOf(body, videoId) })
    } else if (/^<\/?div\b/.test(line)) {
      i++
    } else if (line.startsWith('>')) {
      const body: string[] = []
      while (i < lines.length && lines[i].startsWith('>'))
        body.push(lines[i++].replace(/^>\s?/, ''))
      const quote = blocksOf(body, videoId)
      const html = blocksToHtml(body, videoId)
      if (/<a href="bible:\/\//.test(html)) {
        const last = out.at(-1)
        const passage =
          last?.type === 'paragraph' && last.variant === 'passage' ? last.html : undefined
        if (passage) out.pop()
        const verses = [...html.matchAll(/<a href="bible:\/\/([^"]+)">/g)].map(match => match[1])
        const seek = passage ? /<a class="ts" href="([^"]*)">([^<]*)<\/a>/.exec(passage) : null
        out.push({
          type: 'verse',
          title: passage ? /<a href="[^"]*">([^<]+)<\/a>/.exec(passage)?.[1] : undefined,
          seek: seek ? { href: seek[1], label: seek[2] } : undefined,
          target:
            verses.length > 1 ? `${verses[0]}-${verses[verses.length - 1]}` : (verses[0] ?? ''),
          blocks: quote,
        })
      } else {
        out.push({ type: 'quote', blocks: quote })
      }
    } else if (isListItem(line)) {
      const items: NoteBlock[][] = []
      while (i < lines.length && isListItem(lines[i])) {
        const body = [lines[i].replace(/^[-*]\s+/, '')]
        i++
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
        items.push(blocksOf(body, videoId))
        let next = i
        while (next < lines.length && isBlank(lines[next])) next++
        if (next < lines.length && isListItem(lines[next])) i = next
      }
      out.push({ type: 'list', items })
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
      if (/^Precepts:$/.test(text))
        out.push({ type: 'paragraph', html: 'Precepts', variant: 'label' })
      else if (/^\*\*\[/.test(text))
        out.push({ type: 'paragraph', html: inline(text, videoId), variant: 'passage' })
      else out.push({ type: 'paragraph', html: inline(text, videoId) })
    }
  }
  return out
}

const notesLines = (markdown: string) =>
  markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    // The class index and full-session links at the foot are the website's own navigation.
    .filter(line => !/^\[Class Notes Index\]/.test(line))

const plainText = (html: string) => html.replace(/<[^>]+>/g, '').trim()
const seekOf = (html: string) => {
  const match = new RegExp(`href="${CLASS_SEEK_PREFIX}(\\d+)"`).exec(html)
  return match ? Number(match[1]) : undefined
}
const firstSeek = (blocks: NoteBlock[]): number | undefined => {
  for (const block of blocks) {
    const seconds =
      block.type === 'verse'
        ? block.seek && seekOf(`href="${block.seek.href}"`)
        : block.type === 'heading' || block.type === 'paragraph'
          ? seekOf(block.html)
          : block.type === 'list'
            ? firstSeek(block.items.flat())
            : 'blocks' in block
              ? firstSeek(block.blocks)
              : undefined
    if (seconds !== undefined) return seconds
  }
  return undefined
}
const sectionEnd = (blocks: NoteBlock[], start: number) => {
  const heading = blocks[start]
  const level = heading.type === 'heading' ? heading.level : 2
  let end = start + 1
  while (end < blocks.length) {
    const block = blocks[end]
    if (block.type === 'heading' && block.level <= level) break
    end++
  }
  return end
}

/**
 * The notes list what a class brought out from the news in a section of its own, each item with
 * its moment in the class. Each one that has a moment goes into "Scriptures Opened" where the class
 * came to it, before the first scripture opened after it; the rest stay where they were.
 */
const placeNewsInOrder = (blocks: NoteBlock[]): NoteBlock[] => {
  const isHeading = (block: NoteBlock, pattern: RegExp) =>
    block.type === 'heading' && pattern.test(plainText(block.html))
  const newsAt = blocks.findIndex(block => isHeading(block, /^in the news$/i))
  if (newsAt < 0 || !blocks.some(block => isHeading(block, /^scriptures opened$/i))) return blocks
  const newsEnd = sectionEnd(blocks, newsAt)
  const timed: { seconds: number; blocks: NoteBlock[] }[] = []
  const kept: NoteBlock[] = []
  for (const block of blocks.slice(newsAt + 1, newsEnd)) {
    if (block.type !== 'list') {
      kept.push(block)
      continue
    }
    const untimed = block.items.filter(item => {
      const seconds = firstSeek(item)
      if (seconds === undefined) return true
      timed.push({ seconds, blocks: item })
      return false
    })
    if (untimed.length) kept.push({ ...block, items: untimed })
  }
  if (!timed.length) return blocks
  timed.sort((left, right) => left.seconds - right.seconds)
  const rest = [
    ...blocks.slice(0, newsAt),
    ...(kept.length ? [blocks[newsAt], ...kept] : []),
    ...blocks.slice(newsEnd),
  ]
  const scripturesAt = rest.findIndex(block => isHeading(block, /^scriptures opened$/i))
  const scripturesEnd = sectionEnd(rest, scripturesAt)
  const out = rest.slice(0, scripturesAt + 1)
  let next = 0
  for (const block of rest.slice(scripturesAt + 1, scripturesEnd)) {
    const seconds = block.type === 'verse' ? firstSeek([block]) : undefined
    while (seconds !== undefined && next < timed.length && timed[next].seconds < seconds)
      out.push({ type: 'news', blocks: timed[next++].blocks })
    out.push(block)
  }
  while (next < timed.length) out.push({ type: 'news', blocks: timed[next++].blocks })
  return [...out, ...rest.slice(scripturesEnd)]
}

/** The notes as blocks for the app's own components. */
export const classNotesToBlocks = (markdown: string, videoId: string): NoteBlock[] =>
  placeNewsInOrder(blocksOf(notesLines(markdown), videoId))

/** The notes as HTML: headings, scripture quotes, precepts nested under each verse. */
export const classNotesToHtml = (markdown: string, videoId: string): string =>
  blocksToHtml(notesLines(markdown), videoId)

/** A published note as the data set serves it: its Markdown and its title, date and teacher. */
export const loadPublishedNote = async (
  notesPath: string,
  fetcher: typeof fetch = fetch
): Promise<PublishedNote & { body: string }> => {
  if (!/^\/[a-z0-9/_-]+$/i.test(notesPath)) throw new Error('CYBERJUDAH_NOTES_PATH_INVALID')
  const response = await fetcher(`${DATA_ORIGIN}/api/notes${notesPath}.json`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_NOTES_UNAVAILABLE:${response.status}`)
  const note = (await response.json()) as PublishedNote
  if (typeof note.body !== 'string' || !note.body.trim()) throw new Error('CYBERJUDAH_NOTES_EMPTY')
  return note as PublishedNote & { body: string }
}

/** A class's published notes; Bible links open in the reader, timestamps seek the video. */
export const loadClassNotes = async (
  notesPath: string,
  videoId: string,
  fetcher: typeof fetch = fetch
): Promise<string> => classNotesToHtml((await loadPublishedNote(notesPath, fetcher)).body, videoId)

/** A class's notes as the app's own blocks. */
export const loadClassNoteBlocks = async (
  notesPath: string,
  videoId: string,
  fetcher: typeof fetch = fetch
): Promise<NoteBlock[]> =>
  classNotesToBlocks((await loadPublishedNote(notesPath, fetcher)).body, videoId)

export const getCachedClassById = (workId: string): CyberJudahClass | null =>
  readCachedClassLibrary()?.find(item => item.workId === workId) ?? null
