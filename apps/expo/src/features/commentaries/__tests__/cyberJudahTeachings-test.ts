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
  const BISHOPS = ['bishop-nathanyel:en', 'bishop-yawasap:en', 'bishop-kani:en']

  it("starts every reader with the three Bishops' commentaries, each under his own name", () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDefaultCommentarySelection } = require('../commentarySelection')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getInlineCommentaryResources } = require('../inlineCommentarySelection')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { COMMENTARY_CATALOG } = require('~helpers/commentaryCatalog')
      const selection = getDefaultCommentarySelection('en')
      expect(selection).toEqual(BISHOPS)
      expect(COMMENTARY_CATALOG.map((e: { shortName: string }) => e.shortName)).toEqual([
        'Bishop Nathanyel',
        'Bishop Yawasap',
        'Bishop Kani',
      ])
      expect(JSON.stringify(COMMENTARY_CATALOG)).not.toMatch(/CyberJudah/)
      expect(getInlineCommentaryResources([], selection)).toEqual([
        { resourceId: 'bishop-nathanyel', language: 'en' },
        { resourceId: 'bishop-yawasap', language: 'en' },
        { resourceId: 'bishop-kani', language: 'en' },
      ])
    }))

  it('replaces a selection saved for an earlier build with the Bishops', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { normalizeCommentarySelection } = require('../commentarySelection')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { normalizeInlineCommentaries } = require('../inlineCommentarySelection')
      // Build 303 kept Bible Strong's commentaries; later builds kept the single "cyberjudah" one.
      for (const saved of [['barnes:en', 'acbc:en', 'mhcc:en'], ['cyberjudah:en']]) {
        const selection = normalizeCommentarySelection(saved)
        expect(selection).toEqual(BISHOPS)
        expect(normalizeInlineCommentaries(['cyberjudah:en'], selection)).toEqual(BISHOPS)
      }
      expect(normalizeInlineCommentaries(['bishop-kani:en'], BISHOPS)).toEqual(['bishop-kani:en'])
    }))

  it('keeps the chips off when the reader switched inline reading off', () =>
    withCyberJudah(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getInlineCommentaryResources } = require('../inlineCommentarySelection')
      expect(getInlineCommentaryResources([], BISHOPS, false)).toEqual([])
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
