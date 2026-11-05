import { deleteRemoteAccountData } from '../deleteRemoteAccountData'

const mockUser = { uid: 'alice', getIdToken: jest.fn(async () => 'test-id-token') }
let mockCurrentUser: typeof mockUser | null = mockUser
jest.mock('../firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => mockCurrentUser }))
const originalFetch = global.fetch
const originalOrigin = process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL
const fetchMock = jest.fn()
const acknowledgment = { version: 1, uid: 'alice', firestoreDeleted: true, removed: 7 }
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

beforeEach(() => {
  global.fetch = fetchMock
  mockCurrentUser = mockUser
  mockUser.getIdToken.mockReset().mockResolvedValue('test-id-token')
  fetchMock.mockReset().mockResolvedValue(response(acknowledgment))
  process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL = 'https://account-test.invalid/'
})
afterAll(() => {
  global.fetch = originalFetch
  if (originalOrigin === undefined) delete process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL
  else process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL = originalOrigin
})

it('sends a refreshed Firebase token without any client-selected identity or path', async () => {
  await deleteRemoteAccountData('alice')
  expect(mockUser.getIdToken).toHaveBeenCalledWith(true)
  expect(fetchMock).toHaveBeenCalledWith('https://account-test.invalid/api/native-account-data', {
    method: 'DELETE',
    headers: { authorization: 'Bearer test-id-token' },
    redirect: 'error',
    signal: expect.anything(),
  })
})

it.each([
  null,
  {},
  { ...acknowledgment, uid: 'bob' },
  { ...acknowledgment, version: 2 },
  { ...acknowledgment, firestoreDeleted: false },
])('rejects a missing, incompatible or other-account acknowledgment: %j', async body => {
  fetchMock.mockResolvedValue(response(body))
  await expect(deleteRemoteAccountData('alice')).rejects.toMatchObject({
    code: 'account/deletion-incomplete',
  })
})

it.each([404, 429, 500, 503])('keeps deletion pending when the server returns %i', async status => {
  fetchMock.mockResolvedValue(response({ error: 'account_deletion_not_ready' }, status))
  await expect(deleteRemoteAccountData('alice')).rejects.toMatchObject({
    code: 'account/deletion-incomplete',
  })
})

it('maps a server recent-sign-in rejection to the existing reauthentication flow', async () => {
  fetchMock.mockResolvedValue(response({ error: 'recent_sign_in_required' }, 401))
  await expect(deleteRemoteAccountData('alice')).rejects.toMatchObject({
    code: 'auth/requires-recent-login',
  })
})

it('propagates a timeout and rejects malformed success JSON', async () => {
  fetchMock.mockRejectedValueOnce(new Error('request timed out'))
  await expect(deleteRemoteAccountData('alice')).rejects.toThrow('request timed out')
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => {
      throw new Error('invalid JSON')
    },
  })
  await expect(deleteRemoteAccountData('alice')).rejects.toMatchObject({
    code: 'account/deletion-incomplete',
  })
})

it('sends nothing when the current login changes before or during token refresh', async () => {
  mockCurrentUser = null
  await expect(deleteRemoteAccountData('alice')).rejects.toMatchObject({
    code: 'auth/user-mismatch',
  })
  mockCurrentUser = mockUser
  mockUser.getIdToken.mockImplementationOnce(async () => {
    mockCurrentUser = { ...mockUser, uid: 'bob' }
    return 'test-id-token'
  })
  await expect(deleteRemoteAccountData('alice')).rejects.toMatchObject({
    code: 'auth/user-mismatch',
  })
  expect(fetchMock).not.toHaveBeenCalled()
})
