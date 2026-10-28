jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))
jest.mock('expo/virtual/env', () => ({ env: process.env }))
jest.mock('~i18n', () => ({ getLanguage: () => 'en', default: { t: (s: string) => s } }))
jest.mock('../../../i18n', () => ({ getLanguage: () => 'en' }))

describe('CyberJudah book identities', () => {
  const previous = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  beforeAll(() => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  })
  afterAll(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previous
  })
  it('keeps all 81 published book IDs and limits the version picker to KJV', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getBooksForCanon } = require('../bibleBookCatalog')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { versions } = require('../bibleVersions')
      const books = getBooksForCanon('kjv-1611')
      expect(books).toHaveLength(81)
      expect(books[68]).toMatchObject({ Numero: 69, Nom: 'Tobit' })
      expect(books[79]).toMatchObject({ Numero: 80, Nom: '1 Maccabees' })
      expect(Object.keys(versions)).toEqual(['KJV'])
    })
  })
  it.each([
    ['Tob.1.1', 69],
    ['1Esd.1.1', 67],
    ['GkEsth.10.4', 71],
    ['PrMan.1.1', 79],
    ['1Macc.2.1', 80],
    ['2Macc.15.1', 81],
  ])('opens %s in book %s', (osis, book) => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { osisToBibleReferenceTarget } = require('../bcvParser')
      expect(osisToBibleReferenceTarget(osis, 'en')?.book).toBe(book)
    })
  })
})
