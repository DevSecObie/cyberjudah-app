// Scripture Clips: the Bible as a vertical feed of class videos, one verse at a time. Each clip
// starts at the second a class read the verse aloud (matched from the class transcript) and runs
// until the class reads the next verse, up to three minutes. This is a CyberJudah component, not
// one of Bible Strong's.

/** One caption line of the class transcript: [from, to, text], seconds from the clip's start. */
export type ClipCaption = [number, number, string]

export type ScriptureClip = {
  /** Chapter and verse. */
  c: number
  v: number
  /** The King James text of the verse. */
  text: string
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

export type ScriptureClipDay = {
  title: string
  book: string
  slug: string
  note?: string
  clips: ScriptureClip[]
}

export const MAX_CLIP_SECONDS = 180

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
