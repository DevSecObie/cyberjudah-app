import {
  chapterClasses,
  classesByVerse,
  formatClassDate,
  loadChapterClasses,
  toClassPassageMedia,
  verseNumbers,
  withClassPassageMedia,
  type ChapterClasses,
} from '../classMoments'

const chapter: ChapterClasses = {
  moments: [
    {
      verses: '10',
      label: 'If You Leave Now',
      url: '/classes/2026/a',
      date: '2026-10-24',
      teacher: 'Captain Mattathias',
      video: '82pXYTvNmkU',
      t: 1112,
      ts: '18:32',
    },
    {
      verses: '8-10',
      label: 'Prison House of Shadows',
      url: '/classes/2026/b',
      date: '2026-08-15',
      teacher: 'Bishop Nathanyel',
      video: 'maQroMAMqbw',
      t: 8885,
      ts: '2:28:05',
    },
    { verses: '9', label: 'Bad id', url: '/x', date: '', video: 'nope', t: 1, ts: '0:01' },
  ],
  read: {
    '10': [
      {
        video: '82pXYTvNmkU',
        t: 50,
        ts: '0:50',
        title: 'If You Leave Now',
        date: '2026-10-24',
        teacher: '',
      },
      {
        video: 'PRhlouDtXoQ',
        t: 16757,
        ts: '4:39:17',
        title: 'The Destruction at Noon Day',
        date: '2022-11-25',
        teacher: 'Bishop Nathaniel',
      },
    ],
    '1': [
      {
        video: '075qOUs8Sbc',
        t: 9579,
        ts: '2:39:39',
        title: 'Joseph in Egypt',
        date: '2026-05-30',
        teacher: '',
      },
    ],
  },
}

describe('class moments', () => {
  it('reads verse lists and ranges', () => {
    expect(verseNumbers('8-10')).toEqual([8, 9, 10])
    expect(verseNumbers('3,1')).toEqual([1, 3])
    expect(verseNumbers('')).toEqual([])
  })

  it("puts each class after the last verse it read, the Bishops' first, then the classes read aloud", () => {
    const byVerse = classesByVerse(chapter)
    expect(byVerse[10].map(m => m.video)).toEqual(['maQroMAMqbw', '82pXYTvNmkU', 'PRhlouDtXoQ'])
    expect(byVerse[1].map(m => m.video)).toEqual(['075qOUs8Sbc'])
    expect(byVerse[9]).toBeUndefined()
  })

  it('lists the chapter once per class: taught first, then read in class', () => {
    const { taught, read } = chapterClasses(classesByVerse(chapter))
    expect(taught.map(m => m.video)).toEqual(['maQroMAMqbw', '82pXYTvNmkU'])
    expect(read.map(m => m.video)).toEqual(['PRhlouDtXoQ', '075qOUs8Sbc'])
  })

  it('turns them into passage media that play from the moment', () => {
    const media = toClassPassageMedia(chapter, {
      bookName: 'Genesis',
      chapter: 49,
      sectionTitles: { taught: 'Taught from Genesis 49', read: 'Read in class' },
    })
    const first = media.afterVerses[10][0]
    expect(first).toMatchObject({
      providerId: 'maQroMAMqbw',
      title: 'Prison House of Shadows',
      reference: 'Genesis 49:8-10',
      startSeconds: 8885,
      subtitle: 'Bishop Nathanyel · Aug 15, 2026',
      sourceUrl: 'https://www.youtube.com/watch?v=maQroMAMqbw&t=8885s',
      thumbnailUrl: 'https://i.ytimg.com/vi/maQroMAMqbw/mqdefault.jpg',
    })
    expect(media.gallerySections?.map(s => [s.title, s.items.length])).toEqual([
      ['Taught from Genesis 49', 2],
      ['Read in class', 2],
    ])
    // The same moment is one item wherever it shows, so its card flies between the decks.
    expect(media.gallerySections?.[0].items[0]).toBe(first)
  })

  it('adds the classes after Bible Strong media without dropping any', () => {
    const base = {
      introduction: [],
      isIntroductionStartChapter: false,
      afterVerses: {},
      chapterResources: [],
    }
    expect(withClassPassageMedia(base, null)).toBe(base)
    const merged = withClassPassageMedia(
      base,
      toClassPassageMedia(chapter, {
        bookName: 'Genesis',
        chapter: 49,
        sectionTitles: { taught: 'a', read: 'b' },
      })
    )
    expect(Object.keys(merged.afterVerses)).toEqual(['1', '10'])
  })

  it('formats dates as the Telegram app does', () => {
    expect(formatClassDate('2026-10-24')).toBe('Oct 24, 2026')
    expect(formatClassDate('')).toBe('')
  })

  it('reads the published chapter and treats a missing file as no classes', async () => {
    const fetcher = jest.fn(async (url: string) =>
      url.endsWith('/genesis/49.json')
        ? ({ ok: true, status: 200, json: async () => chapter } as Response)
        : ({ ok: false, status: 404 } as Response)
    ) as unknown as typeof fetch
    await expect(loadChapterClasses(1, 49, fetcher)).resolves.toBe(chapter)
    await expect(loadChapterClasses(1, 50, fetcher)).resolves.toBeNull()
    expect((fetcher as unknown as jest.Mock).mock.calls[0][0]).toBe(
      'https://data.cyberjudah.io/api/concordance/genesis/49.json'
    )
  })
})
