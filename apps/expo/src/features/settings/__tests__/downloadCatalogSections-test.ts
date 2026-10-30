import type { DictionaryWork } from '../../resources/dictionaryAccess'

jest.mock('expo/virtual/env', () => ({ env: process.env }))
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: '/documents/' }))
jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'en',
  default: { t: (key: string) => key },
}))
jest.mock('~features/resources/resourceAvailability', () => ({
  getIfLocalResourceNeedsDownload: jest.fn(),
}))
jest.mock('~helpers/resourcePublication', () => ({
  resourcePublicationStore: { read: jest.fn() },
}))
jest.mock('~helpers/offlineCopy', () => jest.requireActual('../../../helpers/offlineCopyId'))

const previousProfile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
const publishedDictionary: DictionaryWork = {
  resource: {
    kind: 'dictionary',
    work: 'jewish-encyclopedia',
    language: 'en',
    revision: 'catalog',
  },
  resourceId: 'JEWISH_ENCYCLOPEDIA',
  title: 'The Jewish Encyclopedia (1901–1906)',
  abbreviation: 'Jewish Encyclopedia',
  authors: ['Isidore Singer, editor'],
  description: 'Historical reference',
  edition: '1901–1906',
  source: 'CyberJudah library',
  attribution: 'Public domain',
  onlineAccess: true,
  offlineDownload: true,
}
afterEach(() => {
  if (previousProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previousProfile
})

describe('native Downloads with the published resource catalog', () => {
  it.each(['en', 'fr'])(
    'opens the CyberJudah catalog in %s without unpublished downloads',
    lang => {
      process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
      jest.isolateModules(() => {
        const { buildDownloadCatalogSections } = jest.requireActual('../downloadCatalogSections')
        const { MOBILE_RESOURCE_CATALOG } = jest.requireActual(
          '../../../helpers/mobileResourceCatalog'
        )
        // Real catalog and download factories: no catch-all catalog mock can hide a missing entry.
        const sections = buildDownloadCatalogSections(lang, (key: string) => key, [
          publishedDictionary,
        ])
        const ids = sections.flatMap((section: { data: { id: string }[] }) =>
          section.data.map(item => item.id)
        )
        // Dictionary UI identities are first-class; the artifact catalog still uses database:*.
        const catalogIds = ids.map((id: string) =>
          id.startsWith('dictionary:') ? `database:${id.split(':').slice(2).join(':')}` : id
        )
        expect(catalogIds.sort()).toEqual(Object.keys(MOBILE_RESOURCE_CATALOG.resources).sort())
        expect(ids).toContain('dictionary:jewish-encyclopedia:JEWISH_ENCYCLOPEDIA:en')
        expect(ids).toContain('bible:KJV')
        expect(ids).toContain('bible-strong:KJV')
        expect(ids).toContain('database:TIMELINE:en')
        expect(ids).not.toContain('strong-lexicon:simple-fr')
      })
    }
  )

  it('preserves Bible Strong study tools when their archives are published', () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'upstream'
    jest.isolateModules(() => {
      const { buildDownloadCatalogSections } = jest.requireActual('../downloadCatalogSections')
      const sections = buildDownloadCatalogSections('en', (key: string) => key, [])
      const ids = sections.flatMap((section: { data: { id: string }[] }) =>
        section.data.map(item => item.id)
      )
      expect(ids).toEqual(
        expect.arrayContaining([
          'strong-lexicon:simple-fr',
          'strong-lexicon:simple-en',
          'strong-lexicon:core',
          'strong-lexicon:resources',
          'strong-lexicon:entities',
          'database:NAVE:en',
          'database:DICTIONNAIRE:fr',
        ])
      )
    })
  })

  it('keeps the detailed lexicon without an unavailable simple-lexicon parent', () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'upstream'
    jest.isolateModules(() => {
      const { buildDownloadCatalogSections } = jest.requireActual('../downloadCatalogSections')
      const { MOBILE_RESOURCE_CATALOG } = jest.requireActual(
        '../../../helpers/mobileResourceCatalog'
      )
      delete MOBILE_RESOURCE_CATALOG.resources['strong-lexicon:simple-fr']
      const french = buildDownloadCatalogSections('fr', (key: string) => key, []).find(
        (section: { key: string }) => section.key === 'fr'
      )
      const detailed = french.data.find((item: { id: string }) => item.id === 'strong-lexicon:core')
      expect(detailed).toBeDefined()
      expect(detailed).not.toHaveProperty('parentItemId')
    })
  })

  it('does not offer dependent modules when their core archive is absent', () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'upstream'
    jest.isolateModules(() => {
      const { buildDownloadCatalogSections } = jest.requireActual('../downloadCatalogSections')
      const { MOBILE_RESOURCE_CATALOG } = jest.requireActual(
        '../../../helpers/mobileResourceCatalog'
      )
      delete MOBILE_RESOURCE_CATALOG.resources['strong-lexicon:core']
      const ids = buildDownloadCatalogSections('en', (key: string) => key, []).flatMap(
        (section: { data: { id: string }[] }) => section.data.map(item => item.id)
      )
      expect(ids).toContain('strong-lexicon:simple-en')
      expect(ids).not.toContain('strong-lexicon:entities')
      expect(ids).not.toContain('strong-lexicon:resources')
    })
  })

  it('retains strict validation for an archive that is present but inconsistent', () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'upstream'
    jest.isolateModules(() => {
      const { buildDownloadCatalogSections } = jest.requireActual('../downloadCatalogSections')
      const { MOBILE_RESOURCE_CATALOG } = jest.requireActual(
        '../../../helpers/mobileResourceCatalog'
      )
      MOBILE_RESOURCE_CATALOG.resources['strong-lexicon:core'].entries.canonical.entry =
        'wrong.sqlite'
      expect(() => buildDownloadCatalogSections('en', (key: string) => key, [])).toThrow(
        'STRONG_LEXICON_CATALOG_ENTRY_MISMATCH:core'
      )
    })
  })
})
