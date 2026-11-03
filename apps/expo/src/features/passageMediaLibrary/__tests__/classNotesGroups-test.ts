import { groupScriptures } from '../classNotesGroups'
import type { NoteBlock } from '../cyberJudahClasses'

const verse = (title?: string): NoteBlock => ({
  type: 'verse',
  title,
  target: 'Isa.1.1',
  blocks: [{ type: 'paragraph', html: 'words' }],
})

describe('groupScriptures', () => {
  it('gathers each scripture with the notes taught under it, and leaves the rest as they are', () => {
    const blocks: NoteBlock[] = [
      { type: 'heading', level: 2, html: 'Opening' },
      verse('Isaiah 1:1'),
      { type: 'paragraph', html: 'A point taught on it' },
      { type: 'list', items: [[{ type: 'paragraph', html: 'one' }]] },
      verse(),
      { type: 'paragraph', html: 'A label', variant: 'label' },
      verse('Isaiah 1:2'),
      { type: 'paragraph', html: '<a class="ts" href="#t=60">1:00</a> A moment' },
    ]
    const out = groupScriptures(blocks)
    expect(out.map(item => item.type)).toEqual([
      'heading',
      'scripture',
      'paragraph',
      'scripture',
      'paragraph',
    ])
    const first = out[1] as Extract<(typeof out)[number], { type: 'scripture' }>
    expect(first.title).toBe('Isaiah 1:1')
    expect(first.blocks.map(block => block.type)).toEqual(['verse', 'paragraph', 'list', 'verse'])
  })
})
