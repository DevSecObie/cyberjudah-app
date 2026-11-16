jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => null }))

import { getNoteRequest, requestNotes, takeReadyNotes } from '../noteRequests'

const user = { getIdToken: async () => 'token' } as never
const reply = (status: number, body: unknown) =>
  jest.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }))

describe('note requests', () => {
  it('reads how many asked, with the reader’s sign-in', async () => {
    const fetcher = reply(200, { ok: true, count: 3, mine: true, tell: false })
    expect(await getNoteRequest('AAAAAAAAAAA', fetcher as never, user)).toEqual({
      signedIn: true,
      count: 3,
      mine: true,
      tell: false,
    })
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/app\/requests\/AAAAAAAAAAA$/)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { authorization: 'Bearer token' } })
  })

  it('asks with the title and the wish to be told', async () => {
    const fetcher = reply(200, { ok: true, count: 1, mine: true, added: true, tell: true })
    const state = await requestNotes('AAAAAAAAAAA', 'The Nativity', true, fetcher as never, user)
    expect(state).toEqual({ signedIn: true, count: 1, mine: true, tell: true })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      title: 'The Nativity',
      tell: true,
    })
  })

  it('needs a sign-in, and says so when the server does not know the reader', async () => {
    const fetcher = reply(401, { error: 'sign_in_required' })
    expect(await getNoteRequest('AAAAAAAAAAA', fetcher as never, null)).toMatchObject({
      signedIn: false,
    })
    expect(fetcher).not.toHaveBeenCalled()
    expect(await getNoteRequest('AAAAAAAAAAA', fetcher as never, user)).toMatchObject({
      signedIn: false,
    })
  })

  it('refuses what is not a video id, and reports a server failure', async () => {
    await expect(getNoteRequest('../admin', reply(200, {}) as never, user)).rejects.toThrow(
      'BAD_VIDEO'
    )
    await expect(
      requestNotes('AAAAAAAAAAA', 'x', false, reply(503, {}) as never, user)
    ).rejects.toThrow('503')
  })

  it('takes the notes that came out, keeping only well-formed ones', async () => {
    const fetcher = reply(200, {
      ok: true,
      ready: [
        { video: 'AAAAAAAAAAA', title: 'The Nativity', teacher: 'Deacon Eythan' },
        { video: 'bad', title: 'x' },
      ],
    })
    expect(await takeReadyNotes(fetcher as never, user)).toEqual([
      { video: 'AAAAAAAAAAA', title: 'The Nativity', teacher: 'Deacon Eythan' },
    ])
    expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/app\/requests\/ready$/)
    expect(await takeReadyNotes(fetcher as never, null)).toEqual([])
  })
})
