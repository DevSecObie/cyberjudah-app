import React from 'react'
import { act, create } from 'react-test-renderer'
import { Image } from 'react-native'
import { useClassStudyData } from '../ClassNotesDeeper'
import type { NoteBlock } from '../cyberJudahClasses'

const mockPlaceholder = jest.fn()
const mockFromModule = jest.fn()
let mockPortraitCatalog: { entities: Record<string, object> } | undefined
const mockEntity = {
  uniqueName: 'fixture-person',
  name: 'Fixture person',
  category: 'person',
  type: 'male',
  verses: [1],
}

jest.mock('expo-asset', () => ({
  Asset: { fromModule: (source: unknown) => mockFromModule(source) },
}))
jest.mock('react-native', () => ({
  // Like react-native-web, Image has no resolveAssetSource static method.
  Image: () => null,
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}))
jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }))
jest.mock('expo-router', () => ({ useRouter: () => ({}) }))
jest.mock('@tanstack/react-query', () => ({
  useQueries: () => [{ data: [mockEntity] }],
  useQuery: () => ({ data: [] }),
}))
jest.mock('~features/lexique/strongEntityAvatars', () => ({
  getStrongEntityPlaceholderSource: (...args: unknown[]) => mockPlaceholder(...args),
}))
jest.mock('~features/lexique/entityPortraitManifest', () => ({
  useEntityPortraitCatalog: () => mockPortraitCatalog,
}))
jest.mock('~features/lexique/entityPortraits', () => ({
  getEntityAvatarRadius: () => 12,
  getEntityChapterPortraitHash: () => 'fixture-hash',
  getEntityPortraitUri: () => 'https://example.test/portrait.png',
}))
jest.mock('~features/lexique/entityPortraitPack', () => ({
  getEntityPortraitLocalUri: () => 'file:///portrait.png',
  useEntityPortraitLocalHashes: () => new Set(),
}))
jest.mock('~features/lexique/strongDetailRoutes', () => ({ createStrongDetailRoute: jest.fn() }))
jest.mock('~features/publishedNotes/classTeaching', () => ({ loadTopics: jest.fn() }))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ strongLexicon: { loadChapterEntities: jest.fn() } }),
}))
jest.mock('~helpers/bcvParser', () => ({
  osisToBibleReferenceTarget: () => ({ book: 1, chapter: 1, verse: 1 }),
}))
jest.mock('~helpers/queryOptions', () => ({ localQueryOptions: {} }))
jest.mock('~helpers/resourceQueryKeys', () => ({
  resourceQueryKeys: { strongLexiconChapterEntities: () => ['fixture'] },
}))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: jest.fn() }))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: jest.fn() }))

const blocks: NoteBlock[] = [{ type: 'verse', target: 'Gen.1.1', blocks: [] }]

const readStudy = () => {
  let result: ReturnType<typeof useClassStudyData> | undefined
  const Probe = () => {
    result = useClassStudyData(blocks)
    return null
  }
  let renderer: ReturnType<typeof create>
  act(() => {
    renderer = create(<Probe />)
  })
  act(() => renderer.unmount())
  return result!
}

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ;(globalThis as { __DEV__?: boolean }).__DEV__ = true
})

beforeEach(() => {
  jest.clearAllMocks()
  mockPortraitCatalog = undefined
})

it.each([
  {
    kind: 'web asset object',
    source: { uri: '/assets/placeholder.png', width: 32, height: 32 },
    uri: '/assets/placeholder.png',
  },
  { kind: 'web asset string', source: '/assets/placeholder.png', uri: '/assets/placeholder.png' },
  { kind: 'native asset id', source: 17, uri: 'file:///placeholder.png' },
])('resolves a $kind for class and verse chips without the native Image API', ({ source, uri }) => {
  expect(Image.resolveAssetSource).toBeUndefined()
  mockPlaceholder.mockReturnValue(source)
  mockFromModule.mockReturnValue({ uri })

  const study = readStudy()

  expect(study.pdfDetails.people).toEqual([{ name: 'Fixture person', image: uri }])
  expect(study.pdfDetails.verseChips['Gen.1.1']).toEqual([{ name: 'Fixture person', image: uri }])
  expect(mockFromModule).toHaveBeenCalledWith(source)
})

it('keeps an available portrait without resolving a placeholder', () => {
  mockPortraitCatalog = { entities: { 'fixture-person': {} } }

  const study = readStudy()

  expect(study.pdfDetails.people[0].image).toBe('https://example.test/portrait.png')
  expect(mockPlaceholder).not.toHaveBeenCalled()
  expect(mockFromModule).not.toHaveBeenCalled()
})
