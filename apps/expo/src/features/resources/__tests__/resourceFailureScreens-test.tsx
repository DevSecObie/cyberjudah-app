import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import DictionaryListScreen from '~features/dictionnary/DictionaryListScreen'
import LexiqueListScreen from '~features/lexique/LexiqueListScreen'
import NaveListScreen from '~features/nave/NaveListScreen'
import { ResourceAccessError } from '../resourceAccessError'
jest.mock('expo-router', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useGlobalSearchParams: () => ({}),
  usePathname: () => '/',
}))
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../../../../test/themeFixture').themeFixture,
}))

let mockIsOnline = true
let mockCatalogError: unknown
let mockListError: string | undefined = 'NETWORK_OFFLINE'
let mockListResults: { word: string; normalizedWord: string }[] = []
const mockCatalogRetry = jest.fn()
let mockStrongAvailability: { status: 'available' | 'missing'; moduleId?: 'core' } = {
  status: 'available',
}

jest.mock('react-native-section-list-get-item-layout', () => () => jest.fn())
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))
jest.mock('expo-sqlite', () => ({}))
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => ({
    data: queryKey.includes('dictionary-catalog')
      ? []
      : queryKey.includes('strong-lexicon')
        ? { availability: mockStrongAvailability, recoveries: [] }
        : { status: 'available' },
    error: queryKey.includes('dictionary-catalog') ? mockCatalogError : undefined,
    isError: queryKey.includes('dictionary-catalog') && Boolean(mockCatalogError),
    refetch: queryKey.includes('dictionary-catalog') ? mockCatalogRetry : jest.fn(),
  }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('jotai/react', () => ({
  useAtom: () => [{ data: {} }, jest.fn()],
  useAtomValue: () => ({ DICTIONNAIRE: 'fr' }),
}))
jest.mock('~state/resourcesLanguage', () => ({
  resourcesLanguageAtom: {},
  useResourceLanguage: () => ['fr', jest.fn()],
}))
jest.mock('src/state/resourcesLanguage', () => ({ useResourceLanguage: () => ['fr', jest.fn()] }), {
  virtual: true,
})
jest.mock('~helpers/useLanguage', () => () => 'fr')
jest.mock('~helpers/useConnection', () => () => mockIsOnline)
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ dictionary: {}, nave: {}, strongLexicon: {} }),
}))
jest.mock('~features/resources/dictionaryAccess', () => ({
  getDefaultDictionaryWork: () => 'BDB',
}))
jest.mock('~features/lexique/useUtilities', () => ({
  useSearchValue: () => ({
    searchValue: '',
    debouncedSearchValue: '',
    setSearchValue: jest.fn(),
  }),
  useInfiniteResultsByLetterOrSearch: () => ({
    results: mockListResults,
    isLoading: false,
    error: mockListError,
    recoveries: ['retry'],
    retry: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
  }),
}))
jest.mock('~features/resources/ResourceUnavailableView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) =>
    ReactModule.createElement('ResourceUnavailableView', props)
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)
})
jest.mock('~common/ui/FormSheetScreen', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children }: React.PropsWithChildren) =>
    ReactModule.createElement('FormSheetScreen', null, children)
})
jest.mock('~common/Header', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('Header', props)
})
jest.mock('~common/AlphabetList', () => () => null)
jest.mock('~common/Empty', () => () => null)
jest.mock('~assets/images/empty-state-icons/word.svg', () => 1)
jest.mock('~common/FiltersHeader', () => () => null)
jest.mock('~common/Loading', () => () => null)
jest.mock('~common/SearchInput', () => () => null)
jest.mock('~common/ui/ListSection', () => ({ ListSectionTitle: () => null }))
jest.mock('~common/Link', () => () => null)
jest.mock('~common/ui/MenuView', () => ({ MenuView: () => null }), { virtual: true })
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/SectionList', () => () => null)
jest.mock('~common/ui/Text', () => () => null)
jest.mock('~features/dictionnary/DictionnaireItem', () => () => null)
jest.mock('~features/lexique/LexiqueItem', () => () => null)
jest.mock('~features/nave/NaveItem', () => () => null)
jest.mock('~navigation/useCanGoBackInStack', () => ({ useCanGoBackInStack: () => false }))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => jest.fn() }))
jest.mock('~features/app-switcher/utils/useResolveNewTabSelection', () => ({
  useResolveNewTabSelection: () => jest.fn(),
}))
jest.mock('~helpers/toast', () => ({ toast: jest.fn() }))

describe('resource failure list screens', () => {
  let renderer: ReactTestRenderer

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    act(() => renderer.unmount())
    mockIsOnline = true
    mockStrongAvailability = { status: 'available' }
    mockCatalogError = undefined
    mockListError = 'NETWORK_OFFLINE'
    mockCatalogRetry.mockClear()
    mockListResults = []
  })

  it.each([
    ['Dictionary', <DictionaryListScreen key="dictionary" dictionaryAtom={{} as never} />],
    ['Lexique', <LexiqueListScreen key="lexique" />],
    ['Nave', <NaveListScreen key="nave" naveAtom={{} as never} />],
  ])('keeps %s network errors classified as offline', (_name, screen) => {
    act(() => {
      renderer = create(screen)
    })

    expect(
      renderer.root.find(node => String(node.type) === 'ResourceUnavailableView').props.failure
    ).toEqual({ cause: 'network-offline', recoveries: ['retry'] })
  })

  it('keeps the Lexique back button on the offline screen', () => {
    act(() => {
      renderer = create(<LexiqueListScreen hasBackButton />)
    })

    expect(renderer.root.find(node => String(node.type) === 'Header').props).toEqual(
      expect.objectContaining({ hasBackButton: true, title: 'Désolé...' })
    )
  })

  it('shows a retryable dictionary catalog failure instead of an empty dictionary', () => {
    mockListError = undefined
    mockCatalogError = new ResourceAccessError('TEMPORARY_UNAVAILABLE', ['retry'])
    act(() => {
      renderer = create(<DictionaryListScreen dictionaryAtom={{} as never} />)
    })
    const failure = renderer.root.find(node => String(node.type) === 'ResourceUnavailableView')
    expect(failure.props.failure.cause).toBe('temporary-unavailable')
    act(() => failure.props.onRetry())
    expect(mockCatalogRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps readable dictionary rows usable during a catalog outage', () => {
    mockListError = undefined
    mockCatalogError = new ResourceAccessError('NETWORK_OFFLINE')
    mockListResults = [{ word: 'Aaron', normalizedWord: 'aaron' }]
    act(() => {
      renderer = create(<DictionaryListScreen dictionaryAtom={{} as never} />)
    })
    expect(
      renderer.root.findAll(node => String(node.type) === 'ResourceUnavailableView')
    ).toHaveLength(0)
  })

  it('describes a missing Strong copy as an offline connection when offline', () => {
    mockIsOnline = false
    mockStrongAvailability = { status: 'missing', moduleId: 'core' }
    act(() => {
      renderer = create(<LexiqueListScreen />)
    })

    expect(
      renderer.root.find(node => String(node.type) === 'ResourceUnavailableView').props
    ).toEqual(
      expect.objectContaining({
        title: 'resource.strong.temporarilyUnavailable',
        failure: { cause: 'network-offline', recoveries: ['retry'] },
      })
    )
  })
})
