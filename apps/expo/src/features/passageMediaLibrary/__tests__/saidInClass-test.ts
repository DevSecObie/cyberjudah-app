jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => null }))

import { formatMoment, searchSaidInClass } from '../saidInClass'

const user = { getIdToken: async () => 'token' } as never

describe('searchSaidInClass', () => {
  it('asks a signed-in reader’s search of the server, and cleans each passage', async () => {
    const fetcher = jest.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        more: true,
        hits: [
          {
            title: 'A class',
            feed: 'classes',
            date: '2026-01-01',
            video: 'AAAAAAAAAAA',
            start: 300.6,
            note: '/classes/a',
            excerpt: '… the slave  ships …',
          },
          { title: 'Bad', video: 'x', start: 1, excerpt: '' },
        ],
      }),
    }))
    const result = await searchSaidInClass('slave ships', 2, fetcher as never, user)
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/app\/teachings\?q=slave\+ships&page=2$/)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { authorization: 'Bearer token' } })
    expect(result).toEqual({
      signedIn: true,
      more: true,
      hits: [expect.objectContaining({ start: 300, excerpt: '… the slave ships …' })],
    })
  })

  it('says when the reader must sign in, without asking the server', async () => {
    const fetcher = jest.fn()
    expect(await searchSaidInClass('slave ships', 0, fetcher as never, null)).toEqual({
      signedIn: false,
      hits: [],
      more: false,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

it('writes a moment as the classes do', () => {
  expect(formatMoment(245)).toBe('4:05')
  expect(formatMoment(3845)).toBe('1:04:05')
})
