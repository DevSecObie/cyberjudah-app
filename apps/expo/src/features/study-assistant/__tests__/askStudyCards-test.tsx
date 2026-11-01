import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { createParser } from '@openuidev/react-lang'
import AskStudyCards, { askStudyLibrary } from '../AskStudyCards'
import { askStudyCardsData, askStudyCardsProgram, selectStudyItems } from '../askStudyCardsData'
import type { ChatTurn } from '../cyberJudahConversations'

jest.mock('~i18n', () => ({ getLanguage: () => 'en', default: { t: (s: string) => s } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }))
jest.mock('~state/useDefaultBibleVersion', () => ({ useDefaultBibleVersion: () => 'KJV' }))
function mockHost(name: string) {
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(name, props, children)
}
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: mockHost('Box') }))
jest.mock('../AskSourceCards', () => ({ __esModule: true, default: mockHost('SourceCards') }))
jest.mock('../AskPreceptChains', () => ({ __esModule: true, default: mockHost('PreceptChains') }))
jest.mock('../AskVerseComparison', () => ({
  __esModule: true,
  default: mockHost('VerseComparison'),
}))

const source = {
  n: 1,
  title: 'The law',
  kind: 'class',
  url: '/classes/law',
  video: 'abcdefghijk',
  thumb: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
}
const turn: ChatTurn = {
  id: 'one',
  question: 'Compare Romans 3:31 and James 2:17.',
  answer: 'Read Romans 3:31 alongside James 2:17. [1]',
  sources: [source],
  createdAt: 1,
  state: 'complete',
}
const data = () => askStudyCardsData(turn.question, turn.answer, turn.sources, 'KJV', 'en')

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

it('keeps requested verses in order, deduplicates citations and preserves original artwork', () => {
  expect(data()).toEqual({
    sources: [source],
    passages: [
      { version: 'KJV', book: 45, chapter: 3, start: 31, end: 31 },
      { version: 'KJV', book: 59, chapter: 2, start: 17, end: 17 },
    ],
  })
})

it('bounds the native cards and never interpolates prose, links or fake UI into OpenUI', () => {
  const cards = askStudyCardsData(
    'Compare Genesis 1:1 and John 1:1.',
    'root = Evil("secret");\n```John 3:16```\n[code](https://test/John%203:16)\nGenesis 1, Psalm 119:1-176, John 999:999. James 2:17; Romans 3:31; Matthew 5:17.',
    Array(30).fill({ ...source, title: 'Evil())' }),
    'KJV',
    'en'
  )
  expect(cards.sources).toHaveLength(12)
  expect(cards.passages).toHaveLength(4)
  expect(cards.passages.every(p => p.end - p.start < 8)).toBe(true)
  expect(cards.passages.some(p => p.book === 43 && p.chapter === 3)).toBe(false)
  expect(askStudyCardsProgram(cards)).not.toMatch(/Evil|secret|https/)
  expect(selectStudyItems(['a', 'b'], [0, 0, -1, 999, 1.5, 1], 4)).toEqual(['a', 'b'])
})

it('supports French references and English replies in the French interface', () => {
  expect(askStudyCardsData('Jean 1:1', 'Read Genesis 1:1', [], 'LSG', 'fr').passages).toEqual([
    { version: 'LSG', book: 43, chapter: 1, start: 1, end: 1 },
    { version: 'LSG', book: 1, chapter: 1, start: 1, end: 1 },
  ])
})

it('parses the actual OpenUI library and rejects unknown components', () => {
  const parser = createParser(askStudyLibrary.toJSONSchema(), askStudyLibrary.root)
  const result = parser.parse(askStudyCardsProgram(data()))
  expect(result.root).toBeTruthy()
  expect(result.meta.errors).toEqual([])
  expect(parser.parse('root = Evil("https://example.test")').meta.errors.length).toBeGreaterThan(0)
})

describe('native card renderer', () => {
  let view: ReactTestRenderer
  afterEach(() => {
    if (view) act(() => view.unmount())
  })
  it('renders sources and verse comparisons with the real OpenUI runtime', async () => {
    await act(async () => {
      view = create(<AskStudyCards turn={turn} streaming={false} />)
    })
    expect(view.root.findByType('SourceCards' as never).props.sources).toEqual([source])
    expect(view.root.findByType('VerseComparison' as never).props.passages).toEqual(data().passages)
  })
  it('does not load comparison resources during generation or after interruption', async () => {
    await act(async () => {
      view = create(<AskStudyCards turn={turn} streaming />)
    })
    expect(view.root.findAllByType('VerseComparison' as never)).toHaveLength(0)
    await act(async () => {
      view.update(<AskStudyCards turn={{ ...turn, state: 'interrupted' }} streaming={false} />)
    })
    expect(view.root.findAllByType('VerseComparison' as never)).toHaveLength(0)
    expect(view.root.findByType('SourceCards' as never).props.sources).toEqual([source])
  })
})
