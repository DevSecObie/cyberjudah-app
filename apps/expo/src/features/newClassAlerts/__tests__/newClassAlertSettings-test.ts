const mockValues = new Map<string, boolean>()
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getBoolean: (key: string) => mockValues.get(key),
    set: (key: string, value: boolean) => mockValues.set(key, value),
  }),
}))
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { requestPermission: jest.fn(), createChannel: jest.fn(), isChannelBlocked: jest.fn() },
  AndroidImportance: { DEFAULT: 3 },
  AuthorizationStatus: { AUTHORIZED: 1 },
}))
jest.mock('expo-updates', () => ({ channel: 'production' }))
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

const mockMessaging = {
  getMessaging: jest.fn(() => ({})),
  unsubscribeFromTopic: jest.fn(),
  deleteToken: jest.fn(),
  setAutoInitEnabled: jest.fn(),
}
jest.mock('@react-native-firebase/messaging', () => mockMessaging, { virtual: true })

// Loaded after the mocks above exist (an import would be hoisted above them).
const { disableNewClassAlerts, readNewClassAlertsChoice } =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../newClassAlertSettings.native') as typeof import('../newClassAlertSettings.native')

describe('disableNewClassAlerts', () => {
  beforeEach(() => {
    mockValues.clear()
    mockValues.set('enabled', true)
    jest.clearAllMocks()
  })

  it('keeps the switch on when leaving the topic fails, so it never shows off while subscribed', async () => {
    mockMessaging.unsubscribeFromTopic.mockRejectedValueOnce(new Error('offline'))
    await expect(disableNewClassAlerts()).resolves.toBe('error')
    expect(readNewClassAlertsChoice()).toBe(true)
    expect(mockMessaging.deleteToken).not.toHaveBeenCalled()
  })

  it('saves off once the phone has left the topic', async () => {
    mockMessaging.unsubscribeFromTopic.mockResolvedValueOnce(undefined)
    await expect(disableNewClassAlerts()).resolves.toBe('off')
    expect(mockMessaging.unsubscribeFromTopic).toHaveBeenCalledWith({}, 'new-classes')
    expect(readNewClassAlertsChoice()).toBe(false)
  })

  it('stays off when only deleting the token fails (the phone is already off the topic)', async () => {
    mockMessaging.unsubscribeFromTopic.mockResolvedValueOnce(undefined)
    mockMessaging.deleteToken.mockRejectedValueOnce(new Error('offline'))
    await expect(disableNewClassAlerts()).resolves.toBe('off')
    expect(readNewClassAlertsChoice()).toBe(false)
  })
})
