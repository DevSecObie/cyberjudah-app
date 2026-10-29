jest.mock('expo/virtual/env', () => ({ env: process.env }))
jest.mock('../biblesDb', () => ({ getChapterVerseCount: jest.fn() }))

type Coverage = import('../biblesDb').BibleVersionCoverage

const coverage: Coverage = {
  books: [43, 71],
  chaptersByBook: { 43: [3], 71: [10, 11] },
  verseCountByBookChapter: { '43-3': 36, '71-10': 10, '71-11': 12 },
}

const withProfile = (profile: string | undefined, run: () => void) => {
  const previous = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  try {
    jest.isolateModules(run)
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previous
  }
}

describe('CyberJudah verse numbering', () => {
  it('numbers Rest of Esther 10 from verse 4, as the published KJV does', () => {
    withProfile('cyberjudah', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const coverageTools = require('../bibleCoverage')
      expect(coverageTools.getChapterVerseNumbersFromCoverage(coverage, 71, 10)).toEqual([
        4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
      ])
      expect(coverageTools.getChapterFirstVerse(71, 10)).toBe(4)
      expect(coverageTools.getChapterLastVerseFromCoverage(coverage, 71, 10)).toBe(13)
      expect(coverageTools.getChapterLastVerse(71, 10, 10)).toBe(13)
    })
  })

  it('keeps every other chapter numbered from verse 1', () => {
    withProfile('cyberjudah', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const coverageTools = require('../bibleCoverage')
      expect(coverageTools.getChapterVerseNumbersFromCoverage(coverage, 71, 11)).toHaveLength(12)
      expect(coverageTools.getChapterVerseNumbersFromCoverage(coverage, 71, 11)[0]).toBe(1)
      expect(coverageTools.getChapterLastVerseFromCoverage(coverage, 43, 3)).toBe(36)
      expect(coverageTools.getChapterVerseNumbersFromCoverage(coverage, 43, 4)).toBeUndefined()
    })
  })

  it('leaves the upstream profile unchanged', () => {
    withProfile(undefined, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const coverageTools = require('../bibleCoverage')
      expect(coverageTools.getChapterFirstVerse(71, 10)).toBe(1)
      expect(coverageTools.getChapterLastVerseFromCoverage(coverage, 71, 10)).toBe(10)
    })
  })

  it('records the numbering of the same text revision as the offline archive', () => {
    const numbering = require('../../assets/cyberjudah/verse-numbering.json')
    const catalog = require('../../assets/cyberjudah/offline-catalog.json')
    expect(numbering.textSha256).toBe(catalog.resources['bible:KJV'].textSha256)
    expect(numbering.firstVerseByBookChapter).toEqual({ '71-10': 4 })
  })
})
