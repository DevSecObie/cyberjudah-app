import { classesForHits, searchInsideClasses, searchKindsFor } from '../classSearch'
import type { CyberJudahClass } from '../cyberJudahClasses'

const respond = (hits: object[]) =>
  ({ ok: true, json: async () => ({ ok: true, hits }) }) as unknown as Response

describe('class search', () => {
  it('searches the chosen collection, or all three', () => {
    expect(searchKindsFor()).toEqual(['class', 'captains', 'history'])
    expect(searchKindsFor('15 Min w/ Captains')).toEqual(['captains'])
    expect(searchKindsFor('Our Hidden History')).toEqual(['history'])
    expect(searchKindsFor('Sabbath classes')).toEqual(['class'])
  })

  it('waits for three letters', async () => {
    const fetcher = jest.fn()
    expect(await searchInsideClasses('sh', undefined, fetcher)).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('asks the site for each kind and takes turns between them', async () => {
    const fetcher = jest.fn(async (url: string) =>
      url.includes('only=class')
        ? respond([
            { kind: 'class', url: '/classes/a', snippet: '…ships…' },
            { kind: 'class', url: '/classes/b', snippet: 'b' },
          ])
        : url.includes('only=captains')
          ? respond([{ kind: 'captains', url: '/captains/c', snippet: 'c' }])
          : respond([{ kind: 'study', url: '/study/x', snippet: 'not a class' }])
    )
    const hits = await searchInsideClasses('slave ships', undefined, fetcher as never)
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://cyberjudah.io/search.json?q=slave%20ships&only=class&limit=20'
    )
    expect(hits.map(hit => hit.notesPath)).toEqual(['/classes/a', '/captains/c', '/classes/b'])
  })

  it('reports a search the site cannot answer', async () => {
    const fetcher = jest.fn(async () => ({ ok: false, status: 503 }) as Response)
    await expect(searchInsideClasses('ships', ['class'], fetcher)).rejects.toThrow(
      'CYBERJUDAH_CLASS_SEARCH_UNAVAILABLE:503'
    )
  })

  it('lists each hit as its class, once, after the ones already shown', () => {
    const classes = [
      { notesPath: '/classes/a', title: 'A' },
      { notesPath: '/classes/b', title: 'B' },
    ] as CyberJudahClass[]
    const rows = classesForHits(
      [
        { notesPath: '/classes/b', snippet: 'one' },
        { notesPath: '/classes/b', snippet: 'two' },
        { notesPath: '/classes/a', snippet: 'three' },
        { notesPath: '/classes/gone', snippet: 'four' },
      ],
      classes,
      new Set(['/classes/a'])
    )
    expect(rows).toEqual([{ notesPath: '/classes/b', title: 'B', snippet: 'one' }])
  })
})
