jest.mock('expo/virtual/env', () => ({ env: process.env }))
import catalog from '../../assets/cyberjudah/offline-catalog.json'
// The server address is read when the module loads, so each test loads it under its own profile.
const loadIsPublic = (): ((url: string, sha256: string) => boolean) => {
  let isPublic: (url: string, sha256: string) => boolean = () => true
  jest.isolateModules(() => {
    isPublic = require('../cyberJudahPublicArchive').isCyberJudahPublicArchive
  })
  return isPublic
}
const previous = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
afterAll(() => {
  if (previous === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previous
})
it('allows only the exact published CyberJudah archives and their hashes', () => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  const isCyberJudahPublicArchive = loadIsPublic()
  for (const entry of Object.values(catalog.resources)) {
    expect(isCyberJudahPublicArchive(entry.url, entry.archiveSha256)).toBe(true)
    expect(isCyberJudahPublicArchive(entry.url, '0'.repeat(64))).toBe(false)
    expect(
      isCyberJudahPublicArchive(
        entry.url.replace('cyberjudah-telegram-staging.oisrae1.workers.dev', 'example.com'),
        entry.archiveSha256
      )
    ).toBe(false)
    expect(
      isCyberJudahPublicArchive(entry.url.replace('/offline/', '/private/'), entry.archiveSha256)
    ).toBe(false)
  }
})
it('never exempts original Bible Strong downloads', () => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'upstream'
  const isCyberJudahPublicArchive = loadIsPublic()
  const entry = catalog.resources['bible:KJV']
  expect(isCyberJudahPublicArchive(entry.url, entry.archiveSha256)).toBe(false)
})
it('bundles a valid catalog and matches the native Strong dataset identity', () => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  jest.isolateModules(() => {
    const {
      isMobileResourceCatalog,
      getMobileBibleVersionIds,
    } = require('../mobileResourceCatalog')
    const { getStrongDatasetId } = require('../strongBiblePublications')
    expect(isMobileResourceCatalog(catalog)).toBe(true)
    expect(getMobileBibleVersionIds()).toEqual(['KJV'])
    expect(getStrongDatasetId('KJV')).toBe('CYBERJUDAH')
    expect(getStrongDatasetId('LSG')).toBeUndefined()
  })
})
it('downloads from the configured CyberJudah server and exempts only that copy', () => {
  const previousOrigin = process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL = 'https://cyberjudah.io/'
  try {
    jest.isolateModules(() => {
      const { MOBILE_RESOURCE_CATALOG_URL } = require('../mobileResourceCatalog')
      const { isCyberJudahPublicArchive: isPublic } = require('../cyberJudahPublicArchive')
      expect(MOBILE_RESOURCE_CATALOG_URL).toBe('https://cyberjudah.io/offline/catalog.json')
      for (const entry of Object.values(catalog.resources)) {
        const production = entry.url.replace(
          'https://cyberjudah-telegram-staging.oisrae1.workers.dev',
          'https://cyberjudah.io'
        )
        expect(isPublic(production, entry.archiveSha256)).toBe(true)
        expect(isPublic(entry.url, entry.archiveSha256)).toBe(false)
      }
    })
  } finally {
    if (previousOrigin === undefined) delete process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL
    else process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL = previousOrigin
  }
})
