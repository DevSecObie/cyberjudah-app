import { citedPrecepts, sourceKindLabel } from '../askStudyKinds'

jest.mock('expo-modules-core', () => ({ uuid: { v4: () => 'test-id' } }))
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: jest.fn() }))

const source = (n: number, url: string, kind = 'precept') => ({ n, kind, title: `T${n}`, url })

describe('study cards in Ask', () => {
  it('finds each cited precept once, in citation order, at most three', () => {
    const got = citedPrecepts([
      source(1, '/classes/2020/x', 'class'),
      source(2, '/precepts/abomination'),
      source(3, 'https://cyberjudah.io/precepts/sabbath'),
      source(4, '/precepts/abomination'),
      source(5, '/precepts/feasts'),
      source(6, '/precepts/law'),
    ])
    expect(got.map(p => p.slug)).toEqual(['abomination', 'sabbath', 'feasts'])
    expect(got[0].n).toBe(2)
  })
  it('never takes a precept from another site', () => {
    expect(citedPrecepts([source(1, 'https://example.com/precepts/x')])).toEqual([])
  })
  it('names each kind of card in the library’s words', () => {
    expect(sourceKindLabel('case')).toBe('Case study')
    expect(sourceKindLabel('law')).toBe('Law')
    expect(sourceKindLabel('encyclopedia')).toBe('Encyclopedia')
    expect(sourceKindLabel('other')).toBe('other')
  })
})
