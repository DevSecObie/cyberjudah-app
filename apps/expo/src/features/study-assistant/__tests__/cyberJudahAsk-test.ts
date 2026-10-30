jest.mock('expo-modules-core', () => ({
  uuid: { v4: () => '9b3dc198-81d0-46a4-a019-e5985901661b' },
}))
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: jest.fn() }))

import { fetch as expoFetch } from 'expo/fetch'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import {
  askCyberJudah,
  CyberJudahAskError,
  errorOf,
  sourceLink,
  timestamp,
  secureAskEndpoint,
} from '../cyberJudahAsk'

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

beforeEach(() => {
  ;(getCurrentAuthUser as jest.Mock).mockReturnValue({ getIdToken: async () => 'id-token' })
})

it('sends the question, history and agreed providers with the Firebase token to the free Ask', async () => {
  ;(expoFetch as jest.Mock).mockResolvedValue(
    reply(200, {
      ok: true,
      answer: 'Judah is the lawgiver [1].',
      sources: [
        {
          n: 1,
          kind: 'class',
          title: 'Genesis 49',
          url: '/classes/gen-49',
          video: 'abcdefghijk',
          t: 75.6,
          date: '2024-01-06',
        },
        { n: 2, title: 'no url' },
      ],
    })
  )
  const result = await askCyberJudah(
    { question: 'Who is Judah?', history: [], consent: ['Cloudflare (Workers AI)'] },
    new AbortController().signal
  )
  const [url, init] = (expoFetch as jest.Mock).mock.calls[0]
  expect(url).toMatch(/\/api\/app\/ask$/)
  expect(init.headers.Authorization).toBe('Bearer id-token')
  expect(init.headers['X-Trace-ID']).toBe('9b3dc198-81d0-46a4-a019-e5985901661b')
  expect(result.traceId).toBe(init.headers['X-Trace-ID'])
  expect(JSON.parse(init.body)).toEqual({
    q: 'Who is Judah?',
    history: [],
    consent: ['Cloudflare (Workers AI)'],
    ui: 'study-v1',
  })
  expect(result.answer).toBe('Judah is the lawgiver [1].')
  expect(result.sources).toHaveLength(1)
  expect(result.sources[0].t).toBe(75)
})

it('asks for sign-in before calling the server', async () => {
  ;(getCurrentAuthUser as jest.Mock).mockReturnValue(null)
  ;(expoFetch as jest.Mock).mockClear()
  await expect(
    askCyberJudah(
      { question: 'Who is Judah?', history: [], consent: [] },
      new AbortController().signal
    )
  ).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' })
  expect(expoFetch).not.toHaveBeenCalled()
})

it('names each refusal so the screen can explain it', () => {
  expect(errorOf(401, null).code).toBe('SIGN_IN_REQUIRED')
  const consent = errorOf(428, { error: 'consent', provider: 'Cloudflare (Workers AI)' })
  expect(consent).toBeInstanceOf(CyberJudahAskError)
  expect([consent.code, consent.provider]).toEqual(['CONSENT', 'Cloudflare (Workers AI)'])
  expect(errorOf(429, { error: 'limit' }).code).toBe('DAILY_LIMIT')
  expect(errorOf(429, { error: 'free-paused' }).code).toBe('PAUSED')
  expect(errorOf(400, { error: 'too-short' }).code).toBe('TOO_SHORT')
  expect(errorOf(503, { error: 'unavailable' }).code).toBe('AI_UNAVAILABLE')
})

it('opens a class at its moment, and a page on cyberjudah.io', () => {
  expect(
    sourceLink({ n: 1, kind: 'class', title: 'x', url: '/classes/a', video: 'abcdefghijk', t: 90 })
  ).toBe('https://www.youtube.com/watch?v=abcdefghijk&t=90s')
  expect(sourceLink({ n: 1, kind: 'note', title: 'x', url: '/classes/a' })).toBe(
    'https://cyberjudah.io/classes/a'
  )
  expect(sourceLink({ n: 1, kind: 'note', title: 'x', url: '//evil.test/a' })).toBeUndefined()
  expect(sourceLink({ n: 1, kind: 'note', title: 'x', url: 'javascript:alert(1)' })).toBeUndefined()
  expect(timestamp(75)).toBe('1:15')
  expect(timestamp(3725)).toBe('1:02:05')
})

it('does not send a previous account conversation after sign-in changes', async () => {
  ;(getCurrentAuthUser as jest.Mock).mockReturnValue({
    uid: 'bob',
    getIdToken: async () => 'bob-token',
  })
  ;(expoFetch as jest.Mock).mockClear()
  await expect(
    askCyberJudah(
      { question: 'Private question', history: [], consent: [], account: 'alice' },
      new AbortController().signal
    )
  ).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' })
  expect(expoFetch).not.toHaveBeenCalled()
})

it('identifies a free-budget pause inside a successful HTTP stream', () => {
  expect(errorOf(503, { error: 'free-paused' }).code).toBe('PAUSED')
})

function streamingReply(events: unknown[]) {
  const encoded = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n'))
  let offset = 0
  const reader = {
    // One byte at a time exercises split JSON lines and split UTF-8 characters.
    read: async () =>
      offset < encoded.length
        ? { value: encoded.slice(offset, ++offset), done: false }
        : { value: undefined, done: true },
    cancel: jest.fn(async () => {}),
    releaseLock: jest.fn(),
  }
  return {
    response: {
      ok: true,
      status: 200,
      headers: { get: () => 'application/x-ndjson' },
      body: { getReader: () => reader },
    },
    reader,
  }
}

it('retains real search steps, Unicode answer text and source artwork across fragmented streams', async () => {
  const { response, reader } = streamingReply([
    { status: 'Searching: "Pâque"' },
    { delta: 'La Pâque [1].' },
    {
      done: true,
      answer: 'La Pâque [1].',
      sources: [
        {
          n: 1,
          title: 'Passover',
          kind: 'class',
          url: '/classes/passover',
          video: 'abcdefghijk',
          t: 72,
          thumb: '/img/classes/abcdefghijk.jpg',
        },
      ],
    },
  ])
  ;(expoFetch as jest.Mock).mockResolvedValue(response)
  const event = jest.fn()
  const result = await askCyberJudah(
    { question: 'What is Passover?', history: [], consent: [] },
    new AbortController().signal,
    event
  )
  expect(event.mock.calls).toEqual([
    [{ status: 'Searching: "Pâque"' }],
    [{ delta: 'La Pâque [1].' }],
  ])
  expect(result.answer).toBe('La Pâque [1].')
  expect(result.sources[0].thumb).toBe('https://cyberjudah.io/img/classes/abcdefghijk.jpg')
  expect(sourceLink(result.sources[0])).toBe('https://www.youtube.com/watch?v=abcdefghijk&t=72s')
  expect(reader.cancel).toHaveBeenCalled()
  expect(reader.releaseLock).toHaveBeenCalled()
})

it('does not present an interrupted stream as a completed answer', async () => {
  const { response } = streamingReply([{ delta: 'Partial answer' }])
  ;(expoFetch as jest.Mock).mockResolvedValue(response)
  await expect(
    askCyberJudah(
      { question: 'Who is Judah?', history: [], consent: [] },
      new AbortController().signal,
      jest.fn()
    )
  ).rejects.toThrow('INCOMPLETE_STREAM')
})

it('rejects insecure or credential-bearing Ask origins before transmission', () => {
  for (const base of [
    'http://example.test',
    'https://user:password@example.test',
    'https://example.test/?secret=x',
    'https://example.test/elsewhere',
  ])
    expect(() => secureAskEndpoint(base, '/api/app/ask')).toThrow()
  expect(secureAskEndpoint('https://example.test', '/api/app/ask')).toBe(
    'https://example.test/api/app/ask'
  )
})
