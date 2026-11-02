import { youtubeIdOf } from '~features/passageMediaLibrary/dockedClassPlayerStore'

/** A Bishop's entry split into what he taught and the class it came from. */
export type CommentaryClassEntry = {
  /** The entry without its closing class line. */
  body: string
  classTitle?: string
  date?: string
  video?: { id: string; start: number; label: string }
}

const decode = (text: string) =>
  text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

/**
 * The server closes every entry on `<p class="cj-cite">▶ ts link · class · date</p>`. The class
 * card shows that line as its header instead, so it is taken out of the body here.
 */
export function splitCommentaryClassLine(content: string): CommentaryClassEntry {
  const match = /<p class="cj-cite">([\s\S]*?)<\/p>\s*$/.exec(content)
  if (!match) return { body: content }
  const body = content.slice(0, match.index)
  const parts = match[1].split(' · ')
  const play = /^<a href="([^"]+)">([\s\S]*?)<\/a>$/.exec(parts[0] ?? '')
  const href = play ? decode(play[1]) : ''
  const id = play ? youtubeIdOf(href) : undefined
  const start = Number(/[?&]t=(\d+)s?/.exec(href)?.[1] ?? 0)
  const rest = id ? parts.slice(1) : parts
  return {
    body,
    classTitle: rest[0] ? decode(rest[0]) : undefined,
    date: rest[1] ? decode(rest[1]) : undefined,
    video: id ? { id, start, label: decode(play![2]).replace(/^▶\s*/, '') } : undefined,
  }
}
