jest.mock('expo/virtual/env', () => ({ env: process.env }))
const mockAuth: { currentUser: any; authStateReady: jest.Mock } = {
  currentUser: null,
  authStateReady: jest.fn(async () => undefined),
}
const mockSignIn = jest.fn(async (..._args: unknown[]) => ({ user: { uid: 'linked' } }))
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('firebase/auth', () => ({
  getAuth: () => mockAuth,
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  reauthenticateWithPopup: jest.fn(),
  signInWithCustomToken: (...args: any[]) => mockSignIn(...args),
}))
jest.mock('../firebaseApp.web', () => ({ firebaseApp: {} }))
jest.mock('../toast', () => ({ toast: mockToast }))
const response = (body: unknown, ok = true) => ({ ok, json: async () => body })
let mockStore: Map<string, string>
beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  mockStore = new Map()
  mockAuth.currentUser = null
  Object.defineProperty(global, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => mockStore.get(k) ?? null,
      setItem: (k: string, v: string) => mockStore.set(k, v),
      removeItem: (k: string) => mockStore.delete(k),
    },
  })
  Object.defineProperty(global, 'window', {
    configurable: true,
    value: { location: { search: '' }, history: { replaceState: jest.fn() } },
  })
  global.fetch = jest.fn()
})
it('restores a verified Telegram session only when Firebase has no account', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(response({ user: { id: 1 } }) as never)
    .mockResolvedValueOnce(response({ token: 'server-token' }) as never)
  const { restoreCyberJudahSession } = await import('../cyberJudahAccount.web')
  await restoreCyberJudahSession()
  expect(mockSignIn).toHaveBeenCalledWith(mockAuth, 'server-token')
  expect(fetch).toHaveBeenCalledWith(
    '/api/firebase/token',
    expect.objectContaining({ method: 'POST', credentials: 'same-origin' })
  )
})
it('does not replace an existing Firebase account or automatically link it', async () => {
  mockAuth.currentUser = { uid: 'google' }
  const { restoreCyberJudahSession } = await import('../cyberJudahAccount.web')
  await restoreCyberJudahSession()
  expect(fetch).not.toHaveBeenCalled()
})
it('ignores a late Telegram token after the user signs out', async () => {
  let release!: (value: unknown) => void
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(response({ user: { id: 1 } }) as never)
    .mockImplementationOnce(
      () =>
        new Promise(r => {
          release = r as never
        })
    )
    .mockResolvedValueOnce(response({ ok: true }) as never)
  const { restoreCyberJudahSession, endCyberJudahSession } =
    await import('../cyberJudahAccount.web')
  const restoring = restoreCyberJudahSession()
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve()
  expect(release).toBeDefined()
  await endCyberJudahSession()
  release(response({ token: 'late-token' }))
  await restoring
  expect(mockSignIn).not.toHaveBeenCalled()
})
it('rejects a returned link with a missing timestamp', async () => {
  mockStore.set('cyberjudah:link-telegram', JSON.stringify({ uid: 'google' }))
  window.location.search = '?telegram=returned'
  const { restoreCyberJudahSession } = await import('../cyberJudahAccount.web')
  await restoreCyberJudahSession()
  expect(fetch).not.toHaveBeenCalled()
})
it('keeps the restore disabled when the Telegram logout request fails', async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
  const { restoreCyberJudahSession, endCyberJudahSession } =
    await import('../cyberJudahAccount.web')
  await expect(endCyberJudahSession()).rejects.toThrow('offline')
  await restoreCyberJudahSession()
  expect(mockSignIn).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
})
