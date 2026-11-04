import { captionAt, clipLength, clipsForChapter, type ClipCaption } from '../scriptureClips'

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

describe('clipsForChapter', () => {
  const verses = [1, 2, 3, 4].map(v => ({ v, text: `verse ${v}` }))
  const data = {
    moments: [
      {
        verses: '3',
        label: 'Notes class',
        url: '/classes/notes',
        date: '2026-01-01',
        teacher: 'Captain Gideon',
        video: 'BBBBBBBBBBB',
        t: 50,
        ts: '0:50',
      },
    ],
    read: {
      '1': [
        {
          video: 'CCCCCCCCCCC',
          t: 5,
          ts: '',
          title: 'Zakai',
          date: '2026-02-01',
          teacher: 'Zakai',
        },
        {
          video: 'AAAAAAAAAAA',
          t: 10,
          ts: '',
          title: 'Read',
          date: '2025-01-01',
          teacher: 'Bishop Kani',
        },
      ],
      '2': [
        {
          video: 'AAAAAAAAAAA',
          t: 10,
          ts: '',
          title: 'Read',
          date: '2025-01-01',
          teacher: 'Bishop Kani',
        },
      ],
      '3': [
        {
          video: 'AAAAAAAAAAA',
          t: 40,
          ts: '',
          title: 'Read',
          date: '2025-01-01',
          teacher: 'Bishop Kani',
        },
      ],
    },
  }

  it('takes the class the reader lists first and shares a clip across verses', () => {
    const clips = clipsForChapter(data, 1, verses)
    expect(clips.map(clip => [clip.v, clip.vEnd, clip.video, clip.start, clip.end])).toEqual([
      [1, 2, 'AAAAAAAAAAA', 10, 40],
      [3, undefined, 'BBBBBBBBBBB', 50, undefined],
    ])
    expect(clips[0].text).toBe('verse 1 verse 2')
    expect(clips[1].notes).toBe('/classes/notes')
  })

  it('has no clips without classes', () => {
    expect(clipsForChapter(null, 1, verses)).toEqual([])
  })
})
