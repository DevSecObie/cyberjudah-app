import books from '~assets/cyberjudah/books.json'
import type { ResolvedPassageMedia, ResolvedPassageMediaChapter } from './passageMedia'

// The classes' pictures in the reader, as in the Telegram app: after the last verse a class taught,
// a small deck of its recordings; at the end of the chapter, every class that taught or read it.
// They come from the published chapter data the Telegram app reads, so a new class shows up
// without an app update. A card plays the class at the moment it read the verse.
const DATA_ORIGIN = 'https://data.cyberjudah.io'
// A neutral dark placeholder while a thumbnail loads.
const PLACEHOLDER_BLURHASH = 'L03+Gm%M00t7_3ofWBWB00of~qWB'
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** A class's notes on a passage, at the moment the recording reads it. */
export type ClassMoment = {
  verses: string
  label: string
  url: string
  date: string
  video: string
  t: number
  ts: string
  teacher?: string
}
/** A class the transcripts find reading a verse aloud, with or without notes. */
type Reading = {
  video: string
  t: number
  ts: string
  title: string
  date: string
  teacher: string
  url?: string | null
}
export type ChapterClasses = { moments?: ClassMoment[]; read?: Record<string, Reading[]> }

const slugOfBook = (bookNumber: number) => books.find(book => book.id === bookNumber)?.slug

/** The chapter's published class data; null when no class has cited it (no file). */
export const loadChapterClasses = async (
  bookNumber: number,
  chapter: number,
  fetcher: typeof fetch = fetch
): Promise<ChapterClasses | null> => {
  const slug = slugOfBook(bookNumber)
  if (!slug) return null
  const response = await fetcher(`${DATA_ORIGIN}/api/concordance/${slug}/${chapter}.json`, {
    headers: { accept: 'application/json' },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`CYBERJUDAH_CHAPTER_UNAVAILABLE:${response.status}`)
  return (await response.json()) as ChapterClasses
}

/** The verse numbers of "10", "1-2", "3,5" (as the Telegram app reads them). */
export const verseNumbers = (spec?: string | null): number[] => {
  if (!spec) return []
  const out: number[] = []
  for (const part of spec.split(/[,;]\s*/)) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part.trim())
    if (!match) continue
    const from = +match[1]
    const to = match[2] ? +match[2] : from
    for (let verse = from; verse <= to && verse - from < 200; verse++) out.push(verse)
  }
  return [...new Set(out)].sort((a, b) => a - b)
}

/** The Bishops' and Deacons' teaching comes first. */
const teacherRank = (teacher?: string | null) =>
  /^bishop\b/i.test(teacher ?? '') ? 0 : /^deacon\b/i.test(teacher ?? '') ? 1 : 2

/**
 * Every class that read each verse, keyed by the last verse it read: the classes whose notes
 * break the verse down first (the Bishops' and Deacons' first, newest first), then every other
 * class the transcripts find reading it aloud. One picture per class and verse.
 */
export const classesByVerse = (data: ChapterClasses | null): Record<number, ClassMoment[]> => {
  const out: Record<number, ClassMoment[]> = {}
  const seen = new Set<string>()
  const sorted = (data?.moments ?? [])
    .filter(
      m =>
        VIDEO_ID.test(m?.video ?? '') && Number.isFinite(m.t) && verseNumbers(m.verses).length > 0
    )
    .sort(
      (a, b) =>
        teacherRank(a.teacher) - teacherRank(b.teacher) ||
        (b.date ?? '').localeCompare(a.date ?? '') ||
        a.t - b.t
    )
  for (const moment of sorted) {
    const end = Math.max(...verseNumbers(moment.verses))
    if (seen.has(`${end}:${moment.video}`)) continue
    seen.add(`${end}:${moment.video}`)
    ;(out[end] ??= []).push(moment)
  }
  for (const [key, list] of Object.entries(data?.read ?? {})) {
    const verse = Number(key)
    if (!Number.isInteger(verse) || verse < 1 || !Array.isArray(list)) continue
    const row = (out[verse] ??= [])
    const have = new Set(row.map(m => m.video))
    for (const reading of list) {
      if (
        !VIDEO_ID.test(reading?.video ?? '') ||
        !Number.isFinite(reading.t) ||
        have.has(reading.video)
      )
        continue
      have.add(reading.video)
      row.push({
        verses: String(verse),
        label: reading.title,
        url: reading.url ?? '',
        date: reading.date,
        video: reading.video,
        t: reading.t,
        ts: reading.ts,
        teacher: reading.teacher,
      })
    }
    if (!row.length) delete out[verse]
  }
  return out
}

/** A chapter's classes, once each: those whose notes teach it, then those that read it aloud. */
export const chapterClasses = (byVerse: Record<number, ClassMoment[]>) => {
  const all = Object.entries(byVerse)
    .sort(([a], [b]) => +a - +b)
    .flatMap(([, moments]) => moments)
  const seen = new Set<string>()
  const taught: ClassMoment[] = []
  const read: ClassMoment[] = []
  for (const moment of all) {
    if (moment.url && !seen.has(moment.video)) {
      seen.add(moment.video)
      taught.push(moment)
    }
  }
  const rest = all
    .filter(moment => !seen.has(moment.video))
    .sort(
      (a, b) =>
        teacherRank(a.teacher) - teacherRank(b.teacher) ||
        (b.date ?? '').localeCompare(a.date ?? '')
    )
  for (const moment of rest) {
    if (!seen.has(moment.video)) {
      seen.add(moment.video)
      read.push(moment)
    }
  }
  return { taught, read }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "2026-10-24" → "Oct 24, 2026". */
export const formatClassDate = (date?: string | null) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!match) return ''
  return `${MONTHS[+match[2] - 1] ?? ''} ${+match[3]}, ${match[1]}`.trim()
}

type ToMediaInput = { bookName: string; chapter: number }

/** The book's name as CyberJudah publishes it ("Genesis", "1 Maccabees"). */
export const bookNameOf = (bookNumber: number) =>
  books.find(book => book.id === bookNumber)?.name ?? ''

const toMedia = (
  moment: ClassMoment,
  { bookName, chapter }: ToMediaInput
): ResolvedPassageMedia => {
  const workId = `cyberjudah-moment-${moment.video}-${moment.t}`
  const start = Math.max(0, Math.floor(moment.t))
  return {
    workId,
    editionId: workId,
    attributionLabel: 'CyberJudah',
    reference: moment.verses.includes(':')
      ? `${bookName} ${moment.verses}`
      : `${bookName} ${chapter}:${moment.verses}`,
    strongCodes: [],
    provider: 'youtube',
    providerId: moment.video,
    sourceUrl: `https://www.youtube.com/watch?v=${moment.video}${start ? `&t=${start}s` : ''}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${moment.video}/mqdefault.jpg`,
    blurHash: PLACEHOLDER_BLURHASH,
    title: moment.label,
    durationSeconds: 0,
    startSeconds: start,
    subtitle: [moment.teacher, formatClassDate(moment.date)].filter(Boolean).join(' · '),
  }
}

type ToPassageMediaInput = ToMediaInput & {
  sectionTitles: { taught: string; read: string; showAll?: string }
}

/** The chapter's classes as Bible Strong's passage media: a deck after each verse and one at the end. */
export const toClassPassageMedia = (
  data: ChapterClasses | null,
  input: ToPassageMediaInput
): Pick<ResolvedPassageMediaChapter, 'afterVerses' | 'gallerySections'> => {
  const byVerse = classesByVerse(data)
  const media = new Map<string, ResolvedPassageMedia>()
  const of = (moment: ClassMoment) => {
    const key = `${moment.video}-${moment.t}`
    let item = media.get(key)
    if (!item) {
      item = toMedia(moment, input)
      media.set(key, item)
    }
    return item
  }
  const afterVerses: Record<number, ResolvedPassageMedia[]> = {}
  for (const [verse, moments] of Object.entries(byVerse)) {
    afterVerses[+verse] = moments.map(of)
  }
  const { taught, read } = chapterClasses(byVerse)
  const gallerySections = [
    {
      id: 'chapter-resources' as const,
      title: input.sectionTitles.taught,
      items: taught.map(of),
      showAllLabel: input.sectionTitles.showAll,
    },
    {
      id: 'passages' as const,
      title: input.sectionTitles.read,
      items: read.map(of),
      showAllLabel: input.sectionTitles.showAll,
    },
  ].filter(section => section.items.length > 0)
  return { afterVerses, gallerySections }
}

/** Bible Strong's media for the chapter with the classes' added after it. */
export const withClassPassageMedia = (
  base: ResolvedPassageMediaChapter,
  classes: Pick<ResolvedPassageMediaChapter, 'afterVerses' | 'gallerySections'> | null | undefined
): ResolvedPassageMediaChapter => {
  if (!classes || !Object.keys(classes.afterVerses).length) return base
  const afterVerses = { ...base.afterVerses }
  for (const [verse, items] of Object.entries(classes.afterVerses)) {
    const key = Number(verse)
    afterVerses[key] = [...(afterVerses[key] ?? []), ...items]
  }
  return { ...base, afterVerses, gallerySections: classes.gallerySections }
}
