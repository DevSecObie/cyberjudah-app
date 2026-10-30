import { glossarySections, loadDoctrines, loadTopics, verseText } from '../classTeaching'

const respond = (body: unknown) =>
  (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch

describe('class teaching sections', () => {
  it('lists the topics Telegram lists: with notes or cases, no verdict groups', async () => {
    const topics = await loadTopics(
      respond([
        { slug: 'adversity', label: 'Adversity', notes: 3, cases: 0, url: '/topics/adversity' },
        { slug: 'empty', label: 'Empty', notes: 0, cases: 0, url: '/topics/empty' },
        {
          slug: 'verdict-guilty',
          label: 'Guilty',
          notes: 2,
          cases: 4,
          url: '/topics/verdict-guilty',
        },
        { slug: '../x', label: 'Bad', notes: 1, cases: 0, url: '/x' },
      ])
    )
    expect(topics.map(t => t.slug)).toEqual(['adversity'])
  })

  it('sorts the false doctrines A to Z', async () => {
    const rows = await loadDoctrines(
      respond([
        { slug: 'trinity', name: 'The Trinity', claim: '' },
        { slug: 'rapture', name: 'Rapture', claim: '' },
      ])
    )
    expect(rows.map(r => r.slug)).toEqual(['rapture', 'trinity'])
  })

  it('groups the glossary by letter and searches terms, aliases and definitions', () => {
    const entry = (term: string, aliases: string[] = [], definition = '') => ({
      term,
      slug: term.toLowerCase(),
      aliases,
      definition,
      scripture: [],
      see: [],
      taught: [],
    })
    const entries = [entry('Edom'), entry('Amalek', ['Amalekites']), entry('Esau', [], 'Edom')]
    expect(glossarySections(entries).map(s => [s.title, s.data.map(e => e.term)])).toEqual([
      ['A', ['Amalek']],
      ['E', ['Edom', 'Esau']],
    ])
    expect(
      glossarySections(entries, 'amalekites')
        .flatMap(s => s.data)
        .map(e => e.term)
    ).toEqual(['Amalek'])
    expect(
      glossarySections(entries, 'edom')
        .flatMap(s => s.data)
        .map(e => e.term)
    ).toEqual(['Edom', 'Esau'])
  })

  it('joins a scripture’s verses', () => {
    expect(
      verseText({
        text: [
          { verse: 1, text: 'In the beginning' },
          { verse: 2, text: 'And' },
        ],
      })
    ).toBe('In the beginning And')
  })
})
