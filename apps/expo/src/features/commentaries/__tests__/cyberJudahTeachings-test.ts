jest.mock('~i18n', () => ({ getLanguage: () => 'en' }))
jest.mock('~features/resources/resourceAvailability', () => ({}))
jest.mock('~helpers/atomWithAsyncStorage', () => jest.fn(() => ({})))

const withCyberJudah = (test: () => void) => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  try {
    jest.isolateModules(test)
  } finally {
    if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  }
}

describe('CyberJudah teachings in the reader', () => {
  it('starts every reader with the teachings shown as chips', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDefaultCommentarySelection } = require('../commentarySelection')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getInlineCommentaryResources } = require('../inlineCommentarySelection')
      const selection = getDefaultCommentarySelection('en')
      expect(selection).toEqual(['cyberjudah:en'])
      expect(getInlineCommentaryResources([], selection)).toEqual([
        { resourceId: 'cyberjudah', language: 'en' },
      ])
      expect(getInlineCommentaryResources(undefined, selection)).toEqual([
        { resourceId: 'cyberjudah', language: 'en' },
      ])
    }))

  it('brings the teachings back to a selection saved without them', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { normalizeCommentarySelection } = require('../commentarySelection')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { normalizeInlineCommentaries } = require('../inlineCommentarySelection')
      // Build 303 ran without the CyberJudah catalog and kept only Bible Strong's commentaries.
      const selection = normalizeCommentarySelection(['barnes:en', 'acbc:en', 'mhcc:en'])
      expect(selection).toEqual(['cyberjudah:en'])
      expect(normalizeInlineCommentaries([], selection)).toEqual(['cyberjudah:en'])
    }))

  it('keeps the chips off when the reader switched inline reading off', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getInlineCommentaryResources } = require('../inlineCommentarySelection')
      expect(getInlineCommentaryResources([], ['cyberjudah:en'], false)).toEqual([])
    }))

  it('keeps the recorded KJV audio', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { versions } = require('~helpers/bibleVersions')
      expect(versions.KJV.hasAudio).toBe(true)
      expect(versions.KJV.getAudioUrl(1, 1)).toMatch(/^https:\/\//)
    }))
})
