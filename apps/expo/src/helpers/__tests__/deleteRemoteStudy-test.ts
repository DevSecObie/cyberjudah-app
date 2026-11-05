import { deleteRemoteStudy } from '../deleteRemoteStudy'

const mockUser = { uid: 'alice', getIdToken: jest.fn(async () => 'test-token') }
let mockCurrentUser: typeof mockUser | null = mockUser
jest.mock('../firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => mockCurrentUser }))
const previousFetch = global.fetch
const previousScope = process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE
const fetchMock = jest.fn()
const ack = (scope = 'production') => ({
  version: 1,
  uid: 'alice',
  studyId: 'study-1',
  scope,
  deleted: true,
})
beforeEach(() => {
  global.fetch = fetchMock
  mockCurrentUser = mockUser
  mockUser.getIdToken.mockReset().mockResolvedValue('test-token')
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ack() })
  delete process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE
})
afterAll(() => {
  global.fetch = previousFetch
  if (previousScope === undefined) delete process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE
  else process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE = previousScope
})

it.each(['production', 'staging'])(
  'sends only the signed-in study and validates the %s acknowledgment',
  async scope => {
    process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE = scope
    fetchMock.mockResolvedValue({ ok: true, json: async () => ack(scope) })
    await deleteRemoteStudy('alice', 'study-1')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/native-studies/${scope}/study-1`),
      expect.objectContaining({ method: 'DELETE', headers: { authorization: 'Bearer test-token' } })
    )
  }
)

it.each([
  { ...ack(), uid: 'bob' },
  { ...ack(), studyId: 'another' },
  { ...ack(), scope: 'staging' },
  { ...ack(), deleted: false },
  null,
])('rejects mismatched or missing acknowledgments', async body => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => body })
  await expect(deleteRemoteStudy('alice', 'study-1')).rejects.toMatchObject({
    code: 'study/deletion-incomplete',
  })
})

it('retains unavailable work for retry and classifies a refused owner for parking', async () => {
  for (const status of [404, 409, 503]) {
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) })
    await expect(deleteRemoteStudy('alice', 'study-1')).rejects.toMatchObject({
      code: 'study/deletion-incomplete',
    })
  }
  fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
  await expect(deleteRemoteStudy('alice', 'study-1')).rejects.toMatchObject({
    code: 'firestore/permission-denied',
  })
})

it('sends nothing if the account changes during token retrieval', async () => {
  mockUser.getIdToken.mockImplementationOnce(async () => {
    mockCurrentUser = null
    return 'test-token'
  })
  await expect(deleteRemoteStudy('alice', 'study-1')).rejects.toThrow('account changed')
  expect(fetchMock).not.toHaveBeenCalled()
})
