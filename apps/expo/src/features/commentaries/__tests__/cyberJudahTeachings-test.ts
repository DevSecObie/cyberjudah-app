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
  it('keeps the teachings out of the reader until they carry their teachers\' names', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDefaultCommentarySelection } = require('../commentarySelection')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getInlineCommentaryResources } = require('../inlineCommentarySelection')
      const selection = getDefaultCommentarySelection('en')
      expect(selection).toEqual(['cyberjudah:en'])
      expect(getInlineCommentaryResources([], selection)).toEqual([])
      expect(getInlineCommentaryResources(['cyberjudah:en'], selection, true)).toEqual([])
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

  it('plays our own recordings in the Apocrypha, and nothing where there is none', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { versions } = require('~helpers/bibleVersions')
      expect(versions.KJV.getAudioUrl(80, 1)).toBe(
        'https://cyberjudah.io/api/audio/recordings/ancientchristian/1-maccabees/1.m4a'
      )
      expect(versions.KJV.getAudioUrl(69, 5)).toBe('')
      expect(versions.KJV.getAudioUrl(73, 1)).toBe('')
      expect(versions.KJV.getAudioUrl(81, 15)).not.toMatch(/wordpocket/)
    }))
})
