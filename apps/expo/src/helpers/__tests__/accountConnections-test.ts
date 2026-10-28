import {
  connectedProviders,
  loadAccountConnections,
  notifyAccountConnectionsChanged,
  subscribeAccountConnections,
} from '../accountConnections'
jest.mock('expo/virtual/env', () => ({ env: process.env }))

const mockGetIdToken = jest.fn(async () => 'test-id-token')
let mockUser: {
  uid: string
  email: string
  providerData: { providerId: string; email?: string }[]
  getIdToken: typeof mockGetIdToken
} | null
jest.mock('../firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => mockUser }))
const response = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response
beforeEach(() => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL =
    'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
  mockGetIdToken.mockReset().mockResolvedValue('test-id-token')
  mockUser = {
    uid: 'apple-reader',
    email: 'account@example.test',
    getIdToken: mockGetIdToken,
    providerData: [{ providerId: 'apple.com', email: 'reader@privaterelay.appleid.com' }],
  }
  global.fetch = jest.fn()
})

it('lists only verified providers on the requested Firebase account', () => {
  mockUser!.providerData.push(
    { providerId: 'google.com', email: 'google@example.test' },
    { providerId: 'password' },
    { providerId: 'unknown' }
  )
  expect(connectedProviders('apple-reader')).toEqual([
    { id: 'apple.com', email: 'reader@privaterelay.appleid.com' },
    { id: 'google.com', email: 'google@example.test' },
    { id: 'password', email: 'account@example.test' },
  ])
  expect(connectedProviders('other-reader')).toEqual([])
})

it('uses the Firebase bearer identity, and accepts a Telegram name only for the same linked ID', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(response({ user: { id: 42 } }))
    .mockResolvedValueOnce(response({ user: { id: 42, username: 'reader' } }))
  expect((await loadAccountConnections('apple-reader'))?.telegram).toEqual({
    status: 'connected',
    label: '@reader',
  })
  expect(fetch).toHaveBeenNthCalledWith(
    1,
    expect.stringMatching(/\/api\/me$/),
    expect.objectContaining({
      credentials: 'omit',
      cache: 'no-store',
      headers: { authorization: 'Bearer test-id-token' },
    })
  )
})

it('does not display a different Telegram browser session as the linked account', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(response({ user: { id: 42 } }))
    .mockResolvedValueOnce(response({ user: { id: 99, username: 'someone-else' } }))
  expect((await loadAccountConnections('apple-reader'))?.telegram).toEqual({ status: 'connected' })
})

it('reports unlinked only when the verified endpoint explicitly requires a link', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ error: 'telegram_link_required' }, 401))
  expect((await loadAccountConnections('apple-reader'))?.telegram.status).toBe('not-connected')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([401, 429, 503])(
  'does not misreport an authentication or access failure (%s) as unlinked',
  async status => {
    jest.mocked(fetch).mockResolvedValueOnce(response({ error: 'unavailable' }, status))
    expect((await loadAccountConnections('apple-reader'))?.telegram.status).toBe('unavailable')
  }
)

it('keeps a verified connection when the friendly-name lookup is offline', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(response({ user: { id: 42 } }))
    .mockRejectedValueOnce(new Error('offline'))
  expect((await loadAccountConnections('apple-reader'))?.telegram).toEqual({ status: 'connected' })
})

it('does not request another account after a switch during token retrieval', async () => {
  mockGetIdToken.mockImplementationOnce(async () => {
    mockUser = null
    return 'old-token'
  })
  expect(await loadAccountConnections('apple-reader')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('discards a connection response that arrives after logout', async () => {
  jest.mocked(fetch).mockImplementationOnce(async () => {
    mockUser = null
    return response({ user: { id: 42 } })
  })
  expect(await loadAccountConnections('apple-reader')).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('starts no request for an aborted profile or a different account', async () => {
  const controller = new AbortController()
  controller.abort()
  expect(await loadAccountConnections('apple-reader', controller.signal)).toBeNull()
  expect(await loadAccountConnections('different-reader')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('refreshes visible connection state when linking completes and stops after unsubscribe', () => {
  const listener = jest.fn(),
    unsubscribe = subscribeAccountConnections(listener)
  notifyAccountConnectionsChanged()
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
  notifyAccountConnectionsChanged()
  expect(listener).toHaveBeenCalledTimes(1)
})
