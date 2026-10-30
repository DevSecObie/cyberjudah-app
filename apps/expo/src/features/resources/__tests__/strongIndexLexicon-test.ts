import type {
  OfflineResourceRegistryEntry,
  OfflineResourceRegistrySnapshot,
} from '../resourceAvailability'
import { getStrongIndexLexiconModuleId } from '../strongIndexLexicon'

const lexicon = (moduleId: string, status: string): OfflineResourceRegistryEntry =>
  ({
    id: `strong-lexicon:${moduleId}`,
    resource: { kind: 'strong-lexicon-module', moduleId },
    availability: { status },
    verified: true,
    updateAvailable: false,
  }) as OfflineResourceRegistryEntry

const registry = (
  entries: OfflineResourceRegistryEntry[] = []
): OfflineResourceRegistrySnapshot => ({
  revision: 1,
  phase: 'ready',
  resources: new Map(entries.map(entry => [entry.id, entry])),
})

describe('Strong lexicon acquired with a Strong Bible index', () => {
  it('is the simple lexicon in the Strong language when none is installed', () => {
    expect(getStrongIndexLexiconModuleId(registry(), 'fr')).toBe('simple-fr')
    expect(getStrongIndexLexiconModuleId(registry(), 'en')).toBe('simple-en')
  })

  it.each(['simple-fr', 'core'])('is not needed once %s is installed', moduleId => {
    expect(
      getStrongIndexLexiconModuleId(registry([lexicon(moduleId, 'available')]), 'fr')
    ).toBeUndefined()
  })

  it('ignores the simple lexicon of another language', () => {
    expect(getStrongIndexLexiconModuleId(registry([lexicon('simple-en', 'available')]), 'fr')).toBe(
      'simple-fr'
    )
  })

  it('replaces an installed lexicon that can no longer be read', () => {
    expect(
      getStrongIndexLexiconModuleId(registry([lexicon('simple-fr', 'incompatible')]), 'fr')
    ).toBe('simple-fr')
  })
})

describe('Strong lexicon acquired with the CyberJudah Strong index', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  afterEach(() => {
    if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  })

  // 304 crashed on download with MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:strong-lexicon:simple-en.
  it('pairs no lexicon the catalog does not publish, so the KJV and its index still download', () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const isolated = require('../strongIndexLexicon') as typeof import('../strongIndexLexicon')
      expect(isolated.getStrongIndexLexiconModuleId(registry(), 'en')).toBeUndefined()
      expect(isolated.getStrongIndexLexiconModuleId(registry(), 'fr')).toBeUndefined()
      // Pairing Bible Strong's simple lexicon is exactly what crashed the download.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const items =
        require('~helpers/strongLexiconDownloadItems') as typeof import('~helpers/strongLexiconDownloadItems')
      expect(() => items.createStrongLexiconModuleDownloadItem('simple-en')).toThrow(
        'MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:strong-lexicon:simple-en'
      )
    })
  })
})
