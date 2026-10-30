import { useOpenStudySource } from '../useOpenStudySource'

jest.mock('expo-modules-core', () => ({ uuid: { v4: () => 'test-id' } }))

const mockPush = jest.fn()
const mockExternal = jest.fn()
const mockCached = jest.fn()
const mockLoad = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('~features/publishedNotes/siteLinks', () => ({
  useOpenSiteLink: () => ({ open: mockExternal }),
}))
jest.mock('~features/passageMediaLibrary/cyberJudahClasses', () => ({
  readCachedClassLibrary: () => mockCached(),
  loadClassLibrary: () => mockLoad(),
}))
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: jest.fn() }))

const source = {
  n: 10,
  kind: 'transcript',
  title: 'The Israelites: Curse of the Law',
  url: '/classes/curse-of-the-law',
  video: 'abcdefghijk',
  t: 5978,
}
beforeEach(() => {
  jest.clearAllMocks()
  mockCached.mockReturnValue([])
  mockLoad.mockResolvedValue([])
})

it('opens an uncatalogued transcript in the existing player at its cited time', async () => {
  await useOpenStudySource()(source)
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(explore)/passage-media-player',
    params: { video: source.video, title: source.title, start: '5978' },
  })
  expect(mockExternal).not.toHaveBeenCalled()
})

it('retains class notes by opening a catalogued recording by work ID', async () => {
  mockCached.mockReturnValue([{ providerId: source.video, workId: 'cyberjudah-class-abcdefghijk' }])
  await useOpenStudySource()(source)
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(explore)/passage-media-player',
    params: { workId: 'cyberjudah-class-abcdefghijk', start: '5978' },
  })
  expect(mockLoad).not.toHaveBeenCalled()
})

it('still opens the cited video if the class catalog is unavailable', async () => {
  mockCached.mockReturnValue(null)
  mockLoad.mockRejectedValue(new Error('offline'))
  await useOpenStudySource()({ ...source, t: undefined })
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(explore)/passage-media-player',
    params: { video: source.video, title: source.title, start: '0' },
  })
})

it('does not send malformed video IDs into the native player', async () => {
  await useOpenStudySource()({ ...source, video: 'invalid' })
  expect(mockPush).not.toHaveBeenCalled()
})
