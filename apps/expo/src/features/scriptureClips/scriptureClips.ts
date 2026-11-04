import {
  teacherRank,
  verseNumbers,
  type ChapterClasses,
  type ClassMoment,
} from '~features/bible/classMoments'

// Scripture Clips: the Bible as a vertical feed of class videos, a verse at a time. The clips are
// the classes the Bible reader shows under each verse (its "Taught from" and "Read in class"
// classes), in the reader's order. A clip starts where the class takes up the verse and runs to
// the class's next moment in the chapter, up to three minutes. This is a CyberJudah component,
// not one of Bible Strong's.

/** One caption line of the class transcript: [from, to, text], seconds from the clip's start. */
export type ClipCaption = [number, number, string]

export type ScriptureClip = {
  /** Chapter and verse; `vEnd` when the class takes up several verses at once. */
  c: number
  v: number
  vEnd?: number
  /** The verse's text, all the verses' when there are several. */
  text: string
  verses?: { v: number; text: string }[]
  video?: string | null
  /** The second in the video the verse is read at. */
  start?: number
  end?: number
  /** The class's title. */
  title?: string | null
  /** The teacher, blank when not known. */
  teacher?: string | null
  date?: string | null
  /** The class's notes page on cyberjudah.io, when it has one. */
  notes?: string | null
  /** The series the class belongs to, e.g. "4 Chapters a Day". */
  series?: string | null
  captions?: ClipCaption[]
}

export const MAX_CLIP_SECONDS = 180
const MIN_CLIP_SECONDS = 15

/** How long a clip plays: to the class's next verse, never past three minutes. */
export const clipLength = (clip: ScriptureClip): number => {
  if (clip.start === undefined) return 0
  const end = clip.end ?? clip.start + MAX_CLIP_SECONDS
  return Math.max(0, Math.min(end - clip.start, MAX_CLIP_SECONDS))
}

export type CaptionFrame = {
  /** Which caption line is showing, to key its words. */
  line: number
  words: string[]
  /** How many of the line's words have been said so far. */
  shown: number
}

/**
 * The caption showing at `elapsed` seconds into the clip, word by word as Shorts shows them: the
 * line's words are spread evenly over the line's time, and a word appears once it is said.
 */
export const captionAt = (
  captions: ClipCaption[] | undefined,
  elapsed: number
): CaptionFrame | null => {
  if (!captions?.length || elapsed < 0) return null
  let line = -1
  for (let index = 0; index < captions.length; index++) {
    if (captions[index][0] <= elapsed) line = index
    else break
  }
  if (line < 0) return null
  const [from, to, text] = captions[line]
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return null
  const span = Math.max(0.2, to - from)
  const shown = Math.min(words.length, Math.floor(((elapsed - from) / span) * words.length) + 1)
  return { line, words, shown }
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

type Candidate = ClassMoment & { taught: boolean }

const byReaderOrder = (a: Candidate, b: Candidate) =>
  Number(b.taught) - Number(a.taught) ||
  teacherRank(a.teacher) - teacherRank(b.teacher) ||
  (b.date ?? '').localeCompare(a.date ?? '') ||
  a.t - b.t

/**
 * The chapter's clips: for each verse, the class the reader lists first for it (the classes
 * whose notes teach it, then those that read it aloud; Bishops, Deacons, Captains, Zakai last;
 * newest first). Verses the same class takes up at the same second share one clip. A verse no
 * class has taken up has no clip.
 */
export const clipsForChapter = (
  data: ChapterClasses | null | undefined,
  chapter: number,
  verses: { v: number; text: string }[]
): ScriptureClip[] => {
  const covering = new Map<number, Candidate[]>()
  const times = new Map<string, number[]>()
  const add = (verse: number, candidate: Candidate) => {
    const list = covering.get(verse) ?? []
    list.push(candidate)
    covering.set(verse, list)
    const seconds = times.get(candidate.video) ?? []
    seconds.push(candidate.t)
    times.set(candidate.video, seconds)
  }
  for (const moment of data?.moments ?? []) {
    if (!VIDEO_ID.test(moment?.video ?? '') || !Number.isFinite(moment.t)) continue
    for (const verse of verseNumbers(moment.verses)) add(verse, { ...moment, taught: true })
  }
  for (const [key, readings] of Object.entries(data?.read ?? {})) {
    const verse = Number(key)
    if (!Number.isInteger(verse) || !Array.isArray(readings)) continue
    for (const reading of readings) {
      if (!VIDEO_ID.test(reading?.video ?? '') || !Number.isFinite(reading.t)) continue
      add(verse, {
        verses: key,
        label: reading.title,
        url: reading.url ?? '',
        date: reading.date,
        video: reading.video,
        t: reading.t,
        ts: reading.ts,
        teacher: reading.teacher,
        taught: false,
      })
    }
  }
  // The class's next moment, leaving the clip at least a few seconds.
  const nextTime = (video: string, after: number) => {
    const later = (times.get(video) ?? []).filter(seconds => seconds >= after + MIN_CLIP_SECONDS)
    return later.length ? Math.min(...later) : undefined
  }

  // The chapter's verses with their text, and any verse a class took up that the text lacks
  // (a Bible not downloaded yet).
  const texts = new Map(verses.map(verse => [verse.v, verse.text]))
  const shown = [...new Set([...texts.keys(), ...covering.keys()])]
    .sort((a, b) => a - b)
    .map(v => ({ v, text: texts.get(v) ?? '' }))
  const clips: ScriptureClip[] = []
  for (const { v, text } of shown) {
    const candidates = (covering.get(v) ?? []).sort(byReaderOrder)
    if (!candidates.length) continue
    const last = clips[clips.length - 1]
    const same =
      last && last.video && (last.vEnd ?? last.v) === v - 1
        ? candidates.find(c => c.video === last.video && c.t === last.start)
        : undefined
    if (last && same) {
      last.vEnd = v
      last.verses = [...(last.verses ?? []), { v, text }]
      last.text = [last.text, text].filter(Boolean).join(' ')
      continue
    }
    const pick = candidates[0]
    clips.push({
      c: chapter,
      v,
      text,
      verses: [{ v, text }],
      video: pick.video,
      start: pick.t,
      end: nextTime(pick.video, pick.t),
      title: pick.label || null,
      teacher: pick.teacher || null,
      date: pick.date || null,
      notes: pick.url || null,
    })
  }
  return clips
}

/** "1:3" or "1:3-5". */
export const clipReference = (clip: Pick<ScriptureClip, 'c' | 'v' | 'vEnd'>) =>
  `${clip.c}:${clip.v}${clip.vEnd && clip.vEnd !== clip.v ? `-${clip.vEnd}` : ''}`
