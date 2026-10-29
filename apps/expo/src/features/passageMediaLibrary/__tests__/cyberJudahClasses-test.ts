/* eslint-disable import/first */

const mockStore = new Map<string, string>()
jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockStore.get(key),
    set: (key: string, value: string) => mockStore.set(key, value),
  },
}))

import {
  getCachedClassById,
  loadClassLibrary,
  readCachedClassLibrary,
  toClassLibrary,
} from '../cyberJudahClasses'

const note = (
  kind: string,
  series: string,
  videoId: string | null,
  date: string,
  title = videoId ?? 'x'
) => ({
  kind,
  series,
  videoId,
  date,
  title,
  teacher: 'Bishop Nathanyel',
  url: `/${kind}/${date}`,
})

const notes = [
  note('history', 'Our Hidden History', 'FLSncKJFYss', '2026-10-25'),
  note('class', 'IUIC in the ClassRoom', 'sBoGbQK5zMA', '2026-10-24'),
  note('class', 'IUIC in the ClassRoom', 'P4cR6i32U80', '2026-10-26'),
  note('captains', '15 Minutes w/ The Captains', 'FQeCG3N9PZQ', '2026-10-26'),
  note('class', 'IUIC in the ClassRoom', null, '2026-10-27'),
  note('study', 'Bible study', 'AAAAAAAAAAA', '2026-10-27'),
]

beforeEach(() => mockStore.clear())

describe('CyberJudah class library', () => {
  it('lists classes with a video by series in order, newest first', () => {
    const library = toClassLibrary(notes, [{ videoId: 'FLSncKJFYss', duration: 7594 }])
    expect(library.map(item => [item.series, item.providerId])).toEqual([
      ['IUIC in the ClassRoom', 'P4cR6i32U80'],
      ['IUIC in the ClassRoom', 'sBoGbQK5zMA'],
      ['15 Minutes w/ The Captains', 'FQeCG3N9PZQ'],
      ['Our Hidden History', 'FLSncKJFYss'],
    ])
    expect(library[3].durationSeconds).toBe(7594)
    expect(library[0].durationSeconds).toBe(0)
    expect(library[0].subtitle).toBe('2026-10-26 · Bishop Nathanyel')
  })

  it('shows a newly published class without an app update and keeps it for offline', async () => {
    const published = [
      ...notes,
      note('class', 'IUIC in the ClassRoom', 'NEWCLASS123', '2026-10-30'),
    ]
    const fetcher = jest.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.endsWith('/api/notes/index.json') ? published : []),
    })) as unknown as typeof fetch
    const library = await loadClassLibrary(fetcher)
    expect(library[0].providerId).toBe('NEWCLASS123')
    expect(readCachedClassLibrary()?.[0].providerId).toBe('NEWCLASS123')
    expect(getCachedClassById('cyberjudah-class-NEWCLASS123')?.title).toBe('NEWCLASS123')
  })

  it('keeps the last list when the index cannot be read', async () => {
    const ok = jest.fn(async () => ({
      ok: true,
      json: async () => notes,
    })) as unknown as typeof fetch
    await loadClassLibrary(ok)
    const failing = jest.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch
    await expect(loadClassLibrary(failing)).rejects.toThrow('CYBERJUDAH_CLASSES_UNAVAILABLE:503')
    expect(readCachedClassLibrary()).toHaveLength(4)
  })
})
