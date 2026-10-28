it('does not expose the original video catalog through reader, Strong or library entry points', () => {
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
      expect(media.getPassageMediaLibrary({ language: 'en' })).toEqual([])
      expect(media.getPassageMediaForBook(1, 'en')).toEqual([])
      expect(media.getPassageMediaById('book-genesis', 'en')).toBeNull()
    })
  } finally {
    if (originalProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = originalProfile
  }
})
