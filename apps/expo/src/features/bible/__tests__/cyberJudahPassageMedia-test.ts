it('lists only CyberJudah classes and never the original video catalog', () => {
  const originalProfile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const media = require('../passageMedia') as typeof import('../passageMedia')
      expect(media.getPassageMediaForChapter({ book: 1, chapter: 1, language: 'en' })).toEqual({
        introduction: [],
        afterVerses: {},
        chapterResources: [],
        isIntroductionStartChapter: false,
      })
      expect(media.getPassageMediaForStrong({ strongCode: 'H7225', language: 'en' })).toEqual([])
      const library = media.getPassageMediaLibrary({ language: 'en' })
      expect(library.map(item => item.series)).toEqual([
        ...Array(3).fill('IUIC in the ClassRoom'),
        ...Array(3).fill('15 Minutes w/ The Captains'),
        ...Array(3).fill('Our Hidden History'),
      ])
      expect(library.every(item => item.workId.startsWith('cyberjudah-class-'))).toBe(true)
      expect(media.getPassageMediaForBook(1, 'en')).toEqual([])
      expect(media.getPassageMediaById('book-genesis', 'en')).toBeNull()
    })
  } finally {
    if (originalProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = originalProfile
  }
})
