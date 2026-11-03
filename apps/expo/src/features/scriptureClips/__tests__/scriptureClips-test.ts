import { captionAt, clipLength, type ClipCaption } from '../scriptureClips'

const captions: ClipCaption[] = [
  [0, 2, 'In the beginning, God created'],
  [2, 4, 'the heaven and the earth.'],
]

describe('captionAt', () => {
  it('shows the words of the line as they are said', () => {
    expect(captionAt(captions, 0)).toEqual({
      line: 0,
      words: ['In', 'the', 'beginning,', 'God', 'created'],
      shown: 1,
    })
    expect(captionAt(captions, 1.9)?.shown).toBe(5)
    expect(captionAt(captions, 2.1)?.line).toBe(1)
  })

  it('shows nothing before the clip or without captions', () => {
    expect(captionAt(captions, -1)).toBeNull()
    expect(captionAt(undefined, 1)).toBeNull()
  })
})

describe('clipLength', () => {
  it('runs to the next verse, never past three minutes', () => {
    expect(clipLength({ c: 1, v: 1, text: '', start: 564, end: 567.4 })).toBeCloseTo(3.4)
    expect(clipLength({ c: 1, v: 1, text: '', start: 100, end: 1000 })).toBe(180)
    expect(clipLength({ c: 1, v: 1, text: '' })).toBe(0)
  })
})
