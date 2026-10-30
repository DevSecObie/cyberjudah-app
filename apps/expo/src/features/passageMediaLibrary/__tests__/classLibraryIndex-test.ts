const mockFiles = new Map<string, string>()
const mockStorage = new Map<string, string | number>()
const mockDownload = jest.fn()
const mockClose = jest.fn()
const mockFirst = jest.fn()
const mockMove = jest.fn()
const mockHead = jest.fn()
const mockOpen = jest.fn()
const file = '/documents/SQLite/cyberjudah/library.sqlite'

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: async () => ({ isConnected: true, type: 'wifi' }) },
}))
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }))
jest.mock('~helpers/agentObservability', () => ({
  appLogger: { captureError: jest.fn() },
}))
jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockStorage.get(key),
    getNumber: (key: string) => mockStorage.get(key),
    set: (key: string, value: string | number) => mockStorage.set(key, value),
    remove: (key: string) => mockStorage.delete(key),
  },
}))
jest.mock('~helpers/sqliteConnection', () => ({
  openSQLiteDatabase: (...args: unknown[]) => mockOpen(...args),
}))
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/documents/',
  getInfoAsync: async (path: string) => ({ exists: mockFiles.has(path) }),
  makeDirectoryAsync: async () => {},
  deleteAsync: async (path: string) => {
    mockFiles.delete(path)
  },
  moveAsync: (...args: unknown[]) => mockMove(...args),
  createDownloadResumable: () => ({ downloadAsync: () => mockDownload() }),
}))

const originalFetch = global.fetch
beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  mockFiles.clear()
  mockStorage.clear()
  mockFiles.set(file, 'old library')
  mockStorage.set('cyberjudah.classIndex.etag', '"edition-1"')
  mockFirst.mockResolvedValue({ n: 43 })
  mockClose.mockResolvedValue(undefined)
  mockOpen.mockResolvedValue({ getFirstAsync: mockFirst, closeAsync: mockClose })
  mockHead.mockResolvedValue({ headers: { get: () => 'W/"edition-1"' } })
  global.fetch = mockHead
  mockMove.mockImplementation(async ({ from, to }: { from: string; to: string }) => {
    const content = mockFiles.get(from)
    if (content === undefined) throw new Error('missing source')
    mockFiles.set(to, content)
    mockFiles.delete(from)
  })
  mockDownload.mockImplementation(async () => {
    mockFiles.set(`${file}.part`, 'new library')
    return { status: 200, headers: { ETag: 'W/"edition-2"' } }
  })
})
afterEach(() => {
  global.fetch = originalFetch
})

it('does not download an unchanged library when the server switches ETag strength', async () => {
  const index = require('../classLibraryIndex')
  await index.keepClassIndexCurrent()
  expect(mockDownload).not.toHaveBeenCalled()
  expect(await index.refreshClassIndexState()).toEqual({ status: 'ready' })
})

it('deduplicates simultaneous downloads and validates the candidate before activation', async () => {
  const index = require('../classLibraryIndex')
  const first = index.downloadClassIndex()
  expect(index.downloadClassIndex()).toBe(first)
  await first
  expect(mockDownload).toHaveBeenCalledTimes(1)
  expect(mockOpen).toHaveBeenCalledWith(
    'library.sqlite.part',
    { useNewConnection: true },
    '/documents/SQLite/cyberjudah'
  )
  expect(mockClose).toHaveBeenCalledTimes(1)
  expect(mockFiles.get(file)).toBe('new library')
  expect(mockStorage.get('cyberjudah.classIndex.etag')).toBe('"edition-2"')
})

it('keeps the installed library when a download is interrupted', async () => {
  mockDownload.mockRejectedValueOnce(new Error('connection lost'))
  const index = require('../classLibraryIndex')
  await index.downloadClassIndex()
  expect(mockFiles.get(file)).toBe('old library')
  expect(mockStorage.get('cyberjudah.classIndex.etag')).toBe('"edition-1"')
  expect(await index.refreshClassIndexState()).toEqual({ status: 'ready' })
})

it('rejects an invalid candidate without removing the installed library', async () => {
  mockFirst.mockResolvedValueOnce({ n: 0 })
  const index = require('../classLibraryIndex')
  await index.downloadClassIndex()
  expect(mockClose).toHaveBeenCalledTimes(1)
  expect(mockFiles.get(file)).toBe('old library')
  expect(mockFiles.has(`${file}.part`)).toBe(false)
})

it('rolls back when activating a valid candidate fails', async () => {
  const move = mockMove.getMockImplementation()!
  mockMove.mockImplementation(async (paths: { from: string; to: string }) => {
    if (paths.from.endsWith('.part')) throw new Error('disk full')
    return move(paths)
  })
  const index = require('../classLibraryIndex')
  await index.downloadClassIndex()
  expect(mockFiles.get(file)).toBe('old library')
  expect(mockStorage.get('cyberjudah.classIndex.etag')).toBe('"edition-1"')
})

it('restores a backup left by an interrupted file replacement at startup', async () => {
  mockFiles.delete(file)
  mockFiles.set(`${file}.backup`, 'old library')
  const index = require('../classLibraryIndex')
  expect(await index.refreshClassIndexState()).toEqual({ status: 'ready' })
  expect(mockFiles.get(file)).toBe('old library')
})
