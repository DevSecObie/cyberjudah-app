import { CyberJudahAskError, LISTEN_PROVIDER, listenToQuestion } from '../cyberJudahAsk'

jest.mock('expo-modules-core', () => ({ uuid: { v4: () => 'test-id' } }))
const mockFetch = jest.fn()
jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }))
const mockUser = { getIdToken: async () => 'token' }
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => mockUser }))

const audio = new Uint8Array([1, 2, 3]).buffer

describe('Ask by voice', () => {
  beforeEach(() => mockFetch.mockReset())

  it('never sends a recording without the reader agreeing to the provider that hears it', async () => {
    await expect(listenToQuestion(audio, [], new AbortController().signal)).rejects.toMatchObject({
      code: 'CONSENT',
      provider: LISTEN_PROVIDER,
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends the recording with the reader’s agreement and returns what was heard', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Who was Enoch?' }),
    })
    const text = await listenToQuestion(audio, [LISTEN_PROVIDER], new AbortController().signal)
    expect(text).toBe('Who was Enoch?')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/app\/ask\/listen$/)
    expect(init.headers['X-AI-Consent']).toBe(LISTEN_PROVIDER)
    expect(init.headers.Authorization).toBe('Bearer token')
  })

  it('explains a daily limit', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'limit' }) })
    const error = await listenToQuestion(
      audio,
      [LISTEN_PROVIDER],
      new AbortController().signal
    ).catch(e => e)
    expect(error).toBeInstanceOf(CyberJudahAskError)
    expect(error.code).toBe('DAILY_LIMIT')
  })
})
