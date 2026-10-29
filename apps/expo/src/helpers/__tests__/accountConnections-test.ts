import {
  connectedProviders,
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

it('reads provider information without requesting tokens or contacting Telegram', () => {
  expect(connectedProviders('apple-reader')).toEqual([
    { id: 'apple.com', email: 'reader@privaterelay.appleid.com' },
  ])
  expect(mockGetIdToken).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('returns no providers for a signed-out account', () => {
  mockUser = null
  expect(connectedProviders('apple-reader')).toEqual([])
})

it('refreshes visible connection state when Firebase account information changes and stops after unsubscribe', () => {
  const listener = jest.fn(),
    unsubscribe = subscribeAccountConnections(listener)
  notifyAccountConnectionsChanged()
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
  notifyAccountConnectionsChanged()
  expect(listener).toHaveBeenCalledTimes(1)
})
