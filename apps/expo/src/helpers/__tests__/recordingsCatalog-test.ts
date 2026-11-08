import {
  getRecordingAudioUrl,
  getRecordingBookSlug,
  loadRecordingsCatalog,
  parseRecordingsCatalog,
} from '../recordingsCatalog'
import bundled from '~assets/cyberjudah/apocrypha-recordings.json'

const sha256 = 'a'.repeat(64)
const genesis = { slug: 'genesis', chapter: 1, audio: 'recordings/reader/genesis/1.m4a', sha256 }

it('maps all 81 KJV books, preserving the release’s Apocrypha identities', () => {
  const slugs = Array.from({ length: 81 }, (_, i) => getRecordingBookSlug(i + 1))
  expect(slugs.every(Boolean)).toBe(true)
  expect(new Set(slugs).size).toBe(81)
  expect(slugs.slice(0, 3)).toEqual(['genesis', 'exodus', 'leviticus'])
  expect(slugs[65]).toBe('revelation')
  expect(slugs.slice(66)).toEqual([
    '1-esdras',
    '2-esdras',
    'tobit',
    'judith',
    'esther-greek',
    'wisdom-of-solomon',
    'sirach',
    'baruch',
    'epistle-of-jeremiah',
    'song-of-the-three-children',
    'susanna',
    'bel-and-the-dragon',
    'prayer-of-manasseh',
    '1-maccabees',
    '2-maccabees',
  ])
})

it('uses the server’s reader/path and content hash; absent or invalid chapters have no URL', () => {
  const catalog = parseRecordingsCatalog({ chapters: [genesis] })
  expect(getRecordingAudioUrl(1, 1, catalog)).toBe(
    `https://cyberjudah.io/api/audio/recordings/reader/genesis/1.m4a?v=${sha256}`
  )
  expect(getRecordingAudioUrl(3, 1, catalog)).toBe('')
  expect(getRecordingAudioUrl(1, 51, catalog)).toBe('')
  expect(getRecordingAudioUrl(82, 1, catalog)).toBe('')
  expect(
    getRecordingAudioUrl(1, 1, { chapters: [{ ...genesis, sha256: 'b'.repeat(64) }] })
  ).toContain('?v=' + 'b'.repeat(64))
})

it('keeps all 81 bundled recordings hash-pinned when no live or cached catalog is available', () => {
  for (const [id, recording] of Object.entries(bundled.books)) {
    for (const chapter of recording.chapters) {
      expect(getRecordingAudioUrl(Number(id), chapter)).toMatch(
        /^https:\/\/cyberjudah\.io\/api\/audio\/recordings\/[a-z0-9-]+\/[a-z0-9-]+\/\d+\.m4a\?v=[a-f0-9]{64}$/
      )
    }
  }
  expect(getRecordingAudioUrl(1, 1)).toBe('')
  expect(getRecordingAudioUrl(69, 5)).toBe('')
  // A successful catalog is authoritative, including a deliberately removed recording.
  expect(getRecordingAudioUrl(69, 1, { chapters: [] })).toBe('')
})

it.each([
  { ...genesis, audio: 'https://outside.example/1.m4a' },
  { ...genesis, audio: 'recordings/../genesis/1.m4a' },
  { ...genesis, audio: 'recordings/reader/exodus/1.m4a' },
  { ...genesis, chapter: 0 },
  { ...genesis, sha256: 'invalid' },
])('rejects malformed or unowned recording paths', row => {
  expect(() => parseRecordingsCatalog({ chapters: [row] })).toThrow('RECORDINGS_CATALOG_INVALID')
})

it('loads only the public production catalog and rejects HTTP failures', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ chapters: [genesis] }) })
  expect(await loadRecordingsCatalog(fetcher)).toEqual({ chapters: [genesis] })
  expect(fetcher).toHaveBeenCalledWith('https://cyberjudah.io/api/recordings/catalog', {
    headers: { accept: 'application/json' },
    signal: expect.any(AbortSignal),
  })
  fetcher.mockResolvedValue({ ok: false, status: 503 })
  await expect(loadRecordingsCatalog(fetcher)).rejects.toThrow('RECORDINGS_CATALOG_UNAVAILABLE:503')
})
