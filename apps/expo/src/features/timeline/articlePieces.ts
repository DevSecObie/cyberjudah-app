// An event's article as the Timeline writes it: paragraphs, where a class it cites is a line
// "Title — date — time" followed by the class's link at that moment.

const VIDEO =
  /^https?:\/\/(?:youtu\.be\/|(?:www\.)?youtube\.com\/watch\?v=)([\w-]{11})(?:[?&](?:t|start)=(\d+)s?)?\S*$/
const CITATION = /^(.+?) — (\d{4}-\d{2}-\d{2})(?: — ([\d:]+))?$/

export type ArticlePiece =
  | { kind: 'text'; text: string }
  | { kind: 'class'; video: string; seconds: number; title?: string; date?: string; at?: string }

/** The article's paragraphs, with each class it cites (and the line naming it) as one piece. */
export const articlePieces = (article: string): ArticlePiece[] => {
  const paragraphs = article
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
  const pieces: ArticlePiece[] = []
  for (const paragraph of paragraphs) {
    const video = VIDEO.exec(paragraph)
    if (!video) {
      pieces.push({ kind: 'text', text: paragraph })
      continue
    }
    const last = pieces.at(-1)
    const cited = last?.kind === 'text' ? CITATION.exec(last.text) : null
    if (cited) pieces.pop()
    pieces.push({
      kind: 'class',
      video: video[1],
      seconds: Number(video[2] ?? 0),
      title: cited?.[1],
      date: cited?.[2],
      at: cited?.[3],
    })
  }
  return pieces
}

/**
 * The classes are the authority: an event shows no "Where sources disagree" section, the last
 * section the Timeline build writes, nor a pointer to it.
 */
export const withoutDisagreements = (article: string) =>
  article
    .split(/\n\s*\nWhere sources disagree\s*\n/)[0]
    .replace(/\s*\(see disagreements\)/gi, '')
    .trimEnd()
