import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import AskVerseComparison from '../AskVerseComparison'
import { loadWidgetPassage } from '../widgets/passageData'

const mockNavigate = jest.fn()
const mockRefetch = jest.fn()
const mockLoad = jest.fn()
let mockQuery: Record<string, unknown>
let mockQueryFor: ((key: unknown[]) => Record<string, unknown>) | undefined
let mockWindow = { width: 390, fontScale: 1 }
const passage = { version: 'KJV', book: 43, chapter: 1, start: 1, end: 2 }
function mockHost(name: string) {
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(name, props, children)
}
jest.mock('react-native', () => ({
  Pressable: mockHost('Pressable'),
  ActivityIndicator: mockHost('ActivityIndicator'),
  useWindowDimensions: () => mockWindow,
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: mockHost('Box'),
  HStack: mockHost('HStack'),
}))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: mockHost('Text') }))
jest.mock('~common/ui/SectionCard', () => ({
  __esModule: true,
  default: mockHost('SectionCard'),
  SectionCardHeader: mockHost('SectionCardHeader'),
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: mockHost('Icon') }))
jest.mock('~common/ui/Switch', () => ({ __esModule: true, default: mockHost('Switch') }))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: { grey: 'grey' } }) }))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ bibleContent: { loadVerseTexts: mockLoad } }),
}))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => mockNavigate }))
jest.mock('~helpers/verseToReference', () => () => 'John 1:1-2')
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => mockQueryFor?.(queryKey) || mockQuery,
}))

let view: ReactTestRenderer
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mockNavigate.mockReset()
  mockRefetch.mockReset()
  mockQueryFor = undefined
  mockWindow = { width: 390, fontScale: 1 }
  mockQuery = {
    isPending: false,
    isError: false,
    data: [{ number: 1, text: 'Actual Bible resource text' }],
    refetch: mockRefetch,
  }
})
afterEach(() => {
  if (view) act(() => view.unmount())
})

it('opens a focused passage and its full chapter in the existing Bible reader', () => {
  act(() => {
    view = create(<AskVerseComparison passages={[passage]} />)
  })
  act(() => view.root.findByProps({ accessibilityLabel: 'assistant.widgets.open' }).props.onPress())
  expect(mockNavigate).toHaveBeenLastCalledWith({
    pathname: '/bible-view',
    params: {
      book: '43',
      chapter: '1',
      verse: '1',
      version: 'KJV',
      focusVerses: '[1,2]',
      contextDisplayMode: 'focused',
    },
  })
  act(() =>
    view.root.findByProps({ accessibilityLabel: 'askStudy.readContextFor' }).props.onPress()
  )
  expect(mockNavigate).toHaveBeenLastCalledWith({
    pathname: '/bible-view',
    params: {
      book: '43',
      chapter: '1',
      verse: '1',
      version: 'KJV',
      contextDisplayMode: 'fullChapter',
    },
  })
  expect(JSON.stringify(view.toJSON())).toContain('Actual Bible resource text')
})

it('compares passages side by side on iPhone, adapting for large accessibility text', () => {
  const passages = [passage, { ...passage, book: 1 }]
  act(() => {
    view = create(<AskVerseComparison passages={passages} />)
  })
  expect(
    view.root.findByProps({ testID: 'ask-verse-comparison-columns' }).props.className
  ).toContain('flex-row')
  mockWindow = { width: 1000, fontScale: 1 }
  act(() => view.update(<AskVerseComparison passages={passages} />))
  expect(
    view.root.findByProps({ testID: 'ask-verse-comparison-columns' }).props.className
  ).toContain('flex-row')
  mockWindow = { width: 1000, fontScale: 1.5 }
  act(() => view.update(<AskVerseComparison passages={passages} />))
  expect(
    view.root.findByProps({ testID: 'ask-verse-comparison-columns' }).props.className
  ).toContain('flex-col')
})

it('can highlight wording differences using Bible Strong’s comparison helper', () => {
  mockQueryFor = key => ({
    ...mockQuery,
    data: [
      {
        number: 1,
        text: key[2] === 43 ? 'In the beginning was the Word' : 'In the beginning God created',
      },
    ],
  })
  act(() => {
    view = create(<AskVerseComparison passages={[passage, { ...passage, book: 1 }]} />)
  })
  const control = view.root.findByType('Switch' as never)
  expect(control.props.value).toBe(false)
  act(() => control.props.onValueChange(true))
  expect(view.root.findByType('Switch' as never).props.value).toBe(true)
  const highlights = view.root
    .findAllByType('Text' as never)
    .filter(node => node.props.className === 'bg-opacity5 font-bold')
    .map(node => node.props.children)
  expect(highlights).toContain('Word')
  expect(highlights).toContain('God')
  expect(highlights).not.toContain('beginning')
})

it('shows retry when a Bible resource is unavailable, without inventing verse text', () => {
  mockQuery = { isPending: false, isError: true, refetch: mockRefetch }
  act(() => {
    view = create(<AskVerseComparison passages={[passage]} />)
  })
  expect(JSON.stringify(view.toJSON())).toContain('assistant.widgets.unavailable')
  const retry = view.root
    .findAllByType('Pressable' as never)
    .find(p => p.findAllByProps({ children: 'assistant.errors.retry' }).length)
  act(() => retry!.props.onPress())
  expect(mockRefetch).toHaveBeenCalledTimes(1)
})

it('reads exact ResourceAccess verses and rejects missing or cancelled results', async () => {
  mockLoad.mockResolvedValue({ '43-1-1': 'First verse', '43-1-2': 'Second verse' })
  const controller = new AbortController()
  const access = { loadVerseTexts: mockLoad }
  await expect(loadWidgetPassage(passage, access, controller.signal)).resolves.toEqual([
    { number: 1, text: 'First verse' },
    { number: 2, text: 'Second verse' },
  ])
  expect(mockLoad).toHaveBeenCalledWith(
    expect.objectContaining({ version: 'KJV', verseKeys: ['43-1-1', '43-1-2'] })
  )
  mockLoad.mockResolvedValue({ '43-1-1': 'First verse' })
  await expect(loadWidgetPassage(passage, access, controller.signal)).rejects.toThrow(
    'PASSAGE_UNAVAILABLE'
  )
  controller.abort()
  await expect(loadWidgetPassage(passage, access, controller.signal)).rejects.toThrow('CANCELLED')
})
