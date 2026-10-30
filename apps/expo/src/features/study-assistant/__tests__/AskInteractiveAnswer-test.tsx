import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import AskInteractiveAnswer, { isInteractiveStudySafe } from '../AskInteractiveAnswer'
import type { ChatTurn } from '../cyberJudahConversations'

function mockHost(name: string) {
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(name, props, children)
}
const mockOpen = jest.fn(),
  mockPush = jest.fn()
jest.mock('../cyberJudahAsk', () => ({
  sourceLink: (s: { url: string }) => `https://cyberjudah.io${s.url}`,
}))
jest.mock('../useOpenStudySource', () => ({ useOpenStudySource: () => mockOpen }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('react-native', () => ({ Pressable: mockHost('Pressable') }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (s: string) => s, i18n: { language: 'en' } }),
}))
jest.mock('~i18n', () => ({ getLanguage: () => 'en', default: { t: (s: string) => s } }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: mockHost('Box') }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: mockHost('Text') }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: mockHost('Icon') }))
jest.mock('../AssistantMarkdown', () => ({ __esModule: true, default: mockHost('Markdown') }))
jest.mock('../AskSourceCards', () => ({ __esModule: true, default: mockHost('Sources') }))
jest.mock('../AskStudyCards', () => ({ __esModule: true, default: mockHost('Legacy') }))
jest.mock('../AskVerseComparison', () => ({ __esModule: true, default: mockHost('Scriptures') }))

const turn: ChatTurn = {
  id: 'a',
  question: 'Who was Abraham?',
  answer: 'The lesson [1].',
  sources: [
    { n: 1, title: 'Recorded lesson', kind: 'spoken', evidence: 'teaching', url: '/classes/a' },
    {
      n: 2,
      title: 'Abraham',
      kind: 'people',
      evidence: 'reference',
      url: '/person/abraham-gen-11-26',
    },
  ],
  state: 'complete',
  createdAt: 1,
  teachingFound: true,
  ui: 'root = StudyAnswer([Teaching("The lesson [1].", [1]), Sources([1, 2]), RelatedScriptures(["Genesis 12:1"]), Explore("encyclopedia"), FollowUp("What was taught about Abraham?")])',
}
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  mockOpen.mockClear()
  mockPush.mockClear()
})

it('validates the actual OpenUI program and rejects references promoted to teaching or unknown actions', () => {
  expect(isInteractiveStudySafe(turn.ui!, turn.sources)).toBe(true)
  for (const ui of [
    'root = StudyAnswer([Teaching("invented", [2])])',
    'root = StudyAnswer([Sources([24])])',
    '$state = true\nroot = StudyAnswer([])',
    'root = StudyAnswer([Explore("billing")])',
    'root = StudyAnswer([FollowUp(@OpenUrl("https://evil.test"))])',
  ])
    expect(isInteractiveStudySafe(ui, turn.sources)).toBe(false)
})
it('opens real sources and existing app screens; related scriptures are not a translation comparison', async () => {
  const ask = jest.fn()
  let tree!: ReactTestRenderer
  await act(async () => {
    tree = create(<AskInteractiveAnswer turn={turn} streaming={false} onAsk={ask} />)
  })
  const sources = tree.root.findAll(n => n.type === ('Sources' as never))[0]
  await act(async () => sources.props.onOpenSource(turn.sources[1]))
  expect(mockOpen).toHaveBeenCalledWith(turn.sources[1])
  const scriptures = tree.root.findAll(n => n.type === ('Scriptures' as never))[0]
  expect(scriptures.props.compareWords).toBe(false)
  expect(scriptures.props.passages[0]).toMatchObject({ version: 'KJV', book: 1, chapter: 12 })
  const buttons = tree.root.findAll(
    n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function'
  )
  await act(async () => buttons[0].props.onPress())
  expect(mockPush).toHaveBeenCalledWith('/(library)/encyclopedia')
  await act(async () => buttons.at(-1)!.props.onPress())
  expect(ask).toHaveBeenCalledWith('What was taught about Abraham?')
  await act(async () => tree.unmount())
})
it('keeps the existing answer available when a saved program is invalid', async () => {
  let tree!: ReactTestRenderer
  await act(async () => {
    tree = create(<AskInteractiveAnswer turn={{ ...turn, ui: 'bad' }} streaming={false} />)
  })
  expect(tree.root.findAll(n => n.type === ('Legacy' as never))).toHaveLength(1)
  expect(tree.root.findAll(n => n.type === ('Markdown' as never))[0].props.text).toContain(
    'The lesson'
  )
  await act(async () => tree.unmount())
})
