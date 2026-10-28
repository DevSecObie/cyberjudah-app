let mockAuthStateListener: ((user: unknown) => Promise<void>) | undefined

const mockRunAllCleanups = jest.fn()
const mockTokenReset = jest.fn()
const mockSetSentryUser = jest.fn()

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  getAdditionalUserInfo: jest.fn(),
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((_auth, listener) => {
    mockAuthStateListener = listener
  }),
  reauthenticateWithCredential: jest.fn(),
  reload: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithCustomToken: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
}))

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  getCurrentScope: () => ({ setUser: mockSetSentryUser }),
}))

jest.mock('~helpers/firebase', () => ({
  doc: jest.fn(),
  firebaseDb: {},
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(),
}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

jest.mock('../agentObservability', () => ({
  appLogger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}))

jest.mock('../cleanupRegistry', () => ({ runAllCleanups: mockRunAllCleanups }))
jest.mock('../firebaseApp.web', () => ({ firebaseApp: {} }))
jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
  },
}))
jest.mock('../toast', () => ({ toast: Object.assign(jest.fn(), { success: jest.fn() }) }))
jest.mock('../TokenManager', () => ({ tokenManager: { reset: mockTokenReset } }))

describe('WebFireAuth auth-state cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthStateListener = undefined
  })

  it('clears account state once when an authenticated browser session becomes null', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebFireAuth } = require('../FireAuth.web') as typeof import('../FireAuth.web')
    const fireAuth = new WebFireAuth()
    const onLogin = jest.fn()
    const onLogout = jest.fn()

    await fireAuth.init(onLogin, jest.fn(), onLogout, jest.fn(), jest.fn(), {} as never)

    const listener = mockAuthStateListener
    expect(listener).toBeDefined()
    await listener?.({
      uid: 'user-1',
      email: 'reader@example.test',
      emailVerified: true,
      displayName: 'Reader',
      photoURL: null,
      metadata: { creationTime: 'today' },
      providerData: [{ providerId: 'password', displayName: 'Reader', photoURL: null }],
    })

    expect(onLogin).toHaveBeenCalledTimes(1)
    await listener?.(null)
    await listener?.(null)

    expect(mockRunAllCleanups).toHaveBeenCalledTimes(1)
    expect(mockTokenReset).toHaveBeenCalledTimes(1)
    expect(mockSetSentryUser).toHaveBeenLastCalledWith(null)
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(fireAuth.user).toBeNull()
    expect(fireAuth.profile).toBeNull()
  })
})

jest.mock('../cyberJudahAccount', () => ({
  restoreCyberJudahSession: jest.fn(async () => undefined),
  endCyberJudahSession: jest.fn(async () => undefined),
}))

describe('WebFireAuth account-switch races', () => {
  const reader = (uid: string) => ({
    uid,
    email: `${uid}@example.test`,
    emailVerified: true,
    displayName: uid,
    photoURL: null,
    metadata: {},
    providerData: [{ providerId: 'password' }],
  })

  it('discards a profile read that finishes after sign-out', async () => {
    const { WebFireAuth } = await import('../FireAuth.web')
    const { getDoc } = await import('~helpers/firebase')
    let finish!: (value: unknown) => void
    jest.mocked(getDoc).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve as typeof finish
        }) as never
    )
    const auth = new WebFireAuth(),
      onLogin = jest.fn()
    await auth.init(onLogin, jest.fn(), jest.fn(), jest.fn(), jest.fn(), {} as never)
    const pending = mockAuthStateListener!(reader('old'))
    // Account-entry classification crosses a promise boundary before the document read.
    for (let i = 0; i < 10 && !finish; i++) await Promise.resolve()
    expect(finish).toBeDefined()
    await mockAuthStateListener!(null)
    finish({ exists: () => false })
    await pending
    expect(onLogin).not.toHaveBeenCalled()
    expect(auth.user).toBeNull()
  })

  it('cleans up the previous account before starting another account', async () => {
    const { WebFireAuth } = await import('../FireAuth.web')
    const order: string[] = []
    const auth = new WebFireAuth()
    await auth.init(
      ({ profile }) => order.push(profile.id),
      jest.fn(),
      () => {
        order.push('cleanup')
      },
      jest.fn(),
      jest.fn(),
      {} as never
    )
    await mockAuthStateListener!(reader('first'))
    await mockAuthStateListener!(reader('second'))
    expect(order).toEqual(['first', 'cleanup', 'second'])
    expect(auth.user?.uid).toBe('second')
  })
})

it('keeps the Firebase display name when Apple and a legacy profile have blank names', async () => {
  const { WebFireAuth } = await import('../FireAuth.web')
  const { getDoc } = await import('~helpers/firebase')
  jest.mocked(getDoc).mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ displayName: '' }),
  } as never)
  const auth = new WebFireAuth(),
    onLogin = jest.fn()
  await auth.init(onLogin, jest.fn(), jest.fn(), jest.fn(), jest.fn(), {} as never)
  await mockAuthStateListener!({
    uid: 'apple-reader',
    email: 'reader@privaterelay.appleid.com',
    displayName: 'Reader',
    providerData: [{ providerId: 'apple.com', displayName: '' }],
    metadata: {},
  })
  expect(onLogin).toHaveBeenCalledWith(
    expect.objectContaining({
      profile: expect.objectContaining({
        displayName: 'Reader',
        provider: 'apple.com',
        email: 'reader@privaterelay.appleid.com',
      }),
    })
  )
})

it('signs Firebase out even if the Telegram logout service is unreachable', async () => {
  const { endCyberJudahSession } = await import('../cyberJudahAccount')
  const { signOut } = await import('firebase/auth')
  const { WebFireAuth } = await import('../FireAuth.web')
  jest.mocked(endCyberJudahSession).mockRejectedValueOnce(new Error('offline'))
  const auth = new WebFireAuth()
  await auth.init(jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), {} as never)
  await auth.logout()
  expect(signOut).toHaveBeenCalled()
})
