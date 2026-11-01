import { useOpenStudySource } from '../useOpenStudySource'

jest.mock('expo-modules-core', () => ({ uuid: { v4: () => 'test-id' } }))

const mockPush = jest.fn()
const mockExternal = jest.fn()
const mockCached = jest.fn()
const mockLoad = jest.fn()
const mockDock = jest.fn()
jest.mock('jotai', () => ({ ...jest.requireActual('jotai'), useSetAtom: () => mockDock }))
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

it('plays an uncatalogued transcript in the floating player at its cited time', async () => {
  await useOpenStudySource()(source)
  expect(mockDock).toHaveBeenCalledWith({
    videoId: source.video,
    title: source.title,
    start: 5978,
    returnTo: {
      pathname: '/(explore)/passage-media-player',
      params: { video: source.video, title: source.title, start: '5978' },
    },
  })
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockExternal).not.toHaveBeenCalled()
})

it('retains class notes by opening a catalogued recording by work ID', async () => {
  mockCached.mockReturnValue([{ providerId: source.video, workId: 'cyberjudah-class-abcdefghijk' }])
  await useOpenStudySource()(source)
  expect(mockDock).toHaveBeenCalledWith({
    videoId: source.video,
    title: source.title,
    start: 5978,
    returnTo: {
      pathname: '/(explore)/passage-media-player',
      params: { workId: 'cyberjudah-class-abcdefghijk', start: '5978' },
    },
  })
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockLoad).not.toHaveBeenCalled()
})

it('still opens the cited video if the class catalog is unavailable', async () => {
  mockCached.mockReturnValue(null)
  mockLoad.mockRejectedValue(new Error('offline'))
  await useOpenStudySource()({ ...source, t: undefined })
  expect(mockDock).toHaveBeenCalledWith({
    videoId: source.video,
    title: source.title,
    start: 0,
    returnTo: {
      pathname: '/(explore)/passage-media-player',
      params: { video: source.video, title: source.title, start: '0' },
    },
  })
  expect(mockPush).not.toHaveBeenCalled()
})

it('does not send malformed video IDs into the native player', async () => {
  await useOpenStudySource()({ ...source, video: 'invalid' })
  expect(mockPush).not.toHaveBeenCalled()
  expect(mockDock).not.toHaveBeenCalled()
})
