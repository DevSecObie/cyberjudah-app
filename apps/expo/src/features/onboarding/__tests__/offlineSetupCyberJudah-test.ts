// The CyberJudah build's offline setup: the classes and the published study data are offered.
jest.mock('~helpers/bibleVersions', () => ({
  versions: {
    KJV: { id: 'KJV', name: 'King James', language: 'en', readingProfile: 'word-for-word' },
  },
}))

jest.mock('~helpers/databases', () => ({
  databases: jest.fn((lang: string) => ({
    DICTIONNAIRE: { name: `Dictionary ${lang}`, desc: '' },
    NAVE: { name: `Nave ${lang}`, desc: '' },
    TRESOR: { name: 'Cross references', desc: '' },
    MHY: { name: 'Commentary', desc: '' },
    TIMELINE: { name: `Timeline ${lang}`, desc: '' },
  })),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'KJV'),
}))

jest.mock('~helpers/commentaryCatalog', () => ({
  getCommentaryCatalogForLanguage: jest.fn(() => []),
}))

jest.mock('~features/resources/dictionaryAccess', () => ({
  KNOWN_DICTIONARY_WORKS: [
    {
      resource: { work: 'jewish-encyclopedia', language: 'en' },
      resourceId: 'JEWISH_ENCYCLOPEDIA',
      title: 'The Jewish Encyclopedia (1901–1906)',
      abbreviation: 'Jewish Encyclopedia',
      authors: ['Isidore Singer, editor'],
      description: '',
      offlineDownload: true,
    },
  ],
}))

const loadPresets = (): typeof import('../offlineSetupPresets') => {
  let presets: typeof import('../offlineSetupPresets') | undefined
  jest.isolateModules(() => {
    presets = require('../offlineSetupPresets')
  })
  return presets!
}

describe('CyberJudah offline setup', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE

  beforeAll(() => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  })

  it('offers the classes first, checked with the Bible from the start', () => {
    const presets = loadPresets()
    const sections = presets.getOfflineSetupFolderSections('explore-bible', 'en')

    expect(sections[0]).toMatchObject({
      id: 'classes',
      options: [{ id: 'class-library', selections: [{ kind: 'class-library' }] }],
    })
    expect(presets.getDefaultOfflineSetupFolderOptionIds('en')).toMatchObject({
      'read-bible': ['bible:KJV'],
      'explore-bible': ['class-library'],
    })
    expect(
      presets.resolveOfflineSetupFolderOptionIds(
        presets.getDefaultOfflineSetupFolderOptionIds('en'),
        'en'
      )
    ).toEqual([{ kind: 'bible', versionId: 'KJV' }, { kind: 'class-library' }])
  })

  it('offers the biblical entities on their own and the published dictionary', () => {
    const options = loadPresets()
      .getOfflineSetupFolderSections('explore-bible', 'en')
      .flatMap(section => section.options)

    expect(options.find(option => option.id === 'strong-lexicon:entities')).toMatchObject({
      requires: undefined,
      selections: [{ kind: 'strong-lexicon', moduleId: 'entities' }],
    })
    expect(
      options.some(option => option.id === 'dictionary:jewish-encyclopedia:JEWISH_ENCYCLOPEDIA:en')
    ).toBe(true)
  })

  it('offers the English Strong lexicon and the KJV with Strong numbers to understand the words', () => {
    const options = loadPresets()
      .getOfflineSetupFolderSections('understand-words', 'en')
      .flatMap(section => section.options)
      .map(option => option.id)

    expect(options).toContain('strong-lexicon:simple-en')
    expect(options).toContain('bible-strong:KJV')
    expect(options).not.toContain('strong-lexicon:core')
  })
})
