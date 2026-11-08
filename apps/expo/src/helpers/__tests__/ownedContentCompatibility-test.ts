import { versions, getBibleVersionCanonId } from '../bibleVersions'
import { getBook, getBookIdsForCanon } from '../bibleBookCatalog'
import { BUNDLED_MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'
import { requiresStrongLexiconCore } from '../strongLexiconCore'
import sources from '../../../scripts/data/free-bible-sources.json'

jest.mock('~i18n', () => ({ getLanguage: () => 'en' }))
jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))

describe('owned content compatibility', () => {
  it('registers every retained rebuilt Bible with its supplied language and complete credit', () => {
    for (const bible of sources.bibles.filter(
      bible => !bible.excluded && BUNDLED_MOBILE_RESOURCE_CATALOG.resources[bible.catalogId]
    )) {
      expect(BUNDLED_MOBILE_RESOURCE_CATALOG.resources[bible.catalogId]).toBeDefined()
      expect(versions[bible.id]).toMatchObject({
        language: bible.language,
        c: bible.credit,
        sourceUrl: bible.source.page,
        hasPericope: false,
        hasRedWords: false,
      })
      expect(versions[bible.id].hasAudio).toBeFalsy()
      expect(versions[bible.id].getAudioUrl).toBeUndefined()
    }
  })

  it('adds the owned books without renaming any upstream identity', () => {
    expect(getBook(67)?.Nom).toMatch(/Tob/)
    expect(getBook(74)).toBeDefined()
    expect(getBook(76)?.Nom).toMatch(/Macc/)
    expect(getBook(84)).toBeDefined()
    expect(getBookIdsForCanon(getBibleVersionCanonId('KJVA'))).toHaveLength(81)
    expect(getBookIdsForCanon(getBibleVersionCanonId('DUTSVVA'))).toContain(75)
    expect(getBookIdsForCanon(getBibleVersionCanonId('KJV'))).toContain(84)
  })

  it('keeps owned lexicon enrichments usable without the withdrawn core', () => {
    expect(BUNDLED_MOBILE_RESOURCE_CATALOG.resources['strong-lexicon:core']).toBeUndefined()
    expect(requiresStrongLexiconCore('entities')).toBe(false)
    expect(requiresStrongLexiconCore('resources')).toBe(false)
    expect(requiresStrongLexiconCore('simple-en')).toBe(false)
  })
})
