const mockReadDownloaded = jest.fn()
jest.mock('../classLibraryIndex', () => ({
  readDownloadedClassNote: (...args: unknown[]) => mockReadDownloaded(...args),
}))
jest.mock('~helpers/storage', () => ({ storage: { getString: jest.fn(), set: jest.fn() } }))

import { loadPublishedNote, loadClassNote } from '../cyberJudahClasses'

beforeEach(() => jest.clearAllMocks())

it('opens downloaded class notes and renders blocks with the network unavailable', async () => {
  mockReadDownloaded.mockResolvedValue({
    title: 'Downloaded class',
    body: '# Teaching\n\nFull offline notes.',
    topics: ['faith'],
  })
  const fetcher = jest.fn().mockRejectedValue(new Error('offline'))
  const note = await loadClassNote('/classes/test', '', fetcher)
  expect(note.blocks.length).toBeGreaterThan(0)
  expect(JSON.stringify(note.blocks)).toContain('Full offline notes.')
  expect(note.topics).toEqual(['faith'])
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps online access for notes outside the installed copy', async () => {
  mockReadDownloaded.mockResolvedValue(null)
  const fetcher = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ body: 'New note' }) })
  expect(await loadPublishedNote('/classes/new', fetcher)).toEqual({ body: 'New note' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('rejects invalid paths before local or network access', async () => {
  const fetcher = jest.fn()
  await expect(loadPublishedNote('/../secret', fetcher)).rejects.toThrow('PATH_INVALID')
  expect(mockReadDownloaded).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
})
