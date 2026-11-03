import type { NoteBlock } from './cyberJudahClasses'

// The class notes gathered one scripture at a time, for the Go Deeper look of ClassNotesList.

/** A scripture the class opened, with everything said on it until the next one. */
export type ScriptureGroup = {
  type: 'scripture'
  title?: string
  seek?: { href: string; label: string }
  target?: string
  blocks: NoteBlock[]
}

const passageTitle = (html: string) => /<a href="bible:\/\/[^"]*">([^<]+)<\/a>/.exec(html)?.[1]
const passageTarget = (html: string) => /<a href="bible:\/\/([^"]+)">/.exec(html)?.[1]
const passageSeek = (html: string) => {
  const match = /<a class="ts" href="([^"]*)">([^<]*)<\/a>/.exec(html)
  return match ? { href: match[1], label: match[2] } : undefined
}
/** A line of the notes that is a moment of the class on its own ("▶ 10:28 In the News …"). */
const isMoment = (block: NoteBlock) =>
  block.type === 'paragraph' && !block.variant && /^\s*<a class="ts"/.test(block.html)

/**
 * The notes' top-level blocks with each scripture gathered into one group: its passage line, its
 * verses and the points and precepts under them, up to the next scripture, heading or moment.
 */
export const groupScriptures = (blocks: NoteBlock[]): (NoteBlock | ScriptureGroup)[] => {
  const out: (NoteBlock | ScriptureGroup)[] = []
  let group: ScriptureGroup | undefined
  const open = (next: ScriptureGroup) => {
    group = next
    out.push(next)
  }
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.variant === 'passage') {
      open({
        type: 'scripture',
        title: passageTitle(block.html),
        seek: passageSeek(block.html),
        target: passageTarget(block.html),
        blocks: [],
      })
    } else if (block.type === 'verse') {
      // A verse quoted under its own reference starts its scripture; the others belong to the open one.
      if (block.title || !group)
        open({
          type: 'scripture',
          title: block.title,
          seek: block.seek,
          target: block.target,
          blocks: [block],
        })
      else {
        group.blocks.push(block)
        group.target ??= block.target
      }
    } else if (
      group &&
      !isMoment(block) &&
      (block.type === 'list' ||
        block.type === 'quote' ||
        (block.type === 'paragraph' && block.variant !== 'label'))
    ) {
      group.blocks.push(block)
    } else {
      group = undefined
      out.push(block)
    }
  }
  return out
}
